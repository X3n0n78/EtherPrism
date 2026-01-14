import { bus } from './event_bus.js';

class Store {
    constructor() {
        this.state = {
            file: null,
            packets: [],
            flows: new Map(),
            hostnames: new Map(),
            hiddenNodes: new Set(),
            selected: null, // { type: 'node'|'link'|'packet', data: ... }
            filter: {
                timeStart: null,
                timeEnd: null,
                searchTerm: ''
            },
            isProcessing: false,
            appStatus: 'System Active'
        };
    }

    // --- Actions ---

    setFile(file) {
        this.state.file = file;
        this.state.isProcessing = true;
        this.state.appStatus = `Reading ${file.name}...`;
        bus.emit('state:updated', { key: 'isProcessing', value: true });
        bus.emit('status:updated', this.state.appStatus);
    }

    setPackets(packets) {
        this.state.packets = packets;
        this.state.isProcessing = false;
        this.state.appStatus = `Analysis Complete. ${packets.length.toLocaleString()} packets processed.`;

        // Reset secondary state
        this.state.flows = new Map();
        this.state.hostnames = new Map();
        this.state.hiddenNodes = new Set();
        this.state.selected = null;

        this._analyzeFlows();

        bus.emit('data:loaded', this.state.packets);
        bus.emit('state:updated', { key: 'isProcessing', value: false });
        bus.emit('status:updated', this.state.appStatus);
    }

    updateSelection(type, data) {
        this.state.selected = data ? { type, data } : null;
        bus.emit('selection:changed', this.state.selected);
    }

    updateTimeFilter(start, end) {
        this.state.filter.timeStart = start;
        this.state.filter.timeEnd = end;
        bus.emit('filter:time', { start, end });
    }

    updateSearch(term) {
        this.state.filter.searchTerm = term;
        bus.emit('filter:search', term);
    }

    hideNode(nodeId) {
        this.state.hiddenNodes.add(nodeId);
        bus.emit('view:updated', { hiddenNodes: this.state.hiddenNodes });
    }

    resetHiddenNodes() {
        this.state.hiddenNodes.clear();
        bus.emit('view:updated', { hiddenNodes: this.state.hiddenNodes });
    }

    reset() {
        this.state.file = null;
        this.state.packets = [];
        this.state.flows.clear();
        this.state.hostnames.clear();
        this.state.hiddenNodes.clear();
        this.state.selected = null;
        this.state.appStatus = 'System Active';

        bus.emit('app:reset');
    }

    // --- Internal Helpers ---

    _analyzeFlows() {
        // Basic Flow Analysis (Migrated from main.js)
        this.state.packets.forEach(packet => {
            if (packet.ip) {
                const key = `${packet.ip.src}->${packet.ip.dst}`;
                if (!this.state.flows.has(key)) {
                    this.state.flows.set(key, {
                        source: packet.ip.src,
                        target: packet.ip.dst,
                        value: 0,
                        count: 0,
                        protocolCounts: {},
                        packets: [],
                        appInfo: new Set()
                    });
                }
                const flow = this.state.flows.get(key);
                flow.value += packet.length;
                flow.count += 1;
                flow.packets.push(packet);

                const proto = packet.tcp ? 'TCP' : (packet.udp ? 'UDP' : 'Other');
                flow.protocolCounts[proto] = (flow.protocolCounts[proto] || 0) + 1;

                if (packet.app) {
                    flow.appInfo.add(packet.app.info);
                    flow.appType = packet.app.type;
                    if (packet.app.type === 'TLS' && packet.app.info.startsWith('SNI: ')) {
                        this.state.hostnames.set(packet.ip.dst, packet.app.info.replace('SNI: ', ''));
                    }
                }
            }
        });
    }

    // --- Getters ---

    getPackets() { return this.state.packets; }
    getFlows() { return Array.from(this.state.flows.values()); }
    getFlowMap() { return this.state.flows; }
    getHostnames() { return this.state.hostnames; }
    getHiddenNodes() { return this.state.hiddenNodes; }
}

export const store = new Store();
