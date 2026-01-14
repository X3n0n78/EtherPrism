export function renderHexView(packet, container) {
    // Determine payload
    let payload = packet.payload;
    if (!payload && packet.udp) payload = packet.udp.payload;
    // Note: TCP payload often needs reconstruction or specific field, 
    // but assuming 'payload' property exists on packet object for raw bytes of the segment.

    container.innerHTML = '';

    if (!payload || payload.length === 0) {
        container.innerHTML = '<div style="padding:1rem; color:var(--text-secondary);">No payload data available.</div>';
        return;
    }

    // Structure: Offset | Hex | ASCII
    const wrapper = document.createElement('div');
    wrapper.className = 'hex-editor-view';
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = '60px 1fr 1fr'; // Offset | Hex | ASCII
    wrapper.style.gap = '1rem';
    wrapper.style.fontFamily = 'var(--font-mono)';
    wrapper.style.fontSize = '0.8rem';
    wrapper.style.lineHeight = '1.5em';
    wrapper.style.color = 'var(--text-secondary)';

    const offsetCol = document.createElement('div');
    const hexCol = document.createElement('div');
    const asciiCol = document.createElement('div');

    // Style columns
    offsetCol.style.color = 'var(--accent-cyan)';
    offsetCol.style.textAlign = 'right';
    offsetCol.style.borderRight = '1px solid var(--border-neon)';
    offsetCol.style.paddingRight = '8px';

    // Process data in chunks of 16 bytes
    // hex string is 2 chars per byte
    const hexString = payload;
    const bytes = [];
    for (let i = 0; i < hexString.length; i += 2) {
        bytes.push(parseInt(hexString.substr(i, 2), 16));
    }

    let offsetHTML = '';
    let hexHTML = '';
    let asciiHTML = '';

    for (let i = 0; i < bytes.length; i += 16) {
        // Offset
        offsetHTML += `<div>${i.toString(16).padStart(4, '0')}</div>`;

        // Hex
        const chunk = bytes.slice(i, i + 16);
        const hexLine = chunk.map((b, idx) => `<span class="byte-hex" data-idx="${i + idx}">${b.toString(16).padStart(2, '0')}</span>`).join(' ');
        hexHTML += `<div>${hexLine}</div>`;

        // ASCII
        const asciiLine = chunk.map((b, idx) => {
            const char = (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
            return `<span class="byte-ascii" data-idx="${i + idx}">${escapeHtml(char)}</span>`;
        }).join('');
        asciiHTML += `<div>${asciiLine}</div>`;
    }

    offsetCol.innerHTML = offsetHTML;
    hexCol.innerHTML = hexHTML;
    asciiCol.innerHTML = asciiHTML;

    wrapper.appendChild(offsetCol);
    wrapper.appendChild(hexCol);
    wrapper.appendChild(asciiCol); // Optional: Right panel for ascii

    container.appendChild(wrapper);

    // Interaction Sync
    const hexSpans = hexCol.querySelectorAll('.byte-hex');
    const asciiSpans = asciiCol.querySelectorAll('.byte-ascii');

    function highlight(idx, active) {
        const h = hexCol.querySelector(`.byte-hex[data-idx="${idx}"]`);
        const a = asciiCol.querySelector(`.byte-ascii[data-idx="${idx}"]`);

        const color = active ? 'var(--text-primary)' : '';
        const bg = active ? 'var(--accent-blue)' : '';

        if (h) { h.style.color = active ? '#fff' : ''; h.style.background = bg; }
        if (a) { a.style.color = active ? '#fff' : ''; a.style.background = bg; }
    }

    wrapper.addEventListener('mouseover', (e) => {
        if (e.target.dataset.idx) {
            highlight(e.target.dataset.idx, true);
        }
    });

    wrapper.addEventListener('mouseout', (e) => {
        if (e.target.dataset.idx) {
            highlight(e.target.dataset.idx, false);
        }
    });
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
