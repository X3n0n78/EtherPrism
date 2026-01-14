import * as d3 from 'd3';

// Icon Paths (Lucide-like)
const ICONS = {
    // 24x24 ViewBox normalized to -12 -12 24 24 approx or just scale it
    pc: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", // User
    server: "M2 20h20 M2 4h20 M2 12h20 M2 4v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z M6 8h.01 M6 16h.01", // Rack
    router: "M22 12h-4l-3 9L9 3l-3 9H2", // Activity/Pulse like router
    globe: "M22 12A10 10 0 1 1 12 2a10 10 0 0 1 10 10z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" // Globe
};

export function renderNetworkGraph(flows, containerId, onSelection, onHideNode) {
    const container = document.getElementById(containerId);
    if (!container) return; // Guard

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Clear previous
    container.innerHTML = '';

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
        value: f.value
    }));

    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .style('background', 'transparent');

    // Simulation
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => (d.value ? 25 : 10) + 5).iterations(2));

    const g = svg.append('g');

    // Link Lines
    const link = g.append('g')
        .attr('stroke', '#334155')
        .attr('stroke-opacity', 0.4)
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke-width', d => Math.min(Math.sqrt(d.value) / 100, 3) + 0.5)
        .attr('class', 'graph-link');

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
        .attr('r', 20)
        .attr('fill', 'var(--accent-primary)')
        .attr('opacity', 0.1)
        .attr('class', 'halo');

    // Icon Background
    node.append('circle')
        .attr('r', 12)
        .attr('fill', 'var(--bg-card)')
        .attr('stroke', d => getNodeColor(d.type))
        .attr('stroke-width', 2);

    // Icons
    node.append('path')
        .attr('d', d => getIconPath(d.type))
        .attr('fill', 'none')
        .attr('stroke', d => getNodeColor(d.type))
        .attr('stroke-width', 1.5)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('transform', 'scale(0.7) translate(-12, -12)'); // Center icon

    // Text Label
    node.append('text')
        .text(d => d.id)
        .attr('x', 0)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .attr('class', d => `graph-label ${d.type}`);

    // Interactions
    node.on('click', (event, d) => {
        event.stopPropagation();
        if (onSelection) onSelection('node', d);
        hideContextMenu();
    });

    node.on('contextmenu', (event, d) => {
        event.preventDefault();
        showContextMenu(event, d, onSelection, onHideNode);
    });

    // Deselect
    svg.on('click', () => {
        if (onSelection) onSelection(null, null);
        hideContextMenu();
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
function detectType(ip, connections) {
    if (ip.endsWith('.1') || ip.endsWith('.254')) return 'gateway';
    if (connections > 5) return 'server';
    if (!ip.startsWith('192.') && !ip.startsWith('10.') && !ip.startsWith('172.')) return 'wan';
    return 'pc';
}

function getNodeColor(type) {
    switch (type) {
        case 'gateway': return 'var(--accent-warning)';
        case 'server': return 'var(--accent-danger)';
        case 'wan': return 'var(--accent-purple, #a855f7)';
        default: return 'var(--accent-primary)';
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

    return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
}

// Context Menu Logic
function showContextMenu(event, data, onSelection, onHideNode) {
    hideContextMenu(); // Close existing

    const menu = document.createElement('div');
    menu.id = 'graph-context-menu';
    menu.className = 'context-menu';
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;

    const items = [
        { label: '🔍 Focus Node', action: () => onSelection('node', data) },
        { label: '📋 ‘Copy IP’', action: () => navigator.clipboard.writeText(data.id) },
        { type: 'separator' },
        { label: '👁️ Hide Node', action: () => { if (onHideNode) onHideNode(data.id); } }
    ];

    items.forEach(item => {
        if (item.type === 'separator') {
            const sep = document.createElement('div');
            sep.className = 'context-menu-separator';
            menu.appendChild(sep);
        } else {
            const div = document.createElement('div');
            div.className = 'context-menu-item';
            div.textContent = item.label;
            div.onclick = () => {
                item.action();
                hideContextMenu();
            };
            menu.appendChild(div);
        }
    });

    document.body.appendChild(menu);
}

function hideContextMenu() {
    const menu = document.getElementById('graph-context-menu');
    if (menu) menu.remove();
}
