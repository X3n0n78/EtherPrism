import './style.css';
import { store } from './core/store.js';
import { bus } from './core/event_bus.js';
import { renderNetworkGraph } from './visualizer/network_graph.js';
// View State
let currentView = 'graph'; // 'graph' or 'list'

import { renderPacketList } from './visualizer/packet_list.js';
import { renderTimeline } from './visualizer/timeline.js';

// --- Initialization ---
console.log('EtherPrism Nexus Initializing...');

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const btnImport = document.getElementById('btn-import');
const btnCloseDetails = document.getElementById('btn-close-details');
const detailsPanel = document.getElementById('details-panel');
const statusBadge = document.getElementById('app-status');

// View Toggles
const btnViewGraph = document.getElementById('btn-view-graph');
const btnViewList = document.getElementById('btn-view-list');

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

// Packet Selected Event (from packet list)
window.addEventListener('packet-selected', (e) => {
    // console.log("Packet Selected", e.detail);
    store.updateSelection('packet', e.detail);
});


// --- User Interaction ---

// View Switching
btnViewGraph.addEventListener('click', () => switchView('graph'));
btnViewList.addEventListener('click', () => switchView('list'));

function switchView(view) {
    currentView = view;
    // Update Buttons
    if (view === 'graph') {
        btnViewGraph.classList.add('active');
        btnViewGraph.style.opacity = '1';
        btnViewGraph.style.background = 'rgba(34, 211, 238, 0.1)';
        btnViewList.classList.remove('active');
        btnViewList.style.opacity = '0.7';
        btnViewList.style.background = 'transparent';
    } else {
        btnViewList.classList.add('active');
        btnViewList.style.opacity = '1';
        btnViewList.style.background = 'rgba(34, 211, 238, 0.1)';
        btnViewGraph.classList.remove('active');
        btnViewGraph.style.opacity = '0.7';
        btnViewGraph.style.background = 'transparent';
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

    // Reuse existing worker logic from store/main (simplified here for now)
    // For this plan, we'll try to reuse the existing Worker infrastructure but call it from here
    // or instantiate it directly.
    // To match the plan, we should refactor PCAP logic, but for immediate UI wiring, let's reuse the Worker method.

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

    // Apply Filters (Basic Time Filter)
    let activePackets = packets;
    if (store.state.filter.timeStart) {
        activePackets = packets.filter(p => p.timestamp >= store.state.filter.timeStart && p.timestamp <= store.state.filter.timeEnd);
    }

    if (currentView === 'graph') {
        const flows = store.getFlows().filter(f => !store.getHiddenNodes().has(f.source) && !store.getHiddenNodes().has(f.target));
        renderNetworkGraph(flows, 'visualization-container',
            (type, data) => store.updateSelection(type, data),
            (id) => store.hideNode(id)
        );
    } else {
        renderPacketList(activePackets, 'visualization-container', packets);
    }

    // Render Timeline
    renderTimeline(activePackets, 'timeline-container', (start, end) => {
        store.updateTimeFilter(start, end);
    });

    // Update Sidebar Stats
    updateSidebarStats();
}

function updateSidebarStats() {
    const flows = store.getFlows();
    const packets = store.getPackets();
    const statsContainer = document.getElementById('sidebar-stats');

    let tcp = 0, udp = 0;
    packets.forEach(p => {
        if (p.tcp) tcp++;
        if (p.udp) udp++;
    });

    statsContainer.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:center;">
            <div class="glass-panel" style="padding:10px;">
                <div style="font-size:1.5rem; color:var(--text-primary); font-weight:700;">${packets.length.toLocaleString()}</div>
                <div style="font-size:0.7rem; color:var(--text-secondary);">PACKETS</div>
            </div>
            <div class="glass-panel" style="padding:10px;">
                <div style="font-size:1.5rem; color:var(--accent-blue); font-weight:700;">${flows.length.toLocaleString()}</div>
                <div style="font-size:0.7rem; color:var(--text-secondary);">FLOWS</div>
            </div>
        </div>
        
        <div class="glass-panel" style="margin-top:1rem;">
             <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span style="font-size:0.8rem; color:var(--text-secondary);">TCP Traffic</span>
                <span style="font-size:0.8rem; color:var(--accent-cyan);">${Math.round(tcp / packets.length * 100)}%</span>
             </div>
             <div style="width:100%; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                <div style="width:${Math.round(tcp / packets.length * 100)}%; height:100%; background:var(--accent-cyan);"></div>
             </div>
        </div>
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
        container.innerHTML = `
            <div style="font-size:1rem; margin-bottom:0.5rem; color:white;">Packet #${p.index !== undefined ? p.index + 1 : '?'}</div>
            <div class="glass-panel" style="font-family:var(--font-mono); font-size:0.8rem; overflow:auto;">
                <pre style="margin:0; color:var(--accent-cyan);">${JSON.stringify(p, null, 2)}</pre>
            </div>
        `;
    }
}
