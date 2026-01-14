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
                        <th style="width: 50px">#</th>
                        <th style="width: 70px">Time</th>
                        <th style="width: 110px">Source</th>
                        <th style="width: 110px">Dest</th>
                        <th style="width: 50px">Proto</th>
                        <th style="width: 50px">Len</th>
                        <th>Info</th>
                    </tr>
                </thead>
                <tbody id="packet-table-body"></tbody>
            </table>
        </div>
    `;

    const tbody = document.getElementById('packet-table-body');

    const fragment = document.createDocumentFragment();

    packets.forEach((packet, index) => {
        const tr = document.createElement('tr');
        tr.className = 'packet-row';
        tr.dataset.index = index;

        // Determine protocol string
        let proto = 'ETH';
        if (packet.tcp) proto = 'TCP';
        else if (packet.udp) proto = 'UDP';
        else if (packet.icmp) proto = 'ICMP';
        else if (packet.imgp) proto = 'IGMP';

        // Format Info
        let info = ``;
        if (packet.app) {
            info = `${packet.app.type} ${packet.app.info}`;
        } else if (packet.tcp) {
            const flags = [];
            if (packet.tcp.syn) flags.push('S');
            if (packet.tcp.ack) flags.push('A');
            if (packet.tcp.fin) flags.push('F');
            if (packet.tcp.rst) flags.push('R');
            if (packet.tcp.psh) flags.push('P');
            info = `${packet.tcp.src_port}→${packet.tcp.dst_port} [${flags.join('')}] Seq=${packet.tcp.seq} Win=${packet.tcp.window_size}`;
        } else if (packet.udp) {
            info = `${packet.udp.src_port}→${packet.udp.dst_port} Len=${packet.udp.length}`;
        }

        if (packet.ip) {
            info += ` (TTL=${packet.ip.ttl})`;
        }

        const timeStr = (packet.timestamp / 1000000).toFixed(4);

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td class="mono">${timeStr}</td>
            <td class="mono">${packet.ip?.src || 'L2'}</td>
            <td class="mono">${packet.ip?.dst || 'L2'}</td>
            <td><span class="badge proto-${proto.toLowerCase()}">${proto}</span></td>
            <td class="mono" style="text-align: right">${packet.length}</td>
            <td class="info-cell" title="${info}">${info}</td>
        `;

        tr.onclick = (e) => {
            // Check if already expanded
            const nextRow = tr.nextSibling;
            if (nextRow && nextRow.classList.contains('packet-detail-row')) {
                nextRow.remove();
                tr.classList.remove('selected');
                return;
            }

            // Close other expansions
            document.querySelectorAll('.packet-detail-row').forEach(row => {
                row.previousSibling.classList.remove('selected');
                row.remove();
            });

            tr.classList.add('selected');

            // Create expansion row
            const detailRow = document.createElement('tr');
            detailRow.className = 'packet-detail-row';
            const detailCell = document.createElement('td');
            detailCell.colSpan = 7;

            // Render JSON content
            detailCell.innerHTML = `
                <div class="packet-detail-content">
                    <pre class="json-view">${syntaxHighlight(JSON.stringify(packet, null, 2))}</pre>
                </div>
            `;

            detailRow.appendChild(detailCell);

            // Insert after current row
            if (tr.nextSibling) {
                tbody.insertBefore(detailRow, tr.nextSibling);
            } else {
                tbody.appendChild(detailRow);
            }
        };

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);

    // Simple Filter Logic (rest stays same)
    const filterInput = document.getElementById('packet-filter');
    filterInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const rows = tbody.querySelectorAll('tr.packet-row');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
            // Hide detail row if parent is hidden
            if (row.style.display === 'none' && row.nextSibling && row.nextSibling.classList.contains('packet-detail-row')) {
                row.nextSibling.style.display = 'none';
            }
        });
    });
}

// Remove showPacketDetails function as it is now inline

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
