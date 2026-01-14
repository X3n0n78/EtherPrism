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

            if (result.ip.proto === Protocols.IP.TCP) {
                if (offset + 20 > packetData.byteLength) return result; // Min TCP Header

                const seq = packetData.getUint32(offset + 4, false);
                const ack = packetData.getUint32(offset + 8, false);
                const dataOffsetFlags = packetData.getUint16(offset + 12, false);
                const dataOffset = (dataOffsetFlags >> 12) * 4;
                const flags = dataOffsetFlags & 0x01FF; // Bottom 9 bits

                result.tcp = {
                    src_port: srcPort,
                    dst_port: dstPort,
                    seq: seq,
                    ack: ack,
                    syn: !!(flags & 0x002),
                    ack_flag: !!(flags & 0x010),
                    fin: !!(flags & 0x001),
                    rst: !!(flags & 0x004),
                    psh: !!(flags & 0x008),
                    urg: !!(flags & 0x020),
                    flags: flags,
                    payload_len: 0 // Calc later
                };
                result.transport = { srcPort, dstPort, proto: 'TCP' };

                // Advance
                const appDataOffset = offset + dataOffset;
                // Calculate Payload Len
                // Total Packet Len - IP Header - TCP Header (roughly, or just buffer len - offset)
                // Better: buffer.byteLength - appDataOffset 
                if (appDataOffset <= packetData.byteLength) {
                    result.tcp.payload_len = packetData.byteLength - appDataOffset;
                    result.app = this.parseApplicationLayer(packetData, appDataOffset, 'TCP', srcPort, dstPort);
                }

            } else if (result.ip.proto === Protocols.IP.UDP) {
                if (offset + 8 > packetData.byteLength) return result;
                const length = packetData.getUint16(offset + 4, false);

                result.udp = {
                    src_port: srcPort,
                    dst_port: dstPort,
                    length: length
                };
                result.transport = { srcPort, dstPort, proto: 'UDP' };

                const appDataOffset = offset + 8;
                if (appDataOffset < packetData.byteLength) {
                    result.app = this.parseApplicationLayer(packetData, appDataOffset, 'UDP', srcPort, dstPort);
                }
            }
        }

        return result;
    }

    static parseApplicationLayer(view, offset, transportProto, srcPort, dstPort) {
        // Heuristics based on ports and content
        const port = Math.min(srcPort, dstPort); // Check known ports

        // 1. DNS (UDP/53)
        if (transportProto === 'UDP' && (srcPort === 53 || dstPort === 53)) {
            return this.parseDNS(view, offset);
        }

        // 2. HTTP (TCP/80, 8080 or detection)
        if (transportProto === 'TCP') {
            const data = this.getText(view, offset, 16); // Check start
            if (['GET ', 'POST', 'PUT ', 'DELE', 'HTTP'].some(m => data.startsWith(m))) {
                return this.parseHTTP(view, offset);
            }

            // 3. TLS (TCP/443) - ContentType 22 (Handshake)
            // byte 0: ContentType (0x16 = Handshake)
            // byte 1-2: Version
            // byte 3-4: Length
            // byte 5: HandshakeType (0x01 = ClientHello)
            if (view.byteLength > offset + 6) {
                if (view.getUint8(offset) === 0x16 && view.getUint8(offset + 5) === 0x01) {
                    return this.parseTLS(view, offset + 5); // +5 to skip Record Header
                }
            }
        }

        return null;
    }

    static parseDNS(view, offset) {
        try {
            // DNS Header is 12 bytes
            // QNAME starts at offset + 12
            if (offset + 12 >= view.byteLength) return null;

            // Simple QNAME parsing
            let qname = '';
            let pos = offset + 12;
            let jumps = 0;

            while (pos < view.byteLength) {
                const len = view.getUint8(pos);
                if (len === 0) break; // End of Name
                if ((len & 0xC0) === 0xC0) break; // Pointer (not handling for now)

                pos++;
                for (let i = 0; i < len; i++) {
                    if (pos >= view.byteLength) break;
                    qname += String.fromCharCode(view.getUint8(pos));
                    pos++;
                }
                qname += '.';
            }
            if (qname.endsWith('.')) qname = qname.slice(0, -1);

            return { type: 'DNS', info: `Query: ${qname}` };
        } catch (e) { return null; }
    }

    static parseHTTP(view, offset) {
        try {
            // Read first line
            let line = '';
            let pos = offset;
            while (pos < view.byteLength && pos < offset + 200) { // Limit length
                const char = view.getUint8(pos);
                if (char === 0x0D0A) break; // CRLF (check only first byte for simplicity here)
                if (char === 0x0A) break;
                line += String.fromCharCode(char);
                pos++;
            }
            return { type: 'HTTP', info: line.trim() };
        } catch (e) { return null; }
    }

    static parseTLS(view, offset) {
        try {
            // Handshake Header parsed by caller to find ClientHello
            // offset points to HandshakeType (1 byte)
            // +1 (Type) +3 (Length) +2 (Version) +32 (Random) + 1 (SessionID Len)
            let pos = offset + 1 + 3 + 2 + 32;
            if (pos >= view.byteLength) return null;

            const sessionIDLen = view.getUint8(pos);
            pos += 1 + sessionIDLen;

            if (pos + 2 >= view.byteLength) return null;
            const cipherSuitesLen = view.getUint16(pos, false);
            pos += 2 + cipherSuitesLen;

            if (pos + 1 >= view.byteLength) return null;
            const compressionLen = view.getUint8(pos);
            pos += 1 + compressionLen;

            if (pos + 2 >= view.byteLength) return null;
            const extensionsLen = view.getUint16(pos, false);
            const extensionsEnd = pos + 2 + extensionsLen;
            pos += 2;

            // Iterate Extensions
            while (pos + 4 < extensionsEnd && pos < view.byteLength) {
                const extType = view.getUint16(pos, false);
                const extLen = view.getUint16(pos + 2, false);

                if (extType === 0x0000) { // Server Name
                    // SNI parsing
                    // +4 (Head) + 2 (ListLen) + 1 (Type) + 2 (NameLen)
                    if (pos + 9 < view.byteLength) {
                        const nameLen = view.getUint16(pos + 7, false);
                        let sni = '';
                        for (let i = 0; i < nameLen; i++) {
                            sni += String.fromCharCode(view.getUint8(pos + 9 + i));
                        }
                        return { type: 'TLS', info: `SNI: ${sni}` };
                    }
                }
                pos += 4 + extLen;
            }
            return { type: 'TLS', info: 'Client Hello' };
        } catch (e) { return null; }
    }

    static getText(view, offset, len) {
        let str = '';
        for (let i = 0; i < len && offset + i < view.byteLength; i++) {
            str += String.fromCharCode(view.getUint8(offset + i));
        }
        return str;
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
