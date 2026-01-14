export class SecurityEngine {
    static scan(packets) {
        const alerts = [];
        const portScanThreshold = 20; // ports per IP
        const dnsTunnelLenThreshold = 50; // subdomain length

        // 1. Port Scan Detection
        // Map<SrcIP, Set<DstPort>>
        const scanners = new Map();

        // 2. DNS Tunneling
        // Check DNS queries for length/entropy

        packets.forEach(p => {
            // Port Scan Logic
            if (p.tcp && p.tcp.syn && !p.tcp.ack) { // SYN only
                const src = p.ip.src;
                if (!scanners.has(src)) scanners.set(src, new Set());
                scanners.get(src).add(p.tcp.dst_port);
            }

            // DNS Tunneling Logic (Simple Heuristic: Long Query Name)
            if (p.udp && p.udp.dst_port === 53 && p.app && p.app.type === 'DNS') {
                // Assuming p.app.info contains query "Standard query 0x... A long.subdomain.com"
                // This depends on our parser quality. Let's look for long words.
                const info = p.app.info || "";
                const parts = info.split(' ');
                parts.forEach(part => {
                    // Check common structure for domain (dot separated)
                    if (part.includes('.') && part.length > dnsTunnelLenThreshold) {
                        alerts.push({
                            type: 'DNS Tunneling Suspected',
                            severity: 'High',
                            source: p.ip.src,
                            target: p.ip.dst,
                            details: `Suspiciously long query: ${part.substring(0, 30)}...`,
                            timestamp: p.timestamp
                        });
                    }
                });
            }
        });

        // Finalize Port Scan Alerts
        scanners.forEach((ports, srcIP) => {
            if (ports.size > portScanThreshold) {
                alerts.push({
                    type: 'Port Scan Detected',
                    severity: 'Medium',
                    source: srcIP,
                    target: 'Multiple',
                    details: `Scanned ${ports.size} unique ports.`,
                    timestamp: packets[0]?.timestamp || Date.now()
                });
            }
        });

        return alerts;
    }
}
