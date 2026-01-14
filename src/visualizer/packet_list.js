export function renderPacketList(packets, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear and setup structure
    container.innerHTML = `
        <div class="packet-list-header">
            <input type="text" id="packet-filter" placeholder="Filter packets..." class="packet-filter">
            <span class="packet-count">${packets.length} packets</span>
        </div>
        <div class="packet-table-wrapper">
            <table class="packet-table">
                <thead>
                    <tr>
                        <th style="width: 60px">#</th>
                        <th style="width: 80px">Time</th>
                        <th style="width: 120px">Source</th>
                        <th style="width: 120px">Dest</th>
                        <th style="width: 60px">Proto</th>
                        <th>Info</th>
                    </tr>
                </thead>
                <tbody id="packet-table-body"></tbody>
            </table>
        </div>
        <div id="packet-detail-view" class="packet-detail-view hidden">
            <!-- Hex/Detail view goes here -->
        </div>
    `;

    const tbody = document.getElementById('packet-table-body');
    const detailView = document.getElementById('packet-detail-view');

    // Render Rows (Virtualization might be needed for huge lists, 
    // but for single flow < 1000 items simple DOM is fine)
    const fragment = document.createDocumentFragment();

    packets.forEach((packet, index) => {
        const tr = document.createElement('tr');
        tr.className = 'packet-row';

        // Determine protocol string
        let proto = 'ETH';
        if (packet.tcp) proto = 'TCP';
        else if (packet.udp) proto = 'UDP';
        else if (packet.icmp) proto = 'ICMP';
        else if (packet.imgp) proto = 'IGMP';

        // Format Info
        let info = `${packet.length} bytes`;
        if (packet.app) {
            info = `${packet.app.type} ${packet.app.info}`;
        } else if (packet.tcp) {
            const flags = [];
            if (packet.tcp.syn) flags.push('SYN');
            if (packet.tcp.ack) flags.push('ACK');
            if (packet.tcp.fin) flags.push('FIN');
            if (packet.tcp.rst) flags.push('RST');
            if (packet.tcp.psh) flags.push('PSH');
            info = `${packet.tcp.src_port} → ${packet.tcp.dst_port} [${flags.join(', ')}] Seq=${packet.tcp.seq}`;
        } else if (packet.udp) {
            info = `${packet.udp.src_port} → ${packet.udp.dst_port}`;
        }

        // Timestamp relative to first packet in global capture? 
        // Or just absolute. Let's use simple generic timestamp for now or index.
        // If we had capture start time we could do relative.
        const timeStr = (packet.timestamp / 1000000).toFixed(4); // assuming microseconds

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td class="mono">${timeStr}</td>
            <td class="mono">${packet.ip?.src || 'L2'}</td>
            <td class="mono">${packet.ip?.dst || 'L2'}</td>
            <td><span class="badge proto-${proto.toLowerCase()}">${proto}</span></td>
            <td class="info-cell" title="${info}">${info}</td>
        `;

        tr.onclick = () => {
            document.querySelectorAll('.packet-row.selected').forEach(r => r.classList.remove('selected'));
            tr.classList.add('selected');
            showPacketDetails(packet, detailView);
        };

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);

    // Simple Filter Logic
    const filterInput = document.getElementById('packet-filter');
    filterInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    });
}

function showPacketDetails(packet, container) {
    container.classList.remove('hidden');

    // Generate a simple hex dump view approx
    // Since we only have decoded data + raw ArrayBuffer slice if we kept it.
    // In current main.js architecture we might not be keeping raw payload fully in memory for all packets
    // to save RAM? Let's check. state.packets usually has it.

    // For now, render the JSON structure beautifully

    let content = '<div class="detail-header">Packet Details <button onclick="this.parentElement.parentElement.classList.add(\'hidden\')">×</button></div>';
    content += '<div class="detail-content"><pre class="json-view">';
    content += syntaxHighlight(JSON.stringify(packet, null, 2));
    content += '</pre></div>';

    container.innerHTML = content;
}

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}
