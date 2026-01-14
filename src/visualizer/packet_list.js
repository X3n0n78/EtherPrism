import { renderHexView } from './hex_view.js';

export function renderPacketList(packets, containerId, allPackets = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Initial Setup (if first render or container cleared)
    // Avoid rebuilding static header if already exists
    let tbody = document.getElementById('packet-table-body');
    let scrollWrapper = container.querySelector('.packet-table-wrapper');

    if (!tbody || container.innerHTML === '') {
        container.innerHTML = `
            <div class="packet-list-container">
                <div class="packet-list-header">
                    <div style="font-weight:600; color:var(--text-primary)">Packet Capture</div>
                    <div class="packet-count" style="color:var(--text-secondary)">${packets.length.toLocaleString()} events</div>
                </div>
                <div class="packet-table-wrapper" style="overflow-y:auto; flex:1; position:relative;">
                    <table class="packet-table" style="position:absolute; top:0; left:0; width:100%;">
                        <thead>
                            <tr style="height:32px;"> 
                                <th style="width:60px">No.</th>
                                <th style="width:100px">Time</th>
                                <th style="width:140px">Source</th>
                                <th style="width:140px">Destination</th>
                                <th style="width:80px">Proto</th>
                                <th style="width:80px">Len</th>
                                <th>Info</th>
                            </tr>
                        </thead>
                        <tbody id="packet-table-body"></tbody>
                    </table>
                    <div id="virtual-scroller-spacer" style="width:1px;"></div>
                </div>
            </div>
        `;
        tbody = document.getElementById('packet-table-body');
        scrollWrapper = container.querySelector('.packet-table-wrapper');

        // Virtual Scroll Logic
        scrollWrapper.addEventListener('scroll', () => {
            renderVirtualRows(packets, tbody, scrollWrapper);
        });

        // Initial Render
        // Set spacer height
        const rowHeight = 32; // Approx px per row
        const totalHeight = packets.length * rowHeight;
        document.getElementById('virtual-scroller-spacer').style.height = `${totalHeight + 32}px`; // + header

        renderVirtualRows(packets, tbody, scrollWrapper);
    } else {
        // Just Update Data
        // Update count
        container.querySelector('.packet-count').textContent = `${packets.length.toLocaleString()} events`;

        const rowHeight = 32;
        const totalHeight = packets.length * rowHeight;
        document.getElementById('virtual-scroller-spacer').style.height = `${totalHeight + 32}px`;

        // If packets changed significantly, reset scroll? 
        // For now, keep scroll but re-render
        renderVirtualRows(packets, tbody, scrollWrapper);
    }
}

function renderVirtualRows(packets, tbody, scrollWrapper) {
    const rowHeight = 32;
    const viewportHeight = scrollWrapper.clientHeight;
    const scrollTop = scrollWrapper.scrollTop;

    // Calculate visible range
    let startIdx = Math.floor(scrollTop / rowHeight);
    let endIdx = Math.ceil((scrollTop + viewportHeight) / rowHeight);

    // Buffer
    startIdx = Math.max(0, startIdx - 10);
    endIdx = Math.min(packets.length, endIdx + 10);

    // Positioning
    const topOffset = startIdx * rowHeight;
    // We can translate the TBODY or use margin
    // Better: use absolute positioning for TRs? Or translate tbody?
    // Easy: Translate Tbody and clear/fill it.

    // But we have sticky headers.
    // The spacer defines the scroll height. The table is absolute 0,0.
    // We should move the table down to topOffset.
    const table = tbody.parentElement;
    // Header height is ~32px.
    // Actually, simple virtual scrolling pattern:
    // Spacer provides height.
    // Table is rendered at topOffset.

    // Reset tbody
    tbody.innerHTML = '';

    // Transform table to visually be at correct scroll position
    // Warning: TH is sticky, so changing table transform might break sticky.
    // Standard approach: Padding-top on table?

    // Let's rely on standard flow.
    // The spacer `virtual-scroller-spacer` is a sibling of `table`.
    // Wait, typical structure:
    // Wrapper (overflow:auto)
    //   -> Inner Container (Height = total)
    //      -> Visible Item Container (transform: translateY(startIdx * h))

    // Adaptation:
    // The spacer is already there. The table is absolute.
    table.style.transform = `translateY(${topOffset}px)`;

    const fragment = document.createDocumentFragment();

    for (let i = startIdx; i < endIdx; i++) {
        const packet = packets[i];
        if (!packet) continue;

        const tr = document.createElement('tr');
        tr.style.height = `${rowHeight}px`;
        tr.dataset.index = i;

        // Proto Class
        let proto = 'ETH';
        let protoClass = 'default';
        if (packet.tcp) { proto = 'TCP'; protoClass = 'proto-tcp'; }
        else if (packet.udp) { proto = 'UDP'; protoClass = 'proto-udp'; }
        else if (packet.icmp) { proto = 'ICMP'; protoClass = 'proto-icmp'; }
        else if (packet.app) { proto = packet.app.type; }

        // Info
        let info = '';
        if (packet.app) info = packet.app.info;
        else if (packet.tcp) {
            const flags = [];
            if (packet.tcp.syn) flags.push('SYN');
            if (packet.tcp.ack) flags.push('ACK');
            if (packet.tcp.fin) flags.push('FIN');
            if (packet.tcp.rst) flags.push('RST');
            info = `${packet.tcp.src_port} → ${packet.tcp.dst_port} [${flags.join(',')}] Seq=${packet.tcp.seq}`;
        } else if (packet.udp) {
            info = `${packet.udp.src_port} → ${packet.udp.dst_port} Len=${packet.udp.length}`;
        }

        // Truncate info
        if (info.length > 80) info = info.substring(0, 80) + '...';

        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${(packet.timestamp / 1000000).toFixed(6)}</td>
            <td>${packet.ip?.src || 'L2'}</td>
            <td>${packet.ip?.dst || 'L2'}</td>
            <td><span class="badge-proto ${protoClass}">${proto}</span></td>
            <td>${packet.length}</td>
            <td>${escapeHtml(info)}</td>
        `;

        tr.onclick = () => {
            // Update Visual Selection
            tbody.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            tr.classList.add('selected');
            window.dispatchEvent(new CustomEvent('packet-selected', { detail: packet }));
        };

        fragment.appendChild(tr);
    }

    tbody.appendChild(fragment);
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
