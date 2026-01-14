import * as d3 from 'd3';

export function renderNetworkGraph(flows, containerId, onSelection) {
    const container = document.getElementById(containerId);
    if (!container) return; // Guard

    const width = container.clientWidth || 800; // Fallback width
    const height = container.clientHeight || 600; // Fallback height

    // Clear previous
    container.innerHTML = '';

    // Data Transformation
    const nodesMap = new Map();
    flows.forEach(f => {
        if (!nodesMap.has(f.source)) nodesMap.set(f.source, { id: f.source, value: 0 });
        if (!nodesMap.has(f.target)) nodesMap.set(f.target, { id: f.target, value: 0 });

        // Aggregate volume
        nodesMap.get(f.source).value += f.value;
        nodesMap.get(f.target).value += f.value;
    });

    const nodes = Array.from(nodesMap.values());
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
        .force('link', d3.forceLink(links).id(d => d.id).distance(150))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collide', d3.forceCollide().radius(d => Math.sqrt(d.value) / 10 + 15));

    // Link Lines
    const link = svg.append('g')
        .attr('stroke', '#38bdf8')
        .attr('stroke-opacity', 0.2)
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke-width', d => Math.min(Math.sqrt(d.value) / 100, 3) + 0.5)
        .attr('class', 'graph-link')
        .style('cursor', 'pointer')
        .on('click', (event, d) => {
            event.stopPropagation();
            if (onSelection) onSelection('link', d);
        });

    // Node Circles
    const node = svg.append('g')
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1.5)
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', d => Math.min(Math.sqrt(d.value) / 50 + 5, 25))
        .attr('fill', d => {
            if (d.id.startsWith('192.168.') || d.id.startsWith('10.')) return '#4ade80';
            if (d.id.includes(':')) return '#f472b6';
            return '#38bdf8';
        })
        .style("filter", "url(#glow)")
        .style("cursor", "pointer")
        .on('click', (event, d) => {
            event.stopPropagation();
            if (onSelection) onSelection('node', d);
        })
        .call(drag(simulation));

    // Deselect on background click
    svg.on('click', () => {
        if (onSelection) onSelection(null, null);
    });

    // Titles (Tooltips)
    node.append('title')
        .text(d => `${d.id}\n${formatBytes(d.value)}`);

    link.append('title')
        .text(d => `${d.source.id} → ${d.target.id}\n${formatBytes(d.value)}`);

    // Update positions
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
    });

    // Zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
            svg.selectAll('g').attr('transform', event.transform);
        });

    svg.call(zoom);
}

// Drag Helper
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

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
