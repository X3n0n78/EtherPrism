export const Protocols = {
    ETHERNET: {
        IPV4: 0x0800,
        IPV6: 0x86DD,
        ARP: 0x0806
    },
    IP: {
        TCP: 6,
        UDP: 17,
        ICMP: 1
    }
};

export class ProtocolParser {
    static parse(packetData) {
        const result = {
            eth: null,
            ip: null,
            transport: null
        };

        // --- 1. Ethernet Header (14 bytes) ---
        // Dest MAC (6), Src MAC (6), Type (2)
        if (packetData.byteLength < 14) return result;

        const ethType = packetData.getUint16(12, false); // Type is Big Endian
        result.eth = {
            src: this.macToString(packetData, 6),
            dst: this.macToString(packetData, 0),
            type: ethType
        };

        let offset = 14;

        // --- 2. IP Layer ---
        if (ethType === Protocols.ETHERNET.IPV4) {
            if (offset + 20 > packetData.byteLength) return result;

            const versionIhl = packetData.getUint8(offset);
            const ihl = (versionIhl & 0x0f) * 4; // Header length in bytes

            const proto = packetData.getUint8(offset + 9);
            const src = this.ipv4ToString(packetData, offset + 12);
            const dst = this.ipv4ToString(packetData, offset + 16);

            result.ip = { version: 4, src, dst, proto, headerLen: ihl };
            offset += ihl;

        } else if (ethType === Protocols.ETHERNET.IPV6) {
            if (offset + 40 > packetData.byteLength) return result;

            const nextHeader = packetData.getUint8(offset + 6);
            const src = this.ipv6ToString(packetData, offset + 8);
            const dst = this.ipv6ToString(packetData, offset + 24);

            result.ip = { version: 6, src, dst, proto: nextHeader, headerLen: 40 };
            offset += 40;
        } else {
            return result; // Non-IP packet
        }

        // --- 3. Transport Layer ---
        if (result.ip && (result.ip.proto === Protocols.IP.TCP || result.ip.proto === Protocols.IP.UDP)) {
            if (offset + 4 > packetData.byteLength) return result;

            const srcPort = packetData.getUint16(offset, false);
            const dstPort = packetData.getUint16(offset + 2, false);

            result.transport = { srcPort, dstPort, proto: result.ip.proto === Protocols.IP.TCP ? 'TCP' : 'UDP' };
        }

        return result;
    }

    static macToString(view, offset) {
        const parts = [];
        for (let i = 0; i < 6; i++) {
            parts.push(view.getUint8(offset + i).toString(16).padStart(2, '0'));
        }
        return parts.join(':');
    }

    static ipv4ToString(view, offset) {
        return `${view.getUint8(offset)}.${view.getUint8(offset + 1)}.${view.getUint8(offset + 2)}.${view.getUint8(offset + 3)}`;
    }

    static ipv6ToString(view, offset) {
        const parts = [];
        for (let i = 0; i < 16; i += 2) {
            parts.push(view.getUint16(offset + i, false).toString(16));
        }
        return parts.join(':');
    }
}
