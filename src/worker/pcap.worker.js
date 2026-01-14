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
            // Ensure data/payload is preserved if ProtocolParser doesn't keep it
            // raw.header is pcap header, raw.data is Uint8Array
            // raw contains { timestamp, length, capturedLength, data }
            packets.push({
                index: packets.length, // Assign 0-based index
                timestamp: raw.timestamp * 1000000, // Convert seconds (float) to microseconds for consistency if needed, or keep as is.
                // ProtocolParser assumes microseconds usually? Or main.js expects microseconds?
                // pcap.js returns seconds (float). Let's standardize to microseconds for internal logic if UI expects it.
                // Main.js: (packet.timestamp / 1000000).toFixed(6) -> expects microseconds.

                // If pcap.js returns float seconds (e.g. 1768.402), 
                // we should convert to microseconds integer: 1768402000 roughly.
                // But wait, pcap.js does: tsSec + (tsUsec / 1000000).

                // Let's revert to microseconds for the timestamp field to match format expected by main.js
                // Or just use the float seconds? 
                // main.js line 151: `${(packet.timestamp / 1000000).toFixed(6)}`
                // This implies packet.timestamp is in microseconds.

                timestamp: raw.timestamp * 1000000,
                length: raw.length, // Ensure original length is passed
                len: raw.capturedLength,
                data: raw.data, // Preserve raw data for Hex View
                ...decoded
            });

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
