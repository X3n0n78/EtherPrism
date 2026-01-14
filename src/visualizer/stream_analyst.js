import { store } from '../core/store.js';

export class StreamAnalyst {
    /**
     * Reconstructs a TCP stream from a given packet
     * @param {Object} seedPacket - The packet to follow
     * @param {Array} allPackets - All available packets
     * @returns {Object} { id, packets, payload, text, html }
     */
    static followTcpStream(seedPacket, allPackets) {
        if (!seedPacket.tcp || !seedPacket.ip) throw new Error("Not a TCP packet");

        const srcIP = seedPacket.ip.src;
        const dstIP = seedPacket.ip.dst;
        const srcPort = seedPacket.tcp.src_port;
        const dstPort = seedPacket.tcp.dst_port;

        // Filter packets belonging to this 4-tuple (bidirectional)
        const streamPackets = allPackets.filter(p => {
            if (!p.tcp || !p.ip) return false;
            const pSrc = p.ip.src;
            const pDst = p.ip.dst;
            const pSP = p.tcp.src_port;
            const pDP = p.tcp.dst_port;

            const forward = (pSrc === srcIP && pDst === dstIP && pSP === srcPort && pDP === dstPort);
            const backward = (pSrc === dstIP && pDst === srcIP && pSP === dstPort && pDP === srcPort);
            return forward || backward;
        });

        // Sort by Sequence Number (Simplified - ideally needs strict TCP state tracking)
        // For visualization, timestamp sort is often enough unless out-of-order delivery
        streamPackets.sort((a, b) => a.timestamp - b.timestamp);

        // Reassemble Payload
        let textContent = "";
        let htmlContent = "";

        streamPackets.forEach(p => {
            if (p.payload && p.payload.length > 0) {
                // Determine direction for styling
                const isRequest = (p.ip.src === srcIP);
                const colorClass = isRequest ? "stream-req" : "stream-res";
                const bgStyle = isRequest ? "color: #fca5a5;" : "color: #93c5fd;"; // Tailwind red-300 / blue-300 approx

                // Convert bytes to ASCII char if printable, else dot
                // Assuming p.payload is a hex string or byte array.
                // In our previous mock/pcap worker, payload might be hex string.
                // Let's assume hex string for now based on typical pcap.js output.

                const bytes = this.hexToBytes(p.payload);
                const chunk = this.bytesToAscii(bytes);

                textContent += chunk;
                htmlContent += `<span class="${colorClass}" style="${bgStyle}">${this.escapeHtml(chunk)}</span>`;
            }
        });

        return {
            id: `${srcIP}:${srcPort}-${dstIP}:${dstPort}`,
            packets: streamPackets,
            text: textContent || "No ASCII Data",
            html: htmlContent || "<div style='color:gray'>No HTML Data</div>"
        };
    }

    static hexToBytes(hex) {
        if (!hex) return [];
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substr(i, 2), 16));
        }
        return bytes;
    }

    static bytesToAscii(bytes) {
        return bytes.map(b => {
            // Printable ASCII range (32-126) + newline/tab
            if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
                return String.fromCharCode(b);
            }
            return '.';
        }).join('');
    }

    static escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
