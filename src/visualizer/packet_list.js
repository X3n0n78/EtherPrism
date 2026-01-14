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
            <div class="packet-list-container" style="display:flex; flex-direction:column; height:100%;">
                <div class="packet-list-header">
                    <div style="font-weight:600; color:var(--text-primary)">Packet Capture</div>
                    <div class="packet-count" style="color:var(--text-secondary)">${packets.length.toLocaleString()} events</div>
                </div>
                
                <!-- Fixed Table Header -->
                <div class="packet-table-header-row" style="padding-right: 6px; background: var(--bg-header); border-bottom: 1px solid var(--border-subtle); z-index: 10;">
                     <table style="width:100%; table-layout: fixed; border-collapse: collapse;">
                        <thead>
                            <tr style="height:36px; color:var(--text-secondary); text-align:left; font-size: 0.8rem;"> 
                                <th style="width:60px; padding:0 12px; font-weight:600; color:var(--text-primary);">No.</th>
                                <th style="width:140px; padding:0 12px; font-weight:600; color:var(--text-primary);">Time</th>
                                <th style="width:200px; padding:0 12px; font-weight:600; color:var(--text-primary);">Source</th>
                                <th style="width:200px; padding:0 12px; font-weight:600; color:var(--text-primary);">Destination</th>
                                <th style="width:80px; padding:0 12px; font-weight:600; color:var(--text-primary);">Proto</th>
                                <th style="width:80px; padding:0 12px; font-weight:600; color:var(--text-primary);">Len</th>
                                <th style="padding:0 12px; font-weight:600; color:var(--text-primary);">Info</th>
                            </tr>
                        </thead>
                     </table>
                </div>

                <!-- Scrollable Body -->
                <div class="packet-table-wrapper" style="overflow-y:auto; flex:1; position:relative;">
                    <div id="virtual-scroller-spacer" style="width:1px;"></div>
                    <table class="packet-table" style="position:absolute; top:0; left:0; width:100%; table-layout: fixed; border-collapse: collapse;">
                        <!-- Hidden header for sizing alignment - Ensures columns match visual header -->
                        <thead style="visibility:hidden; height:0; line-height:0; pointer-events:none;">
                             <tr style="height:0;"> 
                                <th style="width:60px; padding:0 8px; border:none; height:0;"></th>
                                <th style="width:140px; padding:0 8px; border:none; height:0;"></th>
                                <th style="width:200px; padding:0 8px; border:none; height:0;"></th>
                                <th style="width:200px; padding:0 8px; border:none; height:0;"></th>
                                <th style="width:80px; padding:0 8px; border:none; height:0;"></th>
                                <th style="width:80px; padding:0 8px; border:none; height:0;"></th>
                                <th style="padding:0 8px; border:none; height:0;"></th>
                            </tr>
                        </thead>
                        <tbody id="packet-table-body"></tbody>
                    </table>
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
        document.getElementById('virtual-scroller-spacer').style.height = `${totalHeight}px`;

        renderVirtualRows(packets, tbody, scrollWrapper);
    } else {
        // Just Update Data
        // Update count
        container.querySelector('.packet-count').textContent = `${packets.length.toLocaleString()} events`;

        const rowHeight = 32;
        const totalHeight = packets.length * rowHeight;
        document.getElementById('virtual-scroller-spacer').style.height = `${totalHeight}px`;

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

    const table = tbody.parentElement;
    table.style.transform = `translateY(${topOffset}px)`;

    // Reset tbody
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();

    for (let i = startIdx; i < endIdx; i++) {
        const packet = packets[i];
        if (!packet) continue;

        const tr = document.createElement('tr');
        tr.style.height = `${rowHeight}px`;
        tr.dataset.index = i;

        // Proto Class
        let proto = 'ETH';
        let protoClass = 'badge-secondary'; // default
        if (packet.tcp) { proto = 'TCP'; protoClass = 'badge-tcp'; }
        else if (packet.udp) { proto = 'UDP'; protoClass = 'badge-udp'; }
        else if (packet.icmp) { proto = 'ICMP'; protoClass = 'badge-severe'; }
        else if (packet.app) { proto = packet.app.type; protoClass = 'badge-tcp'; }

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

        const cellStyle = "white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:0;";

        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${(packet.timestamp / 1000000).toFixed(6)}</td>
            <td style="${cellStyle}" title="${packet.ip?.src || 'L2'}">${packet.ip?.src || 'L2'}</td>
            <td style="${cellStyle}" title="${packet.ip?.dst || 'L2'}">${packet.ip?.dst || 'L2'}</td>
            <td><span class="badge ${protoClass}">${proto}</span></td>
            <td>${packet.length ?? packet.len ?? 0}</td>
            <td style="${cellStyle}" title="${escapeHtml(info)}">${escapeHtml(info)}</td>
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
