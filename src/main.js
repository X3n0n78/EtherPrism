// Imports
import './style.css';
import { PcapParser } from './parser/pcap.js';
import { ProtocolParser } from './parser/protocol.js';
import { renderNetworkGraph } from './visualizer/network_graph.js';
import { renderTimeline } from './visualizer/timeline.js';

// State
const state = {
    file: null,
    packets: [], // Array of { ...raw, ...decoded }
    flows: new Map(), // Key: "SrcIP->DstIP", Value: { bytes, count, packets: [] }
    isProcessing: false,
    selected: null // { type: 'node'|'link', data: ... }
};

// Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');
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

// Event Listeners
if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
if (btnClosePanel) btnClosePanel.addEventListener('click', closeSidePanel);

dropZone.addEventListener('click', (e) => {
    if (e.target !== browseBtn) fileInput.click();
});

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
});

if (btnReset) btnReset.addEventListener('click', resetApp);
if (btnExport) btnExport.addEventListener('click', exportData);
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (!query) return;

        // Find matching node
        // Simple search: find first node starting with query
        const match = Array.from(state.flows.values()).find(f =>
            f.source.includes(query) || f.target.includes(query)
        );

        if (match) {
            // Determine which IP matched
            const ip = match.source.includes(query) ? match.source : match.target;
            handleSelection('node', { id: ip });
        }
    });
}


// Logic
async function handleFile(file) {
    console.log('File dropped:', file.name);
    statusText.textContent = `Reading...`;
    statusDot.classList.add('active');

    try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        statusText.textContent = `Parsing ${(file.size / 1024 / 1024).toFixed(2)} MB...`;

        // Yield to UI
        await new Promise(r => setTimeout(r, 50));

        const pcap = new PcapParser(arrayBuffer);
        const rawPackets = pcap.parse();

        // Initialize state
        const flows = new Map();
        state.packets = [];

        // Analysis Loop
        rawPackets.forEach(raw => {
            const decoded = ProtocolParser.parse(raw.data);

            // Enrich packet object
            const packetObj = { ...raw, ...decoded };
            state.packets.push(packetObj);

            if (decoded.ip) {
                const key = `${decoded.ip.src}->${decoded.ip.dst}`;

                if (!flows.has(key)) {
                    flows.set(key, {
                        source: decoded.ip.src,
                        target: decoded.ip.dst,
                        value: 0,
                        count: 0,
                        protocolCounts: {},
                        packets: [] // Store reference to packets for detail view
                    });
                }

                const flow = flows.get(key);
                flow.value += raw.length;
                flow.count += 1;
                flow.packets.push(packetObj); // keep track

                // Protocol Stats
                const proto = decoded.tcp ? 'TCP' : (decoded.udp ? 'UDP' : 'Other');
                flow.protocolCounts[proto] = (flow.protocolCounts[proto] || 0) + 1;
            }
        });

        state.flows = flows;

        statusText.textContent = `Analysis Complete. Flows: ${flows.size} | Packets: ${state.packets.length}`;
        statusDot.classList.remove('active');

        // Render Everything
        renderApp();

    } catch (err) {
        console.error(err);
        statusText.textContent = 'Error: ' + err.message;
        statusDot.className = 'status-dot error';
    }
}

function renderApp() {
    dropZone.classList.add('hidden');
    visualizationContainer.classList.remove('hidden');

    // Show new UI
    if (controls) controls.classList.remove('hidden');
    if (timelineContainer) {
        timelineContainer.classList.remove('hidden');
        // Render timeline only once or when packets change (no re-render on brush to avoid loops)
        // We pass the global packets here
        renderTimeline(state.packets, 'timeline-container', handleTimelineBrush);
    }

    // Determine flows to show (filtered or all)
    const activeFlows = state.filteredFlows || state.flows;
    const flowData = Array.from(activeFlows.values());

    if (flowData.length === 0) {
        visualizationContainer.innerHTML = '<p class="empty-msg">No flows in selection.</p>';
        return;
    }

    // Render Graph with selection callback
    renderNetworkGraph(flowData, 'visualization-container', handleSelection);
}

// Debounce handle to prevent excessive re-renders during drag
let brushTimeout;
function handleTimelineBrush(start, end) {
    if (brushTimeout) clearTimeout(brushTimeout);

    brushTimeout = setTimeout(() => {
        applyTimeFilter(start, end);
    }, 100);
}

function applyTimeFilter(start, end) {
    if (start === null || end === null) {
        state.filteredFlows = null; // Clear filter
        renderAppFiltered(); // Optimized re-render
        return;
    }

    const filteredPackets = state.packets.filter(p => p.timestamp >= start && p.timestamp <= end);

    // Re-aggregate flows from filtered packets
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
    // Only update the graph, don't re-render timeline (it causes brush reset)
    const activeFlows = state.filteredFlows || state.flows;
    const flowData = Array.from(activeFlows.values());

    if (flowData.length === 0) {
        visualizationContainer.innerHTML = '<p class="empty-msg">No flows in selection.</p>';
        return;
    }
    renderNetworkGraph(flowData, 'visualization-container', handleSelection);
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
    const title = document.getElementById('panel-title');

    let content = '';

    if (type === 'node') {
        const ip = data.id;
        title.textContent = `Host: ${ip}`;

        // Calculate detailed stats for this node (ingress/egress)
        let totalSent = 0;
        let totalRecv = 0;
        let sentPackets = 0;
        let recvPackets = 0;

        state.flows.forEach(f => {
            if (f.source === ip) {
                totalSent += f.value;
                sentPackets += f.count;
            }
            if (f.target === ip) {
                totalRecv += f.value;
                recvPackets += f.count;
            }
        });

        content = `
            <div class="panel-stat"><label>Total Traffic</label><span>${formatBytes(totalSent + totalRecv)}</span></div>
            <div class="panel-stat"><label>Sent</label><span>${formatBytes(totalSent)} (${sentPackets} pkts)</span></div>
            <div class="panel-stat"><label>Received</label><span>${formatBytes(totalRecv)} (${recvPackets} pkts)</span></div>
            <hr style="border-color:rgba(255,255,255,0.1); margin: 1rem 0;">
            <div style="color:var(--accent-cyan); font-size:0.8rem;">Connections</div>
        `;
    } else if (type === 'link') {
        title.textContent = `Flow Details`;
        const flow = state.flows.get(`${data.source.id}->${data.target.id}`) ||
            state.flows.get(`${data.source}->${data.target}`) || data; // Fallback

        content = `
            <div class="panel-stat"><label>Source</label><span>${flow.source?.id || flow.source}</span></div>
            <div class="panel-stat"><label>Target</label><span>${flow.target?.id || flow.target}</span></div>
            <div class="panel-stat"><label>Volume</label><span>${formatBytes(flow.value)}</span></div>
            <div class="panel-stat"><label>Packets</label><span>${flow.count}</span></div>
            <div class="panel-stat"><label>TCP</label><span>${flow.protocolCounts?.TCP || 0}</span></div>
            <div class="panel-stat"><label>UDP</label><span>${flow.protocolCounts?.UDP || 0}</span></div>
        `;
    }

    panelContent.innerHTML = content;
}

function closeSidePanel() {
    if (sidePanel) sidePanel.classList.add('hidden');
    state.selected = null;
}

function resetApp() {
    state.file = null;
    state.packets = [];
    state.flows.clear();
    state.isProcessing = false;

    visualizationContainer.innerHTML = '';
    visualizationContainer.classList.add('hidden');

    if (controls) controls.classList.add('hidden');
    if (sidePanel) sidePanel.classList.add('hidden');
    if (timelineContainer) timelineContainer.classList.add('hidden');

    dropZone.classList.remove('hidden');

    statusText.textContent = 'Ready';
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
