export class StreamAnalyst {
    static getStreamPackets(initialPacket, allPackets) {
        if (!initialPacket.ip || !initialPacket.tcp) return [];
        const srcIP = initialPacket.ip.src;
        const dstIP = initialPacket.ip.dst;
        const srcPort = initialPacket.tcp.src_port;
        const dstPort = initialPacket.tcp.dst_port;

        const streamPackets = allPackets.filter(p => {
            if (!p.ip || !p.tcp) return false;
            const forward = (p.ip.src === srcIP && p.ip.dst === dstIP && p.tcp.src_port === srcPort && p.tcp.dst_port === dstPort);
            const backward = (p.ip.src === dstIP && p.ip.dst === srcIP && p.tcp.src_port === dstPort && p.tcp.dst_port === srcPort);
            return forward || backward;
        });
        streamPackets.sort((a, b) => a.timestamp - b.timestamp);
        return streamPackets;
    }

    static followTcpStream(initialPacket, allPackets) {
        if (!initialPacket.ip || !initialPacket.tcp) return null;

        const srcIP = initialPacket.ip.src; // Needed for direction check
        const streamPackets = this.getStreamPackets(initialPacket, allPackets);

        // Extract Payload
        const chunks = [];
        let totalPayloadBytes = 0;
        let printableBytes = 0;

        streamPackets.forEach(p => {
            const payload = this.extractTcpPayload(p);
            if (payload && payload.byteLength > 0) {
                totalPayloadBytes += payload.byteLength;

                // Formatting: Indicate direction
                const direction = (p.ip.src === srcIP) ? '→' : '←';
                const timeStr = (p.timestamp / 1000000).toFixed(4);

                // Analyze content
                const { text, type } = this.analyzeContent(payload);
                if (type === 'text') printableBytes += payload.byteLength;

                if (type === 'text') {
                    chunks.push(`[${timeStr}] ${direction} (${payload.byteLength} bytes):\n${text}\n\n`);
                } else {
                    chunks.push(`[${timeStr}] ${direction} (${payload.byteLength} bytes) [Binary/Encrypted]\n${text}\n\n`);
                }
            }
        });

        if (chunks.length === 0) {
            return "Empty stream (only handshake/control packets).";
        }

        const streamContent = chunks.join('');

        if (printableBytes < totalPayloadBytes * 0.1) {
            // Mostly binary
            return `*** STREAM CONTAINS BINARY/ENCRYPTED DATA ***\nTotal Payload: ${totalPayloadBytes} bytes\n\n` + streamContent;
        }

        return streamContent;
    }

    static extractTcpPayload(packet) {
        if (!packet.data || !packet.ip || !packet.tcp) return null;

        const view = packet.data;
        let offset = 14;

        // IP
        if (offset >= view.byteLength) return null;
        const verIhl = view.getUint8(offset);
        const ihl = (verIhl & 0x0f) * 4;
        offset += ihl;

        // TCP
        if (offset + 12 >= view.byteLength) return null;
        const dataOffsetByte = view.getUint8(offset + 12);
        const dataOffset = (dataOffsetByte >> 4) * 4;
        offset += dataOffset;

        // Payload
        if (offset >= view.byteLength) return null;

        return new DataView(view.buffer, view.byteOffset + offset, view.byteLength - offset);
    }

    static analyzeContent(dataView) {
        let str = '';
        let printable = 0;
        const limit = Math.min(dataView.byteLength, 500); // Limit preview

        for (let i = 0; i < limit; i++) {
            const code = dataView.getUint8(i);
            if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9) {
                str += String.fromCharCode(code);
                printable++;
            } else {
                str += '.';
            }
        }

        if (dataView.byteLength > limit) str += '... (truncated)';

        // If > 70% is printable, treat as text
        if (printable / limit > 0.7) {
            return { text: str, type: 'text' };
        } else {
            // Return Hex Snippet for binary
            let hex = '';
            for (let i = 0; i < Math.min(16, dataView.byteLength); i++) {
                hex += dataView.getUint8(i).toString(16).padStart(2, '0') + ' ';
            }
            return { text: `Hex: ${hex}...`, type: 'binary' };
        }
    }
}
