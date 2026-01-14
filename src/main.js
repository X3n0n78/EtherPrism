// Imports
import './style.css';
import { PcapParser } from './parser/pcap.js';
import { ProtocolParser, Protocols } from './parser/protocol.js';
import { renderNetworkGraph } from './visualizer/network_graph.js';

// State
const state = {
    file: null,
    packets: [],
    flows: new Map(), // Key: "SrcIP->DstIP", Value: { bytes, count }
    isProcessing: false
};

// Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');
const browseBtn = document.querySelector('.btn-browse');

// Event Listeners
if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', (e) => {
    // Prevent double trigger if clicking the button (which bubbles)
    if (e.target !== browseBtn) fileInput.click();
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length) handleFile(files[0]);
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
});

async function handleFile(file) {
    console.log('File dropped:', file.name);
    statusText.textContent = `Reading...`;
    statusDot.classList.add('active');

    try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        statusText.textContent = `Parsing ${(file.size / 1024 / 1024).toFixed(2)} MB...`;

        // Give UI a moment to update
        await new Promise(r => setTimeout(r, 50));

        const pcap = new PcapParser(arrayBuffer);
        const rawPackets = pcap.parse();

        console.log(`Parsed ${rawPackets.length} raw packets.Decoding layers...`);

        const flows = new Map();
        state.packets = [];

        // Analyze Packets
        rawPackets.forEach(raw => {
            const decoded = ProtocolParser.parse(raw.data);
            if (decoded.ip) {
                // Simple Flow Key: Src -> Dst
                const key = `${decoded.ip.src} -> ${decoded.ip.dst} `;

                if (!flows.has(key)) {
                    flows.set(key, {
                        source: decoded.ip.src,
                        target: decoded.ip.dst,
                        value: 0,
                        packets: 0
                    });
                }

                const flow = flows.get(key);
                flow.value += raw.length; // Add byte size
                flow.packets += 1;

                state.packets.push({ ...raw, ...decoded });
            }
        });

        console.log('Flows found:', flows);
        statusText.textContent = `Analysis Complete. Flows: ${flows.size} | Packets: ${state.packets.length}`;

        // Convert flows map to array for D3
        const flowData = Array.from(flows.values());
        renderVisualization(flowData);

    } catch (err) {
        console.error(err);
        statusText.textContent = 'Error: ' + err.message;
        statusDot.classList.add('error');
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

function renderVisualization(data) {
    console.log("Rendering Sankey with", data.length, "flows");
    const container = document.getElementById('visualization-container');
    container.classList.remove('hidden');
    document.getElementById('drop-zone').classList.add('hidden');

    // Check if we have data
    if (data.length === 0) {
        container.innerHTML = '<p style="text-align:center; margin-top: 20px;">No IP flows found in this capture.</p>';
        return;
    }

    // Render D3 Force Directed Graph
    renderNetworkGraph(data, 'visualization-container');
}
