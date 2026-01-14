import './style.css';
import { renderNetworkGraph } from './visualizer/network_graph.js';
import { renderTimeline } from './visualizer/timeline.js';
import { renderDashboard } from './visualizer/dashboard.js';
import { renderPacketList } from './visualizer/packet_list.js';

// IMMEDIATE STATUS UPDATE - If this runs, JS is working
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');
if (statusText) statusText.textContent = "Initializing...";

// State
const state = {
    file: null,
    packets: [],
    flows: new Map(),
    isProcessing: false,
    selected: null,
    hiddenNodes: new Set(),
    hostnames: new Map()
};

// Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.btn-browse');

// New UI Elements
const controls = document.getElementById('controls');
const btnReset = document.getElementById('btn-reset');
const btnExport = document.getElementById('btn-export');
const searchInput = document.getElementById('search-input');
const sidePanel = document.getElementById('side-panel');
const panelContent = document.getElementById('panel-content');
const btnClosePanel = document.getElementById('btn-close-panel');
const timelineContainer = document.getElementById('timeline-container');
const visualizationContainer = document.getElementById('visualization-container');

// --- EVENT LISTENERS ---

// Global Error Handler
window.onerror = function (message, source, lineno, colno, error) {
    console.error('Global Error:', error);
    if (statusText) statusText.textContent = `Error: ${message}`;
    if (statusDot) statusDot.className = 'status-dot error';
};

// Global Drag Prevention
window.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
window.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); });

// Drop Zone Events
if (dropZone) {
    dropZone.addEventListener('click', (e) => {
        if (e.target !== browseBtn) fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
        if (statusText) statusText.textContent = "Drop File Here";
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        if (statusText) statusText.textContent = "System Active";
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');

        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
}

// File Input
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
            fileInput.value = '';
        }
    });
}

// Buttons
if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
if (btnClosePanel) btnClosePanel.addEventListener('click', closeSidePanel);
if (btnReset) btnReset.addEventListener('click', resetApp);
if (btnExport) btnExport.addEventListener('click', exportData);
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (!query) return;
        const match = Array.from(state.flows.values()).find(f =>
            f.source.includes(query) || f.target.includes(query)
        );
        if (match) {
            const ip = match.source.includes(query) ? match.source : match.target;
            handleSelection('node', { id: ip });
        }
    });
}


// --- LOGIC ---

async function handleFile(file) {
    console.log('Handling file:', file.name);
    state.isProcessing = true;
    if (statusText) statusText.textContent = `Reading...`;
    if (statusDot) statusDot.className = 'status-dot active';

    try {
        const arrayBuffer = await readFileAsArrayBuffer(file);

        // Try Dynamic Worker Import
        try {
            // We use a relative path URL for the worker. 
            // Note: In Vite dev, this usually works. In some builds it might need adjustment.
            const workerUrl = new URL('./worker/pcap.worker.js', import.meta.url);
            const worker = new Worker(workerUrl, { type: 'module' });

            worker.postMessage({ buffer: arrayBuffer }, [arrayBuffer]);

            worker.onmessage = (e) => {
                const { type, packets, message, error } = e.data;

                if (type === 'status' || type === 'progress') {
                    statusText.textContent = message;
                } else if (type === 'complete') {
                    processPackets(packets);
                    worker.terminate();
                } else if (type === 'error') {
                    console.warn('Worker error:', error);
                    worker.terminate();
                    handleFileSynchronous(file);
                }
            };

            worker.onerror = (err) => {
                console.error('Worker startup error:', err);
                worker.terminate();
                handleFileSynchronous(file);
            };

        } catch (workerErr) {
            console.warn('Worker init failed:', workerErr);
            handleFileSynchronous(file);
        }

    } catch (err) {
        console.error(err);
        if (statusText) statusText.textContent = 'Error: ' + err.message;
        if (statusDot) statusDot.className = 'status-dot error';
        state.isProcessing = false;
    }
}

async function handleFileSynchronous(file) {
    console.log('Switching to Synchronous Mode');
    if (statusText) statusText.textContent = `Parsing (Sync Mode)...`;

    // Helper to read file again
    const arrayBuffer = await readFileAsArrayBuffer(file);

    try {
        // Dynamic import logic
        const { PcapParser } = await import('./parser/pcap.js');
        const { ProtocolParser } = await import('./parser/protocol.js');

        const pcap = new PcapParser(arrayBuffer);
        const rawPackets = pcap.parse();

        const packets = rawPackets.map(raw => {
            const decoded = ProtocolParser.parse(raw.data);
            return { ...raw, ...decoded };
        });

        processPackets(packets);

    } catch (e) {
        if (statusText) statusText.textContent = 'Sync Parse Error: ' + e.message;
        if (statusDot) statusDot.className = 'status-dot error';
        state.isProcessing = false;
        console.error(e);
    }
}

function processPackets(packets) {
    state.packets = packets;
    state.flows = new Map();
    state.hostnames = new Map();
    state.hiddenNodes = new Set();

    packets.forEach(packet => {
        if (packet.ip) {
            const key = `${packet.ip.src}->${packet.ip.dst}`;

            if (!state.flows.has(key)) {
                state.flows.set(key, {
                    source: packet.ip.src,
                    target: packet.ip.dst,
                    value: 0,
                    count: 0,
                    protocolCounts: {},
                    packets: []
                });
            }

            const flow = state.flows.get(key);
            flow.value += packet.length;
            flow.count += 1;
            flow.packets.push(packet);

            const proto = packet.tcp ? 'TCP' : (packet.udp ? 'UDP' : 'Other');
            flow.protocolCounts[proto] = (flow.protocolCounts[proto] || 0) + 1;

            if (packet.app) {
                if (!flow.appInfo) flow.appInfo = new Set();
                flow.appInfo.add(packet.app.info);
                flow.appType = packet.app.type;

                if (packet.app.type === 'TLS' && packet.app.info.startsWith('SNI: ')) {
                    const hostname = packet.app.info.replace('SNI: ', '');
                    state.hostnames.set(packet.ip.dst, hostname);
                }
            }
        }
    });

    state.isProcessing = false;
    statusText.textContent = `Analysis Complete. Flows: ${state.flows.size}`;
    statusDot.className = 'status-dot';

    renderApp();
}

function renderApp() {
    dropZone.classList.add('hidden');
    visualizationContainer.classList.remove('hidden');

    if (controls) controls.classList.remove('hidden');
    if (timelineContainer) {
        timelineContainer.classList.remove('hidden');
        renderTimeline(state.packets, 'timeline-container', handleTimelineBrush);
    }

    const activeFlows = state.filteredFlows || state.flows;
    let flowData = Array.from(activeFlows.values());

    if (state.hiddenNodes && state.hiddenNodes.size > 0) {
        flowData = flowData.filter(f => !state.hiddenNodes.has(f.source) && !state.hiddenNodes.has(f.target));
    }

    updateResetButton();

    if (flowData.length === 0) {
        visualizationContainer.innerHTML = '<p class="empty-msg">No flows in selection.</p>';
        return;
    }

    renderNetworkGraph(flowData, 'visualization-container', handleSelection, handleHideNode);
}

function updateResetButton() {
    let resetBtn = document.getElementById('reset-visibility-btn');
    if (state.hiddenNodes && state.hiddenNodes.size > 0) {
        if (!resetBtn) {
            resetBtn = document.createElement('button');
            resetBtn.id = 'reset-visibility-btn';
            resetBtn.className = 'control-btn';
            resetBtn.title = "Restore hidden nodes";
            resetBtn.onclick = resetHiddenNodes;
            controls.appendChild(resetBtn);
        }
        resetBtn.textContent = `Show Hidden (${state.hiddenNodes.size})`;
        resetBtn.style.display = 'inline-flex';
    } else {
        if (resetBtn) resetBtn.style.display = 'none';
    }

    let statsBtn = document.getElementById('stats-btn');
    if (!statsBtn) {
        statsBtn = document.createElement('button');
        statsBtn.id = 'stats-btn';
        statsBtn.className = 'control-btn';
        statsBtn.textContent = '📊 Statistics';
        statsBtn.onclick = () => renderDashboard(state.packets, 'dashboard-container', () => { });
        controls.appendChild(statsBtn);
    }
}

function resetHiddenNodes() {
    state.hiddenNodes.clear();
    renderApp();
}

function handleHideNode(nodeId) {
    if (!state.hiddenNodes) state.hiddenNodes = new Set();
    state.hiddenNodes.add(nodeId);
    renderApp();
}

let brushTimeout;
function handleTimelineBrush(start, end) {
    if (brushTimeout) clearTimeout(brushTimeout);
    brushTimeout = setTimeout(() => {
        applyTimeFilter(start, end);
    }, 100);
}

function applyTimeFilter(start, end) {
    if (start === null || end === null) {
        state.filteredFlows = null;
        renderAppFiltered();
        return;
    }

    const filteredPackets = state.packets.filter(p => p.timestamp >= start && p.timestamp <= end);
    const newFlows = new Map();

    filteredPackets.forEach(p => {
        if (p.ip) {
            const key = `${p.ip.src}->${p.ip.dst}`;
            if (!newFlows.has(key)) {
                newFlows.set(key, {
                    source: p.ip.src,
                    target: p.ip.dst,
                    value: 0,
                    count: 0,
                    protocolCounts: {},
                    packets: []
                });
            }
            const flow = newFlows.get(key);
            flow.value += p.length;
            flow.count += 1;
            flow.packets.push(p);

            const proto = p.tcp ? 'TCP' : (p.udp ? 'UDP' : 'Other');
            flow.protocolCounts[proto] = (flow.protocolCounts[proto] || 0) + 1;
        }
    });

    state.filteredFlows = newFlows;
    renderAppFiltered();
}

function renderAppFiltered() {
    const activeFlows = state.filteredFlows || state.flows;
    let flowData = Array.from(activeFlows.values());

    if (state.hiddenNodes && state.hiddenNodes.size > 0) {
        flowData = flowData.filter(f => !state.hiddenNodes.has(f.source) && !state.hiddenNodes.has(f.target));
    }

    updateResetButton();

    if (flowData.length === 0) {
        visualizationContainer.innerHTML = '<p class="empty-msg">No flows in selection.</p>';
        return;
    }
    renderNetworkGraph(flowData, 'visualization-container', handleSelection, handleHideNode);
}



function handleSelection(type, data) {
    if (!type) {
        closeSidePanel();
        return;
    }

    state.selected = { type, data };
    showSidePanel(type, data);
}

function showSidePanel(type, data) {
    if (!sidePanel) return;

    sidePanel.classList.remove('hidden');

    // Structure with Tabs
    sidePanel.innerHTML = `
        <div class="panel-header">
            <h3 id="panel-title">Details</h3>
            <button id="btn-close-panel" class="btn-close">&times;</button>
        </div>
        <div class="panel-tabs">
            <button class="panel-tab active" data-tab="stats">Stats</button>
            <button class="panel-tab" data-tab="packets" id="tab-packets">Packets</button>
        </div>
        <div class="panel-content" id="panel-content">
            <!-- Content Injected Here -->
        </div>
    `;

    // Re-attach close listener
    document.getElementById('btn-close-panel').onclick = closeSidePanel;

    // Tab Listeners
    const tabs = sidePanel.querySelectorAll('.panel-tab');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderPanelContent(type, data, tab.dataset.tab);
        };
    });

    // Initial Render
    renderPanelContent(type, data, 'stats');
}

function renderPanelContent(type, data, tabName) {
    const container = document.getElementById('panel-content');
    const title = document.getElementById('panel-title');

    // Retrieve Flow or Node Data
    let flow = null;
    let nodeIp = null;

    if (type === 'link') {
        flow = state.flows.get(`${data.source.id}->${data.target.id}`) ||
            state.flows.get(`${data.source}->${data.target}`) || data;
        title.textContent = "Flow Details";
    } else {
        nodeIp = data.id;
        title.textContent = `Host: ${nodeIp}`;
    }

    if (tabName === 'packets') {
        let packetsToShow = [];
        if (type === 'link' && flow) {
            packetsToShow = flow.packets || [];
        } else if (type === 'node' && nodeIp) {
            // Aggregate all packets for this node
            packetsToShow = state.packets.filter(p =>
                (p.ip && p.ip.src === nodeIp) || (p.ip && p.ip.dst === nodeIp)
            );
        }
        renderPacketList(packetsToShow, 'panel-content');
        return;
    }

    // Render Stats (Classic View)
    let content = '';

    if (type === 'node') {
        const hostname = state.hostnames.get(nodeIp) || 'Unresolved';
        const hostnameColor = hostname === 'Unresolved' ? 'var(--text-muted)' : 'var(--accent-cyan)';

        let totalSent = 0;
        let totalRecv = 0;
        let sentPackets = 0;
        let recvPackets = 0;
        const protocols = {};

        state.flows.forEach(f => {
            if (f.source === nodeIp) {
                totalSent += f.value;
                sentPackets += f.count;
                Object.keys(f.protocolCounts).forEach(p => protocols[p] = (protocols[p] || 0) + f.protocolCounts[p]);
            }
            if (f.target === nodeIp) {
                totalRecv += f.value;
                recvPackets += f.count;
                Object.keys(f.protocolCounts).forEach(p => protocols[p] = (protocols[p] || 0) + f.protocolCounts[p]);
            }
        });

        // Top Protocols
        const sortedProtos = Object.entries(protocols)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([p, c]) => `${p} (${c})`)
            .join(', ');

        content = `
            <div class="panel-stat"><label>Hostname</label><span style="color:${hostnameColor}">${hostname}</span></div>
            <hr style="border-color:rgba(255,255,255,0.1); margin: 1rem 0;">
            <div class="panel-stat"><label>Total Traffic</label><span>${formatBytes(totalSent + totalRecv)}</span></div>
            <div class="panel-stat"><label>Sent</label><span>${formatBytes(totalSent)} (${sentPackets} pkts)</span></div>
            <div class="panel-stat"><label>Received</label><span>${formatBytes(totalRecv)} (${recvPackets} pkts)</span></div>
            <div class="panel-stat"><label>Top Protocols</label><span>${sortedProtos || '-'}</span></div>
            <hr style="border-color:rgba(255,255,255,0.1); margin: 1rem 0;">
            <div style="color:var(--accent-cyan); font-size:0.8rem;">Select 'Packets' tab for details</div>
        `;
    } else if (type === 'link' && flow) {
        content = `
            <div class="panel-stat"><label>Source</label><span>${flow.source?.id || flow.source}</span></div>
            <div class="panel-stat"><label>Target</label><span>${flow.target?.id || flow.target}</span></div>
            <div class="panel-stat"><label>Volume</label><span>${formatBytes(flow.value)}</span></div>
            <div class="panel-stat"><label>Packets</label><span>${flow.count}</span></div>
            <div class="panel-stat"><label>TCP</label><span>${flow.protocolCounts?.TCP || 0}</span></div>
            <div class="panel-stat"><label>UDP</label><span>${flow.protocolCounts?.UDP || 0}</span></div>
            ${renderAppInfo(flow)}
        `;
    }

    container.innerHTML = content;
}

function renderAppInfo(flow) {
    if (!flow.appInfo || flow.appInfo.size === 0) return '';
    const items = Array.from(flow.appInfo).slice(0, 5);
    const listHtml = items.map(item => `<div style="font-size:0.8rem; margin-top:4px; color:var(--text-secondary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">• ${item}</div>`).join('');

    return `
        <hr style="border-color:rgba(255,255,255,0.1); margin: 1rem 0;">
        <div style="color:var(--accent-primary); font-size:0.8rem; margin-bottom:0.5rem;">${flow.appType || 'Application'} Info</div>
        ${listHtml}
        ${flow.appInfo.size > 5 ? `<div style="font-size:0.7rem; color:var(--text-muted);">+ ${flow.appInfo.size - 5} more</div>` : ''}
    `;
}

function closeSidePanel() {
    if (sidePanel) sidePanel.classList.add('hidden');
    state.selected = null;
}

function resetApp() {
    state.file = null;
    state.packets = [];
    state.flows = new Map();
    state.isProcessing = false;
    state.selected = null;
    state.filteredFlows = null;
    state.hiddenNodes = new Set();
    state.hostnames = new Map();

    visualizationContainer.innerHTML = '';
    visualizationContainer.classList.add('hidden');

    if (controls) controls.classList.add('hidden');
    if (sidePanel) sidePanel.classList.add('hidden');
    if (timelineContainer) timelineContainer.classList.add('hidden');

    dropZone.classList.remove('hidden');

    statusText.textContent = 'System Active';
    statusDot.className = 'status-dot';
    fileInput.value = '';
}

function exportData() {
    if (state.flows.size === 0) return;
    const data = Array.from(state.flows.values());
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etherprism-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// FINAL READY SIGNAL
console.log("Main JS Loaded Successfully");
if (statusText) statusText.textContent = "System Active";
