import { store } from '../core/store.js';

// Selection History Stack
let historyStack = [];
let isNavigatingBack = false;

export function clearDetailsHistory() {
    historyStack = [];
}

export function renderDetailsPanel(selected, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // --- History Management ---
    if (selected) {
        if (!isNavigatingBack) {
            // Push to stack if it's new
            const currentTop = historyStack[historyStack.length - 1];
            // Simple check to avoid duplicates at top
            if (!currentTop || !isSameSelection(currentTop, selected)) {
                historyStack.push(selected);
            }
        }
        isNavigatingBack = false; // Reset flag
    } else {
        // If selection cleared explicitly, reset history? 
        // Or keep it? Let's keep it for now, but maybe clear functionality is needed.
        // Usually clearing selection means "close", so we might not need to clear history unless file reloaded.
    }

    // --- Empty State ---
    if (!selected) {
        container.innerHTML = `
            <div class="empty-details">
                <div style="font-size:3rem; margin-bottom:1rem; color:var(--text-muted); opacity:0.5;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <div style="font-weight:600; font-size:1.1rem; color:var(--text-secondary); margin-bottom:0.5rem;">Selection Required</div>
                <div style="font-size:0.85rem; max-width:200px; line-height:1.4;">Select a packet or node to verify details.</div>
            </div>
        `;
        return;
    }

    // --- Header Construction ---
    let headerHtml = '';
    let contentHtml = '';

    // Back Button Logic
    const showBack = historyStack.length > 1;
    const backButtonHtml = showBack
        ? `<button class="btn-icon-only" id="btn-details-back" title="Go Back">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
           </button>`
        : '';

    if (selected.type === 'node') {
        const id = selected.data.id;
        const hostname = store.getHostnames().get(id) || 'Unknown Host';

        headerHtml = buildHeader('Node', id, hostname, 'var(--accent-primary)', getIcon('node'), backButtonHtml);
        contentHtml = renderNodeDetails(selected.data);

    } else if (selected.type === 'packet') {
        const p = selected.data;
        const proto = p.proto;

        // Dynamic color for protocol
        let color = 'var(--text-secondary)';
        if (p.tcp) color = 'var(--accent-info)';
        else if (p.udp) color = 'var(--accent-success)';
        else if (p.icmp) color = 'var(--accent-warning)';

        headerHtml = buildHeader('Packet', `Index #${p.index || '?'}`, `${proto} • ${p.length} Bytes`, color, getIcon('packet'), backButtonHtml);
        contentHtml = renderPacketCards(p);

    } else if (selected.type === 'link') {
        headerHtml = buildHeader('Link', 'Connection', `${selected.data.source.id} ↔ ${selected.data.target.id}`, 'var(--accent-info)', getIcon('link'), backButtonHtml);
        contentHtml = `<div style="padding:1rem; color:var(--text-secondary);">Link details not yet implemented.</div>`;
    }

    // --- Render ---
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; height:100%;">
            ${headerHtml}
            <div class="custom-scroll" style="flex:1; overflow-y:auto; padding:1rem;">
                ${contentHtml}
            </div>
        </div>
    `;

    // --- Interactions ---

    // Back Button
    const btnBack = document.getElementById('btn-details-back');
    if (btnBack) {
        btnBack.onclick = () => {
            if (historyStack.length > 1) {
                historyStack.pop(); // Remove current
                const prev = historyStack[historyStack.length - 1]; // Peek previous
                isNavigatingBack = true; // Set flag to prevent re-pushing
                store.updateSelection(prev.type, prev.data);
            }
        };
    }

    // Toggle Card Visibility
    container.querySelectorAll('.card-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            if (content) {
                const isHidden = content.style.display === 'none';
                content.style.display = isHidden ? 'flex' : 'none';
                header.setAttribute('aria-expanded', isHidden);
            }
        });
    });
}

function isSameSelection(s1, s2) {
    if (s1.type !== s2.type) return false;
    if (s1.type === 'node') return s1.data.id === s2.data.id;
    if (s1.type === 'packet') return s1.data === s2.data; // Reference check usually enough for packets
    if (s1.type === 'link') return s1.data === s2.data;
    return false;
}

// --- Icons (Lucide Style) ---
function getIcon(type) {
    if (type === 'node') return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/></svg>`; // Server style
    if (type === 'packet') return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`; // Folder/Data style
    if (type === 'link') return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    return '';
}

// --- Header Builder ---
function buildHeader(typeLabel, title, subtitle, color, iconSvg, backBtn) {
    return `
        <div class="details-header">
            <div style="display:flex; align-items:center; gap:16px;">
                ${backBtn ? `
                <div style="margin-right:-8px;">
                    ${backBtn}
                </div>` : ''}
                <div style="color:${color}; display:flex; align-items:center;">${iconSvg}</div>
                <div style="flex:1;">
                    <div style="font-size:0.7rem; font-weight:700; color:${color}; letter-spacing:0.05em; margin-bottom:2px; text-transform:uppercase;">${typeLabel}</div>
                    <div style="font-size:1.1rem; font-weight:600; color:var(--text-primary); font-family:var(--font-mono);">${title}</div>
                    <div style="font-size:0.85rem; color:var(--text-secondary);">${subtitle}</div>
                </div>
            </div>
        </div>
    `;
}

// --- Node Details (Updated with history support hints) ---
function renderNodeDetails(node) {
    const allPackets = store.getPackets();
    const related = allPackets
        .filter(p => p.ip && (p.ip.src === node.id || p.ip.dst === node.id))
        .slice(-15)
        .reverse();

    let packetListHtml = '';
    if (related.length === 0) {
        packetListHtml = `<div style="padding:1rem; color:var(--text-muted); text-align:center;">No recent traffic</div>`;
    } else {
        packetListHtml = related.map(p => {
            const isOut = p.ip.src === node.id;
            const dir = isOut ? 'OUT' : 'IN';
            const dirColor = isOut ? 'var(--accent-warning)' : 'var(--accent-success)';
            const other = isOut ? p.ip.dst : p.ip.src;

            // Escape JSON
            const packetJson = JSON.stringify(p).replace(/"/g, '&quot;');

            return `
                <div style="display:flex; align-items:center; gap:8px; padding:8px; border-bottom:1px solid var(--border-subtle); cursor:pointer; font-family:var(--font-mono); font-size:0.75rem;" 
                     class="hover-bg"
                     onclick="window.dispatchEvent(new CustomEvent('packet-selected', {detail: ${packetJson}}))">
                    <span style="color:${dirColor}; font-weight:700; min-width:30px;">${dir}</span>
                    <span style="color:var(--text-secondary);">${p.proto}</span>
                    <span style="color:var(--text-primary); flex:1; overflow:hidden; text-overflow:ellipsis;">${other}</span>
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5;"><path d="m9 18 6-6-6-6"/></svg>
                </div>
             `;
        }).join('');
    }

    return `
        <div class="details-card">
            <div class="card-header" aria-expanded="true">
                <span class="tree-arrow">▼</span>
                <span class="card-title">Latest Traffic</span>
            </div>
            <div class="card-content">
                ${packetListHtml}
            </div>
        </div>
    `;
}

// --- Packet Tree (Card Style) ---
function renderPacketCards(packet) {
    let html = '';

    // 1. Frame / Meta
    html += buildCard('Frame Metadata', [
        ['Arrival Time', new Date(packet.timestamp * 1000).toLocaleString()],
        ['Epoch', packet.timestamp],
        ['Frame Length', `${packet.length} bytes`],
        ['Capture Length', `${packet.capturedLength} bytes`]
    ]);

    // 2. Ethernet
    if (packet.eth) {
        html += buildCard('Ethernet II', [
            ['Source', packet.eth.src],
            ['Destination', packet.eth.dst],
            ['Type', 'IPv4 (0x0800)']
        ]);
    }

    // 3. IP
    if (packet.ip) {
        html += buildCard(`Internet Protocol v4`, [
            ['Source IP', packet.ip.src],
            ['Destination IP', packet.ip.dst],
            ['Protocol', packet.proto],
            ['Total Length', packet.length],
            ['Header Length', '20 bytes']
        ], true);
    }

    // 4. TCP
    if (packet.tcp) {
        html += buildCard(`Transmission Control Protocol`, [
            ['Source Port', packet.tcp.src_port],
            ['Dest Port', packet.tcp.dst_port],
            ['Seq Number', packet.tcp.seq],
            ['Ack Number', packet.tcp.ack],
            ['Flags', packet.tcp.flags ? `[${packet.tcp.flags}]` : 'N/A']
        ], true);
    }
    // 5. UDP
    else if (packet.udp) {
        html += buildCard(`User Datagram Protocol`, [
            ['Source Port', packet.udp.src_port],
            ['Dest Port', packet.udp.dst_port],
            ['Length', packet.udp.length]
        ], true);
    }

    // 6. App Layer
    if (packet.app) {
        html += buildCard(`${packet.app.type} Protocol`, [
            ['Info', packet.app.info]
        ], true);
    }

    return html;
}

function buildCard(title, rows, expanded = false) {
    const arrow = expanded ? '▼' : '▶';
    const display = expanded ? 'flex' : 'none';
    const aria = expanded ? 'true' : 'false';

    const rowsHtml = rows.map(([label, value]) => `
        <div class="detail-row">
            <div class="detail-label">${label}</div>
            <div class="detail-value">${value}</div>
        </div>
    `).join('');

    return `
        <div class="details-card">
            <div class="card-header" aria-expanded="${aria}">
                <span class="tree-arrow">${arrow}</span>
                <span class="card-title">${title}</span>
            </div>
            <div class="card-content" style="display:${display};">
                ${rowsHtml}
            </div>
        </div>
    `;
}
