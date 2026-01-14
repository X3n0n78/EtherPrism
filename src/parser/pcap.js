export class PcapParser {
    constructor(arrayBuffer) {
        this.buffer = arrayBuffer;
        this.view = new DataView(arrayBuffer);
        this.offset = 0;
        this.le = false; // Little Endian flag
        this.globalHeader = null;
        this.packets = [];
    }

    parse() {
        this.parseGlobalHeader();
        while (this.offset < this.buffer.byteLength) {
            const packet = this.parsePacket();
            if (packet) {
                this.packets.push(packet);
            } else {
                break; // Stop if packet parsing fails (e.g. truncated)
            }
        }
        return this.packets;
    }

    parseGlobalHeader() {
        // Magic Number (4 bytes)
        const magic = this.view.getUint32(0, false); // Check Big Endian first

        if (magic === 0xa1b2c3d4) {
            this.le = false; // Big Endian
        } else if (magic === 0xd4c3b2a1) {
            this.le = true; // Little Endian
        } else {
            throw new Error('Unknown PCAP Magic Number: ' + magic.toString(16));
        }

        this.globalHeader = {
            magicNumber: magic,
            majorVersion: this.view.getUint16(4, this.le),
            minorVersion: this.view.getUint16(6, this.le),
            thiszone: this.view.getInt32(8, this.le),
            sigfigs: this.view.getUint32(12, this.le),
            snaplen: this.view.getUint32(16, this.le),
            network: this.view.getUint32(20, this.le)
        };

        this.offset = 24; // Global header length
        console.log('Global Header Parsed:', this.globalHeader);
    }

    parsePacket() {
        // Check if we have enough bytes for the packet header (16 bytes)
        if (this.offset + 16 > this.buffer.byteLength) return null;

        const tsSec = this.view.getUint32(this.offset, this.le);
        const tsUsec = this.view.getUint32(this.offset + 4, this.le);
        const inclLen = this.view.getUint32(this.offset + 8, this.le);
        const origLen = this.view.getUint32(this.offset + 12, this.le);

        this.offset += 16; // Move past header

        if (this.offset + inclLen > this.buffer.byteLength) {
            console.warn('Packet truncated');
            return null;
        }

        const packetData = new DataView(this.buffer, this.offset, inclLen);
        this.offset += inclLen; // Move past data

        return {
            timestamp: tsSec + (tsUsec / 1000000),
            length: origLen,
            capturedLength: inclLen,
            data: packetData // Raw DataView for protocol parsers
        };
    }
}
