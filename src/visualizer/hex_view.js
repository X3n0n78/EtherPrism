export function renderHexView(packet, container) {
    // packet.data is the DataView containing the raw packet
    if (!packet.data) {
        container.innerHTML = '<div class="error">Raw packet data not retained in memory.</div>';
        return;
    }

    const data = packet.data; // This is a DataView
    const length = data.byteLength;
    const hexLines = [];

    // Header
    hexLines.push('<div class="hex-grid header"><span class="offset">Offset</span><span class="hex-bytes">00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F</span><span class="ascii">ASCII</span></div>');

    for (let i = 0; i < length; i += 16) {
        const chunk = [];
        const ascii = [];

        for (let j = 0; j < 16; j++) {
            if (i + j < length) {
                const byte = data.getUint8(i + j);
                chunk.push(byte.toString(16).padStart(2, '0').toUpperCase());

                // Printable ASCII range (32-126)
                if (byte >= 32 && byte <= 126) {
                    ascii.push(String.fromCharCode(byte));
                } else {
                    ascii.push('.');
                }
            } else {
                chunk.push('  '); // Padding
            }
            if (j === 7) chunk.push(''); // Extra space after 8th byte
        }

        const offset = i.toString(16).padStart(4, '0').toUpperCase();
        hexLines.push(`<div class="hex-grid"><span class="offset">${offset}</span><span class="hex-bytes">${chunk.join(' ')}</span><span class="ascii">${ascii.join('')}</span></div>`);
    }

    container.innerHTML = `<div class="hex-view-container">${hexLines.join('')}</div>`;
}
