import { renderHexView } from './hex_view.js';

export function renderPacketList(packets, containerId, allPackets = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Structure
    container.innerHTML = `
        <div class="packet-list-container">
            <div class="packet-list-header">
                <div style="font-weight:600; color:var(--text-primary)">Packet Capture</div>
                <div class="packet-count" style="color:var(--text-secondary)">${packets.length.toLocaleString()} events</div>
            </div>
            <div class="packet-table-wrapper">
                <table class="packet-table">
                    <thead>
                        <tr>
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
            </div>
        </div>
    `;

    const tbody = document.getElementById('packet-table-body');
    const fragment = document.createDocumentFragment();

    // Render limit for performance (virtual scrolling would be better for >10k)
    const renderLimit = Math.min(packets.length, 2000);

    for (let i = 0; i < renderLimit; i++) {
        const packet = packets[i];
        const tr = document.createElement('tr');
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

        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${(packet.timestamp / 1000000).toFixed(6)}</td>
            <td>${packet.ip?.src || 'L2'}</td>
            <td>${packet.ip?.dst || 'L2'}</td>
            <td><span class="badge-proto ${protoClass}">${proto}</span></td>
            <td>${packet.length}</td>
            <td style="max-width:400px; overflow:hidden; text-overflow:ellipsis;">${info}</td>
        `;

        tr.onclick = () => {
            // Dispatch event to main store via CustomEvent or Callback
            // Ideally we shouldn't modify store directly from here without importing it, 
            // but 'selection' is handled by the caller usually?
            // For this impl, we'll mark selected visually and let the main app handle it via a new mechanism
            // OR assume we can emit an event.

            // Update Visual Selection
            tbody.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            tr.classList.add('selected');

            // HACK: Dispatch global event for now to avoid circular dependencies if we imported store
            // But actually we can just accept a callback in arguments (TODO for later)
            // Using CustomEvent
            window.dispatchEvent(new CustomEvent('packet-selected', { detail: packet }));
        };

        fragment.appendChild(tr);
    }

    tbody.appendChild(fragment);

    if (packets.length > renderLimit) {
        const warning = document.createElement('tr');
        warning.innerHTML = `<td colspan="7" style="text-align:center; padding:1rem; color:var(--text-muted)">... ${packets.length - renderLimit} mode packets hidden (Performance Limit) ...</td>`;
        tbody.appendChild(warning);
    }
}

