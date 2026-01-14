import * as d3 from 'd3';

// Icon Paths (Lucide-like)
const ICONS = {
    pc: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    server: "M2 20h20 M2 4h20 M2 12h20 M2 4v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z M6 8h.01 M6 16h.01",
    router: "M22 12h-4l-3 9L9 3l-3 9H2",
    globe: "M22 12A10 10 0 1 1 12 2a10 10 0 0 1 10 10z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"
};

export function renderNetworkGraph(flows, containerId, onSelection, onHideNode) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    container.innerHTML = ''; // Clear previous

    // Remove existing context menu if any
    const existingMenu = document.getElementById('graph-context-menu');
    if (existingMenu) existingMenu.remove();

    // Data Transformation
    const nodesMap = new Map();
    flows.forEach(f => {
        if (!nodesMap.has(f.source)) nodesMap.set(f.source, { id: f.source, value: 0, connections: 0 });
        if (!nodesMap.has(f.target)) nodesMap.set(f.target, { id: f.target, value: 0, connections: 0 });

        nodesMap.get(f.source).value += f.value;
        nodesMap.get(f.source).connections += 1;
        nodesMap.get(f.target).value += f.value;
        nodesMap.get(f.target).connections += 1;
    });

    const nodes = Array.from(nodesMap.values()).map(n => ({
        ...n,
        type: detectType(n.id, n.connections)
    }));

    const links = flows.map(f => ({
        source: f.source,
        target: f.target,
        value: f.value,
        protocol: getDominantProtocol(f.protocolCounts)
    }));

    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .style('background', 'transparent');

    // Define Glow Filter
    const defs = svg.append("defs");
    const filter = defs.append("filter")
        .attr("id", "glow");
    filter.append("feGaussianBlur")
        .attr("stdDeviation", "2.5")
        .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Simulation
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(120))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => (d.value ? 30 : 15) + 10).iterations(2));

    const g = svg.append('g');

    // Link Lines with Neon effect
    const link = g.append('g')
        .attr('stroke-opacity', 0.6)
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke', d => getLinkColor(d.protocol))
        .attr('stroke-width', d => Math.min(Math.sqrt(d.value) / 100, 2) + 0.5)
        .attr('class', 'graph-link')
        .style('filter', 'url(#glow)'); // Add glow to links

    // Node Groups
    const node = g.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .attr('class', 'node-group')
        .attr('cursor', 'pointer')
        .call(drag(simulation));

    // Halo (for important nodes)
    node.filter(d => d.type === 'server' || d.type === 'gateway')
        .append('circle')
        .attr('r', 25)
        .attr('fill', d => getNodeColor(d.type))
        .attr('opacity', 0.15)
        .attr('class', 'halo');

    // Node Background Circle
    node.append('circle')
        .attr('r', 14)
        .attr('fill', 'var(--bg-deep)')
        .attr('stroke', d => getNodeColor(d.type))
        .attr('stroke-width', 2)
        .style('filter', 'url(#glow)'); // Add glow to nodes

    // Icons
    node.append('path')
        .attr('d', d => getIconPath(d.type))
        .attr('fill', 'none')
        .attr('stroke', d => getNodeColor(d.type))
        .attr('stroke-width', 1.5)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('transform', 'scale(0.8) translate(-12, -12)');

    // Text Label
    node.append('text')
        .text(d => d.id)
        .attr('x', 0)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .attr('class', 'graph-label')
        .style('fill', 'var(--text-scifi)')
        .style('font-family', 'var(--font-mono)')
        .style('font-size', '10px')
        .style('opacity', 0.8);

    // Focus / Neighbor Highlighting
    function focusNode(d) {
        const connectedNodeIds = new Set();
        connectedNodeIds.add(d.id);

        // Find connected links and nodes
        const connectedLinks = links.filter(l => {
            if (l.source.id === d.id) {
                connectedNodeIds.add(l.target.id);
                return true;
            }
            if (l.target.id === d.id) {
                connectedNodeIds.add(l.source.id);
                return true;
            }
            return false;
        });

        // Dim everything
        node.style('opacity', 0.1);
        link.style('opacity', 0.05);

        // Highlight connected
        node.filter(n => connectedNodeIds.has(n.id))
            .style('opacity', 1)
            .selectAll('circle')
            .attr('stroke', '#fff')
            .attr('stroke-width', n => n.id === d.id ? 4 : 2); // Extra bold for selected

        link.filter(l => connectedLinks.includes(l))
            .style('opacity', 0.8)
            .attr('stroke', 'var(--accent-cyan)')
            .attr('stroke-width', 2);
    }

    function resetFocus() {
        node.style('opacity', 1);
        link.style('opacity', 0.6)
            .attr('stroke', d => getLinkColor(d.protocol))
            .attr('stroke-width', d => Math.min(Math.sqrt(d.value) / 100, 2) + 0.5);

        node.selectAll('circle')
            .attr('stroke', d => getNodeColor(d.type))
            .attr('stroke-width', 2);
    }

    // Interactions
    node.on('click', (event, d) => {
        event.stopPropagation();
        if (onSelection) onSelection('node', d);
        hideContextMenu();
        focusNode(d);
    });

    node.on('contextmenu', (event, d) => {
        event.preventDefault();
        showContextMenu(event, d, onSelection, onHideNode);
    });

    svg.on('click', () => {
        if (onSelection) onSelection(null, null);
        hideContextMenu();
        resetFocus();
    });

    // Zoom
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.call(zoom);

    // Ticker
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('transform', d => `translate(${d.x},${d.y})`);
    });
}

// Helpers
function getDominantProtocol(counts) {
    if (!counts) return 'other';
    let max = 0;
    let proto = 'other';
    for (const [p, count] of Object.entries(counts)) {
        if (count > max) {
            max = count;
            proto = p;
        }
    }
    return proto;
}

function getLinkColor(proto) {
    switch (proto) {
        case 'TCP': return 'var(--accent-blue)';
        case 'UDP': return 'var(--accent-success)';
        case 'ICMP': return 'var(--accent-warn)';
        default: return 'var(--text-secondary)';
    }
}

function detectType(ip, connections) {
    if (ip.endsWith('.1') || ip.endsWith('.254')) return 'gateway';
    if (connections > 5) return 'server';
    if (!ip.startsWith('192.') && !ip.startsWith('10.') && !ip.startsWith('172.')) return 'wan';
    return 'pc';
}

function getNodeColor(type) {
    switch (type) {
        case 'gateway': return 'var(--accent-warn)';
        case 'server': return 'var(--accent-magenta)';
        case 'wan': return 'var(--accent-cyan)'; // Cyan used for external
        default: return 'var(--accent-blue)';
    }
}

function getIconPath(type) {
    switch (type) {
        case 'gateway': return ICONS.router;
        case 'server': return ICONS.server;
        case 'wan': return ICONS.globe;
        default: return ICONS.pc;
    }
}

// Drag
function drag(simulation) {
    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }
    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }
    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }
    return d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);
}

// Context Menu Logic
function showContextMenu(event, data, onSelection, onHideNode) {
    // ... (Keep existing simple)
    // For brevity, using logic similar to previous but styled better via CSS
    hideContextMenu();
    const menu = document.createElement('div');
    menu.id = 'graph-context-menu';
    menu.className = 'glass-panel';
    menu.style.position = 'absolute';
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;
    menu.style.padding = '5px 0';
    menu.style.zIndex = '1000';

    // ... Add items
    const items = [
        { label: 'Focus Node', action: () => onSelection('node', data) },
        { label: 'Hide Node', action: () => onHideNode(data.id) }
    ];

    items.forEach(item => {
        const div = document.createElement('div');
        div.textContent = item.label;
        div.style.padding = '8px 16px';
        div.style.cursor = 'pointer';
        div.style.color = 'var(--text-primary)';
        div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.1)';
        div.onmouseout = () => div.style.background = 'transparent';
        div.onclick = () => { item.action(); hideContextMenu(); };
        menu.appendChild(div);
    });

    document.body.appendChild(menu);
}

function hideContextMenu() {
    const menu = document.getElementById('graph-context-menu');
    if (menu) menu.remove();
}
