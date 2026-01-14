import { PcapParser } from '../parser/pcap.js';
import { ProtocolParser } from '../parser/protocol.js';

self.onmessage = async (e) => {
    const { buffer } = e.data;

    try {
        self.postMessage({ type: 'status', message: 'Parsing Global Header...' });

        const pcap = new PcapParser(buffer);
        // We will manually iterate to report progress instead of calling parse() all at once
        pcap.parseGlobalHeader();

        const packets = [];
        const totalSize = buffer.byteLength;
        let lastReport = Date.now();

        while (pcap.offset < pcap.buffer.byteLength) {
            const raw = pcap.parsePacket();
            if (!raw) break;

            const decoded = ProtocolParser.parse(raw.data);
            packets.push({ ...raw, ...decoded });

            // Report progress every 200ms
            if (Date.now() - lastReport > 200) {
                const progress = (pcap.offset / totalSize) * 100;
                self.postMessage({
                    type: 'progress',
                    value: progress,
                    message: `Parsing... ${progress.toFixed(1)}%`
                });
                lastReport = Date.now();
            }
        }

        self.postMessage({
            type: 'complete',
            packets: packets
        });

    } catch (err) {
        self.postMessage({ type: 'error', error: err.message });
    }
};
