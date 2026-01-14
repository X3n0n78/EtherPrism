import './style.css';
import * as d3 from 'd3';
import { store } from './core/store.js';
import { bus } from './core/event_bus.js';
import { renderNetworkGraphGL } from './visualizer/network_graph_gl.js';
// View State
let currentView = 'graph'; // 'graph' or 'list'

import { renderPacketList } from './visualizer/packet_list.js';
import { renderTimeline } from './visualizer/timeline.js';

import { renderDetailsPanel, clearDetailsHistory } from './visualizer/details_panel.js';

window.onerror = function (msg, url, lineNo, columnNo, error) {
    console.error(`Global System Error: ${msg}\nLine: ${lineNo}\nCol: ${columnNo}\nError: ${error}`);
    const statusBadge = document.getElementById('app-status');
    if (statusBadge) {
        statusBadge.querySelector('span').nextSibling.textContent = ` Error: ${msg}`;
        statusBadge.classList.add('processing');
        statusBadge.querySelector('.status-dot').style.color = 'var(--accent-danger)';
    }
    return false;
};
window.onunhandledrejection = function (event) {
    console.error(`Unhandled Promise Rejection: ${event.reason}`);
};
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
    // iterate childNodes to find the text node (nodeType 3)
    let textNode = null;
    statusBadge.childNodes.forEach(node => {
        if (node.nodeType === 3 && node.textContent.trim().length > 0) {
            textNode = node;
        }
    });

    // If no text node found (e.g. initial state might be clean), append one
    if (!textNode) {
        textNode = document.createTextNode(` ${msg}`);
        statusBadge.appendChild(textNode);
    } else {
        textNode.textContent = ` ${msg}`;
    }

    // Simple pulse effect based on msg content
    if (msg.includes('Reading') || msg.includes('Processing')) {
        statusBadge.classList.add('processing');
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
    // If a node is selected, re-render the app to filter the packet list
    // If a packet is selected, we just show details

    if (store.state.selection?.type === 'node') {
        const id = store.state.selection.data.id;
        // Logic to filter list or just highlight
    }

    // Details Panel is now permanent
    renderDetails(selected);

    if (!selected) {
        // If selection cleared, also re-render to remove filter from list/graph
        renderApp();
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
        if (currentStreamData) {
            streamContent.style.whiteSpace = 'pre-wrap';
            streamContent.textContent = currentStreamData.text;
        }
    });


}

if (btnTabHtml) {
    btnTabHtml.addEventListener('click', () => {
        btnTabHtml.classList.add('active');
        btnTabAscii.classList.remove('active');
        if (currentStreamData) {
            streamContent.innerHTML = currentStreamData.html;
        } else {
            streamContent.textContent = "No data selected.";
        }
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
        bus.emit('status:updated', "Stream Analysis Failed");
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
        }
    });

    // Set active
    let activeBtn;
    if (view === 'graph') activeBtn = btnViewGraph;
    else if (view === 'list') activeBtn = btnViewList;
    else if (view === 'map') activeBtn = btnViewMap;

    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    renderApp();
}

// File Handling
if (btnImport) btnImport.addEventListener('click', () => fileInput.click());
const btnBrowseMain = document.getElementById('btn-browse-main');
if (btnBrowseMain) btnBrowseMain.addEventListener('click', () => fileInput.click());
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
    document.getElementById('details-panel').classList.add('collapsed');
});


// --- Helper Functions ---

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

// --- Core Logic ---

async function handleFileSelect(file) {
    if (!file) return;

    try {
        const dot = statusBadge.querySelector('.status-dot');
        statusBadge.classList.add('processing');
        if (dot) dot.style.color = 'var(--accent-primary)';

        // Notify user
        bus.emit('status:updated', `Reading ${file.name}...`);

        store.setFile(file); // Keep this line from original
        const arrayBuffer = await readFileAsArrayBuffer(file); // Await the promise

        // Dynamic import of worker to ensure path correctness
        const workerUrl = new URL('./worker/pcap.worker.js', import.meta.url);
        const worker = new Worker(workerUrl, { type: 'module' });

        worker.postMessage({ buffer: arrayBuffer }, [arrayBuffer]);

        worker.onmessage = (e) => {
            try {
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
            } catch (err) {
                console.error("Worker Handler Error:", err);
                bus.emit('status:updated', "Render Err: " + err.message);
            }
        };

    } catch (err) {
        console.error(err);
        bus.emit('status:updated', 'Error loading file');
    }
}



function renderApp() {
    try {
        console.log("renderApp() triggered");
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

        // Apply Node Selection Filter (Graph Focus)
        const selectedNode = store.state.selection?.type === 'node' ? store.state.selection.data : null;
        if (selectedNode) {
            if (activePackets.length > 0) {
                activePackets = activePackets.filter(p => {
                    if (!p.ip) return false;
                    // Check if source or dest matches the selected node ID
                    return (p.ip.src === selectedNode.id || p.ip.dst === selectedNode.id);
                });
            }
        }

        // Run Security Scan
        const alerts = SecurityEngine.scan(activePackets);

        if (currentView === 'graph') {
            const flows = store.getFlows().filter(f => {
                const hidden = store.getHiddenNodes().has(f.source) || store.getHiddenNodes().has(f.target);
                if (hidden) return false;

                // If focused, we could filter graph too, but visualizer handles dimming.
                // Packet list handles the data filtering.
                return true;
            });

            renderNetworkGraphGL(flows, 'visualization-container',
                (type, data) => store.updateSelection(type, data),
                (id) => store.hideNode(id),
                selectedNode // Pass current selection for sync
            );
        } else if (currentView === 'map') {
            renderGeoMap(activePackets, 'visualization-container');
        } else {
            renderPacketList(activePackets, 'visualization-container', packets);
        }

        // Render Timeline
        // Use visible 'packets' (filtered by global search if we want, but usually Global Timeline = ALL packets)
        // Let's use ALL packets (packets variable) to maintain context.
        renderTimeline(packets, 'timeline-container', (start, end) => {
            store.updateTimeFilter(start, end);
        }, store.state.filter.timeStart, store.state.filter.timeEnd);

        // Update Sidebar Stats
        updateSidebarStats(activePackets, alerts);

    } catch (e) {
        console.error("Render Failure", e);
        bus.emit('status:updated', "Render Failure");
    }
}

function updateSidebarStats(packets, alerts = []) {
    const container = document.getElementById('sidebar-stats');
    if (!container) return;

    // Clear previous
    container.innerHTML = '';

    if (!packets || packets.length === 0) {
        container.innerHTML = '<div class="empty-state">No Data</div>';
        return;
    }

    // --- Data Processing ---
    const totalPackets = packets.length;

    // Protocol Counts
    const protocols = { TCP: 0, UDP: 0, ICMP: 0, Other: 0 };
    packets.forEach(p => {
        if (p.tcp) protocols.TCP++;
        else if (p.udp) protocols.UDP++;
        else if (p.icmp) protocols.ICMP++;
        else protocols.Other++;
    });

    // Alert Count
    const totalAlerts = alerts.length;

    // --- Render Stats Cards ---

    // 1. Total Packets (Big Number)
    const cardTotal = document.createElement('div');
    cardTotal.className = 'stat-card';
    cardTotal.innerHTML = `
        <div class="stat-label">TOTAL PACKETS</div>
        <div class="stat-value" style="color:var(--accent-primary);">${totalPackets.toLocaleString()}</div>
    `;
    container.appendChild(cardTotal);

    // 2. Protocol Distribution (Donut Chart)
    const cardProto = document.createElement('div');
    cardProto.className = 'stat-card';
    cardProto.style.marginTop = '1rem';
    cardProto.innerHTML = `<div class="stat-label" style="margin-bottom:8px;">PROTOCOL MIX</div>`;

    const chartContainer = document.createElement('div');
    chartContainer.style.height = '120px'; // fixed height for chart
    chartContainer.style.position = 'relative';
    cardProto.appendChild(chartContainer);
    container.appendChild(cardProto);

    // Render Chart using D3
    renderSidebarDonut(chartContainer, protocols);

    // 3. Security Alerts (if any)
    if (totalAlerts > 0) {
        const cardAlerts = document.createElement('div');
        cardAlerts.className = 'stat-card';
        cardAlerts.style.marginTop = '1rem';
        cardAlerts.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        cardAlerts.innerHTML = `
            <div class="stat-label" style="color:var(--accent-danger);">THREAT DETECTED</div>
            <div class="stat-value" style="color:var(--accent-danger);">${totalAlerts} <span style="font-size:0.8rem; font-weight:400;">EVENTS</span></div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">${alerts[0].type}</div>
        `;
        container.appendChild(cardAlerts);
    }
}

function renderSidebarDonut(element, data) {
    const width = element.clientWidth || 200;
    const height = 120;
    const radius = Math.min(width, height) / 2;

    const svg = d3.select(element)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    const color = d3.scaleOrdinal()
        .domain(["TCP", "UDP", "ICMP", "Other"])
        .range(["#3b82f6", "#10b981", "#f59e0b", "#64748b"]);

    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    const dataReady = pie(Object.entries(data).map(([key, value]) => ({ key, value })));

    const arc = d3.arc()
        .innerRadius(radius * 0.6)
        .outerRadius(radius * 0.9);

    svg.selectAll('allSlices')
        .data(dataReady)
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.key))
        .attr("stroke", "var(--bg-card)")
        .style("stroke-width", "2px")
        .style("opacity", 0.9);

    // Center Text
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.3em")
        .style("font-size", "0.8rem")
        .style("fill", "var(--text-primary)")
        .style("font-family", "var(--font-mono)")
        .text(total > 1000 ? (total / 1000).toFixed(1) + 'k' : total);
}

function renderDetails(selected) {
    renderDetailsPanel(selected, 'details-content');
}


