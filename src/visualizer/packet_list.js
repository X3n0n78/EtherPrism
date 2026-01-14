import { renderHexView } from './hex_view.js';

// State for Virtual Scroller
let state = {
    rowHeight: 32,
    buffer: 25, // Increased buffer for smoother scrolling
    poolSize: 0,
    viewportHeight: 0,
    scroller: null,
    spacer: null,
    listBody: null,
    pool: [], // Array of { el: div, index: -1 }
    packets: [],
    ticking: false,
    headerCreated: false
};

const COLUMNS = [
    { name: 'No.', width: '60px', flex: '0 0 60px' },
    { name: 'Time', width: '100px', flex: '0 0 100px' },
    { name: 'Source', flex: '1 1 150px' },
    { name: 'Destination', flex: '1 1 150px' },
    { name: 'Proto', width: '70px', flex: '0 0 70px' },
    { name: 'Len', width: '60px', flex: '0 0 60px' },
    { name: 'Info', flex: '2 1 300px' }
];

export function renderPacketList(packets, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Detect new dataset
    const isNewData = state.packets !== packets;
    state.packets = packets;

    // Initial DOM Setup (Run Once)
    if (!state.headerCreated || container.innerHTML === '') {
        console.log("[PacketList] Setup Container");
        setupContainer(container, packets.length);
        state.headerCreated = true;

        // Setup State Refs
        state.listBody = document.getElementById('packet-list-body');
        state.scroller = container.querySelector('.packet-list-scroller');
        state.spacer = document.getElementById('virtual-scroller-spacer');

        // Initialize Pool
        requestAnimationFrame(() => {
            initPool();
            updateMeta(container, packets.length);
            // On first load, scroll to top
            state.scroller.scrollTop = 0;
            render();
        });

        // Attach Listener
        state.scroller.addEventListener('scroll', onScroll, { passive: true });

        // Handle Resize
        const resizeObserver = new ResizeObserver(() => {
            // If height changes significantly, re-calc pool
            if (state.scroller.clientHeight !== state.viewportHeight) {
                initPool();
                render(); // Force render
            }
        });
        resizeObserver.observe(state.scroller);
    } else {
        // Just Update Data
        updateMeta(container, packets.length);

        if (isNewData) {
            // Force reset to top on new file
            state.scroller.scrollTop = 0;
        }

        requestAnimationFrame(render);
    }
}

function setupContainer(container, count) {
    // Generate Header HTML
    const headerCells = COLUMNS.map(col => `
        <div style="flex: ${col.flex}; padding: 0 8px; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden;">${col.name}</div>
    `).join('');

    container.innerHTML = `
        <div class="packet-list-container" style="display:flex; flex-direction:column; height:100%; min-height:0; overflow:hidden; position:relative;">
            <div class="packet-list-meta" style="flex: 0 0 auto; padding: 8px 16px; display:flex; justify-content:space-between; align-items:center; background:var(--bg-panel);">
                <div style="font-weight:600; color:var(--text-primary)">Packet Capture</div>
                <div class="packet-count" style="color:var(--text-secondary); font-variant-numeric: tabular-nums;">${count.toLocaleString()} events</div>
            </div>
            
            <!-- Header Row -->
            <div class="packet-list-header-row" style="flex: 0 0 36px; display:flex; align-items:center; background: var(--bg-header); border-bottom: 1px solid var(--border-subtle); padding-right:6px; font-size:0.8rem;">
                ${headerCells}
            </div>

            <!-- Scrollable Body with Anchor Locking Disabled -->
            <div class="packet-list-scroller" style="flex:1 1 auto; height:0; min-height:0; overflow-y:auto; overflow-anchor: none; position:relative; will-change: transform;">
                <!-- Spacer -->
                <div id="virtual-scroller-spacer" style="height:1px; width:1px;"></div>
                
                <!-- Absolute Container for Rows -->
                <div id="packet-list-body" style="position:absolute; top:0; left:0; width:100%;"></div>
            </div>
        </div>
    `;
}

function updateMeta(container, count) {
    const meta = container.querySelector('.packet-count');
    if (meta) meta.textContent = `${count.toLocaleString()} events`;

    // Update Spacer Height
    if (state.spacer) {
        const totalH = count * state.rowHeight;
        state.spacer.style.height = `${totalH}px`;
    }
}

function initPool() {
    state.viewportHeight = state.scroller.clientHeight;

    // Safety check: force large viewport assumption if detection fails
    if (!state.viewportHeight || state.viewportHeight < 100) {
        state.viewportHeight = 1000;
    }

    const visibleCount = Math.ceil(state.viewportHeight / state.rowHeight);
    // Large buffer to prevent black gaps on fast scroll
    const needed = visibleCount + (state.buffer * 2);

    // console.log(`[PacketList] Init Pool: Viewport=${state.viewportHeight}px, Needed=${needed}`);

    // Check if we need to expand pool
    if (state.pool.length < needed) {
        const fragment = document.createDocumentFragment();
        const start = state.pool.length;
        // Ensure minimal pool size (e.g. at least 60 rows) to be safe
        const safeNeeded = Math.max(needed, 60);

        for (let i = start; i < safeNeeded; i++) {
            const row = document.createElement('div');
            row.className = 'packet-row';
            row.style.cssText = `
                position: absolute;
                top: -500px;
                left: 0; width: 100%;
                height: ${state.rowHeight}px;
                display: flex;
                align-items: center;
                border-bottom: 1px solid var(--border-subtle);
                font-size: 0.85rem;
                cursor: pointer;
                background: var(--bg-panel);
                will-change: transform;
            `;

            // Create Cells
            COLUMNS.forEach((col, idx) => {
                const cell = document.createElement('div');
                cell.style.cssText = `
                    flex: ${col.flex};
                    padding: 0 8px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                `;
                row.appendChild(cell);
            });

            row.onclick = () => handleRowClick(row);

            fragment.appendChild(row);
            state.pool.push({ el: row, index: -1, visible: false });
        }
        state.listBody.appendChild(fragment);
        state.poolSize = state.pool.length;
    }
}

function onScroll() {
    if (!state.ticking) {
        requestAnimationFrame(() => {
            render();
            state.ticking = false;
        });
        state.ticking = true;
    }
}

function render() {
    const scrollTop = state.scroller.scrollTop;
    const viewportH = state.scroller.clientHeight || state.viewportHeight || 1000;

    // Determine range
    const startIdx = Math.floor(scrollTop / state.rowHeight);
    const endIdx = Math.ceil((scrollTop + viewportH) / state.rowHeight);

    // Buffer
    const bufferStart = Math.max(0, startIdx - state.buffer);
    const bufferEnd = Math.min(state.packets.length, endIdx + state.buffer);

    // Render Loop
    for (let i = bufferStart; i < bufferEnd; i++) {
        const poolIndex = i % state.poolSize;
        const node = state.pool[poolIndex];

        if (node) {
            updateRow(node, i);
        }
    }
}

function updateRow(node, dataIndex) {
    const packet = state.packets[dataIndex];
    if (!packet) return;

    // Optimization: Skip valid
    if (node.index === dataIndex && node.visible) return;

    const row = node.el;

    // Position
    const top = dataIndex * state.rowHeight;
    row.style.transform = `translateY(${top}px)`;
    row.style.top = '0px'; // CRITICAL FIX: Reset the init -500px offset
    row.style.display = 'flex'; // Ensure visible

    node.index = dataIndex;
    node.visible = true;

    const cells = row.children;

    // 0: No
    cells[0].textContent = dataIndex + 1;
    // 1: Time
    cells[1].textContent = (packet.timestamp / 1000000).toFixed(6);
    // 2: Src
    cells[2].textContent = packet.ip?.src || 'L2';
    cells[2].title = packet.ip?.src || '';
    // 3: Dst
    cells[3].textContent = packet.ip?.dst || 'L2';
    cells[3].title = packet.ip?.dst || '';

    // 4: Proto
    const [proto, cls] = getProtoBadge(packet);
    if (cells[4].textContent !== proto) {
        cells[4].innerHTML = `<span class="badge ${cls}">${proto}</span>`;
    }

    // 5: Len
    cells[5].textContent = packet.length ?? packet.len ?? 0;

    // 6: Info
    const info = getInfoText(packet);
    cells[6].textContent = info;
    cells[6].title = info;

    // Selection
    if (row.classList.contains('selected')) {
        row.classList.remove('selected');
    }
}

function handleRowClick(row) {
    const idx = parseInt(row.children[0].textContent) - 1;
    const packet = state.packets[idx];

    if (packet) {
        state.pool.forEach(n => n.el.classList.remove('selected'));
        row.classList.add('selected');
        window.dispatchEvent(new CustomEvent('packet-selected', { detail: packet }));
    }
}

// Helpers
function getProtoBadge(p) {
    if (p.tcp) return ['TCP', 'badge-tcp'];
    if (p.udp) return ['UDP', 'badge-udp'];
    if (p.icmp) return ['ICMP', 'badge-severe'];
    if (p.app) return [p.app.type, 'badge-tcp'];
    return ['ETH', 'badge-secondary'];
}

function getInfoText(p) {
    if (p.app) return p.app.info;
    if (p.tcp) return `${p.tcp.src_port} → ${p.tcp.dst_port} Seq=${p.tcp.seq}`;
    if (p.udp) return `${p.udp.src_port} → ${p.udp.dst_port} Len=${p.udp.length}`;
    if (p.icmp) return `Type: ${p.icmp.type}`;
    return 'Ethernet Frame';
}
