import './style.css';
import { store } from './core/store.js';
import { bus } from './core/event_bus.js';
import { renderNetworkGraph } from './visualizer/network_graph.js';
// View State
let currentView = 'graph'; // 'graph' or 'list'

import { renderPacketList } from './visualizer/packet_list.js';
import { renderTimeline } from './visualizer/timeline.js';
import { StreamAnalyst } from './visualizer/stream_analyst.js';
import { renderStevensGraph } from './visualizer/stevens_graph.js';
import { renderHexView } from './visualizer/hex_view.js';
import { SecurityEngine } from './core/security_engine.js';
import { renderGeoMap } from './visualizer/geo_map.js';

// --- Initialization ---
console.log('EtherPrism Nexus Initializing...');

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const btnImport = document.getElementById('btn-import');
const btnCloseDetails = document.getElementById('btn-close-details');
const detailsPanel = document.getElementById('details-panel');
const statusBadge = document.getElementById('app-status');

// Stream Modal Elements
const streamModal = document.getElementById('stream-modal');
const btnCloseStream = document.getElementById('btn-close-stream');
const btnTabAscii = document.getElementById('btn-tab-ascii');
const btnTabHtml = document.getElementById('btn-tab-html');
const streamContent = document.getElementById('stream-content');
const stevensContainer = 'stevens-graph-container';

// View Toggles
const btnViewGraph = document.getElementById('btn-view-graph');
const btnViewList = document.getElementById('btn-view-list');
const btnViewMap = document.getElementById('btn-view-map');

// --- Event Subscriptions ---

store.getPackets(); // Init check

bus.on('status:updated', (msg) => {
    const dot = statusBadge.querySelector('.status-dot');
    const text = statusBadge.childNodes[1]; // Text node
    if (text) text.textContent = ` ${msg}`;

    // Simple pulse effect based on msg content
    if (msg.includes('Reading') || msg.includes('Processing')) {
        statusBadge.classList.add('processing');
        dot.style.color = 'var(--accent-cyan)';
    } else {
        statusBadge.classList.remove('processing');
        dot.style.color = 'var(--accent-success)';
    }
});

bus.on('state:updated', ({ key, value }) => {
    if (key === 'isProcessing') {
        if (value) dropZone.classList.add('hidden'); // Keep hidden during process
    }
});

bus.on('data:loaded', (packets) => {
    dropZone.classList.add('hidden');
    renderApp();
});

bus.on('selection:changed', (selected) => {
    if (selected) {
        detailsPanel.classList.remove('collapsed');
        renderDetails(selected);
    } else {
        detailsPanel.classList.add('collapsed');
    }
});

bus.on('view:updated', () => {
    renderApp();
});
bus.on('filter:time', () => renderApp());
bus.on('filter:search', () => renderApp());

// Packet Selected Event (from packet list)
window.addEventListener('packet-selected', (e) => {
    // console.log("Packet Selected", e.detail);
    store.updateSelection('packet', e.detail);
});


// --- User Interaction ---

// Stream Modal Logic
let currentStreamData = null;

if (btnCloseStream) {
    btnCloseStream.addEventListener('click', () => {
        streamModal.classList.add('hidden');
    });
}

if (btnTabAscii) {
    btnTabAscii.addEventListener('click', () => {
        btnTabAscii.classList.add('active');
        btnTabHtml.classList.remove('active');
        if (currentStreamData) streamContent.textContent = currentStreamData.text;
    });
}

if (btnTabHtml) {
    btnTabHtml.addEventListener('click', () => {
        btnTabHtml.classList.add('active');
        btnTabAscii.classList.remove('active');
        if (currentStreamData) streamContent.innerHTML = currentStreamData.html;
    });
}

function openStreamAnalysis(packet) {
    try {
        const allPackets = store.getPackets();
        const analysis = StreamAnalyst.followTcpStream(packet, allPackets);
        currentStreamData = analysis;

        // Reset Tabs
        btnTabAscii.classList.add('active');
        btnTabHtml.classList.remove('active');
        streamContent.textContent = analysis.text;

        // Show Modal
        streamModal.classList.remove('hidden');

        // Render Stevens Graph
        // Delay slightly for layout calc
        setTimeout(() => {
            renderStevensGraph(analysis, stevensContainer);
        }, 100);

    } catch (e) {
        console.error(e);
        alert("Stream Analysis Failed: " + e.message);
    }
}

// View Switching
btnViewGraph.addEventListener('click', () => switchView('graph'));
btnViewList.addEventListener('click', () => switchView('list'));
if (btnViewMap) btnViewMap.addEventListener('click', () => switchView('map'));

function switchView(view) {
    currentView = view;
    // Reset all
    [btnViewGraph, btnViewList, btnViewMap].forEach(btn => {
        if (btn) {
            btn.classList.remove('active');
            btn.style.opacity = '0.7';
            btn.style.background = 'transparent';
        }
    });

    // Set active
    let activeBtn;
    if (view === 'graph') activeBtn = btnViewGraph;
    else if (view === 'list') activeBtn = btnViewList;
    else if (view === 'map') activeBtn = btnViewMap;

    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.opacity = '1';
        activeBtn.style.background = 'rgba(34, 211, 238, 0.1)';
    }

    renderApp();
}

// File Handling
btnImport.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));

// Drop Zone
window.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); });
window.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); });

dropZone.addEventListener('dragover', (e) => {
    e.dataTransfer.dropEffect = 'copy';
    dropZone.style.background = 'rgba(34, 211, 238, 0.1)';
});

dropZone.addEventListener('dragleave', () => {
    dropZone.style.background = '';
});

dropZone.addEventListener('drop', (e) => {
    dropZone.style.background = '';
    const files = e.dataTransfer.files;
    if (files.length) handleFileSelect(files[0]);
});

// Sidebar Controls
document.getElementById('search-input').addEventListener('input', (e) => {
    store.updateSearch(e.target.value);
});

// Details Panel
btnCloseDetails.addEventListener('click', () => {
    store.updateSelection(null, null);
});


// --- Core Logic ---

async function handleFileSelect(file) {
    if (!file) return;
    store.setFile(file);

    try {
        const arrayBuffer = await readFileAsArrayBuffer(file);

        // Dynamic import of worker to ensure path correctness
        const workerUrl = new URL('./worker/pcap.worker.js', import.meta.url);
        const worker = new Worker(workerUrl, { type: 'module' });

        worker.postMessage({ buffer: arrayBuffer }, [arrayBuffer]);

        worker.onmessage = (e) => {
            const { type, packets, message } = e.data;
            if (type === 'status' || type === 'progress') {
                bus.emit('status:updated', message);
            } else if (type === 'complete') {
                store.setPackets(packets);
                worker.terminate();
            } else if (type === 'error') {
                console.error(e.data.error);
                bus.emit('status:updated', "Error: " + e.data.error);
                worker.terminate();
            }
        };

    } catch (err) {
        console.error(err);
        bus.emit('status:updated', 'Error loading file');
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function renderApp() {
    // Check if data exists
    const packets = store.getPackets();
    if (packets.length === 0) return;

    // Apply Time Filter
    let activePackets = packets;
    if (store.state.filter.timeStart) {
        activePackets = activePackets.filter(p => p.timestamp >= store.state.filter.timeStart && p.timestamp <= store.state.filter.timeEnd);
    }

    // Apply Search Filter (Case insensitive)
    const searchTerm = store.state.filter.searchTerm ? store.state.filter.searchTerm.toLowerCase() : '';
    if (searchTerm) {
        activePackets = activePackets.filter(p => {
            const src = p.ip?.src || '';
            const dst = p.ip?.dst || '';
            const proto = (p.tcp ? 'tcp' : (p.udp ? 'udp' : (p.icmp ? 'icmp' : '')));

            // Basic searching - extend as needed
            if (src.includes(searchTerm) || dst.includes(searchTerm)) return true;
            if (proto.includes(searchTerm)) return true;

            // Info field search
            let info = '';
            if (p.app) info = p.app.info;
            // else if (p.tcp) ... (reconstruct info string if needed, or search ports)
            if (info && info.toLowerCase().includes(searchTerm)) return true;

            return false;
        });
    }

    // Run Security Scan
    const alerts = SecurityEngine.scan(activePackets);

    if (currentView === 'graph') {
        const flows = store.getFlows().filter(f => {
            const hidden = store.getHiddenNodes().has(f.source) || store.getHiddenNodes().has(f.target);
            if (hidden) return false;

            if (searchTerm) {
                return f.source.includes(searchTerm) || f.target.includes(searchTerm);
            }
            return true;
        });

        renderNetworkGraph(flows, 'visualization-container',
            (type, data) => store.updateSelection(type, data),
            (id) => store.hideNode(id)
        );
    } else if (currentView === 'map') {
        renderGeoMap(activePackets, 'visualization-container');
    } else {
        renderPacketList(activePackets, 'visualization-container', packets);
    }

    // Render Timeline
    renderTimeline(activePackets, 'timeline-container', (start, end) => {
        store.updateTimeFilter(start, end);
    });

    // Update Sidebar Stats
    updateSidebarStats(activePackets, alerts);
}

function updateSidebarStats(packets, alerts = []) {
    // If no packets passed (initial call), use main store
    if (!packets) packets = store.getPackets();

    // We can't easily get flows for filtered packets without re-analyzing, 
    // so for now just show packet stats or total flows.
    // Let's show visible packet count.

    const statsContainer = document.getElementById('sidebar-stats');

    let tcp = 0, udp = 0;
    packets.forEach(p => {
        if (p.tcp) tcp++;
        if (p.udp) udp++;
    });

    // Calculate total Flows just for context (or filter them if we want)
    const totalFlowsCount = store.getFlows().length;

    // Security Alerts HTML
    let alertsHtml = '';
    if (alerts && alerts.length > 0) {
        alertsHtml = `
            <div class="glass-panel" style="margin-top:1rem; border-color:var(--accent-warn);">
                <div style="font-size:0.8rem; color:var(--accent-warn); font-weight:700; margin-bottom:5px;">THREATS DETECTED (${alerts.length})</div>
                <div style="max-height:150px; overflow:auto; font-size:0.75rem;">
                    ${alerts.map(a => `<div style="margin-bottom:4px; padding-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.1); color:var(--text-secondary);">
                        <span style="color:var(--accent-danger)">${a.type}</span><br>
                        Src: ${a.source}
                    </div>`).join('')}
                </div>
            </div>
        `;
    }

    statsContainer.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:center;">
            <div class="glass-panel" style="padding:10px;">
                <div style="font-size:1.5rem; color:var(--text-primary); font-weight:700;">${packets.length.toLocaleString()}</div>
                <div style="font-size:0.7rem; color:var(--text-secondary);">PACKETS</div>
            </div>
            <div class="glass-panel" style="padding:10px;">
                <div style="font-size:1.5rem; color:var(--accent-blue); font-weight:700;">${totalFlowsCount.toLocaleString()}</div>
                <div style="font-size:0.7rem; color:var(--text-secondary);">TOTAL FLOWS</div>
            </div>
        </div>
        
        <div class="glass-panel" style="margin-top:1rem;">
             <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span style="font-size:0.8rem; color:var(--text-secondary);">TCP Traffic</span>
                <span style="font-size:0.8rem; color:var(--accent-cyan);">${Math.round(tcp / (packets.length || 1) * 100)}%</span>
             </div>
             <div style="width:100%; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                <div style="width:${Math.round(tcp / (packets.length || 1) * 100)}%; height:100%; background:var(--accent-cyan);"></div>
             </div>
        </div>

        ${alertsHtml}
    `;
}

function renderDetails(selected) {
    const container = document.getElementById('details-content');
    if (!selected) {
        container.innerHTML = '';
        return;
    }

    if (selected.type === 'node') {
        const id = selected.data.id;
        const hostname = store.getHostnames().get(id) || 'Unknown Host';
        container.innerHTML = `
            <div style="font-size:1.2rem; margin-bottom:0.5rem; color:white; font-family:var(--font-mono);">${id}</div>
            <div style="color:var(--accent-magenta); font-size:0.9rem; margin-bottom:1rem;">${hostname}</div>
            <div class="glass-panel">
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:5px;">Role</div>
                <div style="font-family:var(--font-mono); color:var(--accent-cyan);">${selected.data.type.toUpperCase()}</div>
            </div>
             <div class="glass-panel">
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:5px;">Traffic</div>
                <div>Sent: ${selected.data.value} bytes</div>
                <div>Connections: ${selected.data.connections}</div>
            </div>
        `;
    } else if (selected.type === 'link') {
        container.innerHTML = `
            <div style="font-size:1rem; margin-bottom:0.5rem; color:white;">Connection Details</div>
            <div style="color:var(--text-secondary); font-size:0.8rem; font-family:var(--font-mono);">
                ${selected.data.source.id} <br/> ↓ <br/> ${selected.data.target.id}
            </div>
        `;
    } else if (selected.type === 'packet') {
        const p = selected.data;

        let actions = '';
        if (p.tcp) {
            actions = `<button id="btn-follow" class="btn-neon" style="width:100%; margin-bottom:1rem;">Follow Stream</button>`;
        }

        container.innerHTML = `
            <div style="font-size:1rem; margin-bottom:0.5rem; color:white;">Packet #${p.index !== undefined ? p.index + 1 : '?'}</div>
            ${actions}
            <div class="glass-panel" style="font-family:var(--font-mono); font-size:0.8rem; overflow:auto;">
                 <div id="hex-view-container">Loading Hex...</div>
            </div>
            <!-- Raw JSON fallback -->
             <div class="glass-panel" style="font-family:var(--font-mono); font-size:0.7rem; margin-top:10px; opacity:0.6;">
                 <pre style="margin:0;">${JSON.stringify(p, null, 2)}</pre>
            </div>
        `;

        // Render Hex View
        const hexContainer = container.querySelector('#hex-view-container');
        if (hexContainer) renderHexView(p, hexContainer);

        // Bind Actions
        const btnFollow = container.querySelector('#btn-follow');
        if (btnFollow) {
            btnFollow.addEventListener('click', () => openStreamAnalysis(p));
        }
    }
}
