import * as d3 from 'd3';
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey';

export function renderSankey(flows, containerId) {
    const container = document.getElementById(containerId);
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear previous
    container.innerHTML = '';

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .style('max-width', '100%')
        .style('height', 'auto');

    // Transform data for Sankey: Needs { nodes, links }
    // flows is Array<{ source: IP, target: IP, value: bytes }>

    const nodesSet = new Set();
    flows.forEach(f => {
        nodesSet.add(f.source);
        nodesSet.add(f.target);
    });

    const nodes = Array.from(nodesSet).map(name => ({ name }));
    const nameMap = new Map(nodes.map((d, i) => [d.name, i]));

    const links = flows.map(f => ({
        source: nameMap.get(f.source),
        target: nameMap.get(f.target),
        value: f.value
    }));

    // Configure Sankey Generator
    const sankeyGenerator = d3Sankey()
        .nodeId(d => d.index)
        .nodeWidth(15)
        .nodePadding(10)
        .extent([[1, 5], [width - 1, height - 5]]);

    const { nodes: graphNodes, links: graphLinks } = sankeyGenerator({
        nodes: nodes.map(d => Object.assign({}, d)),
        links: links.map(d => Object.assign({}, d))
    });

    // Define Gradients
    const defs = svg.append('defs');

    // Draw Links
    const link = svg.append('g')
        .attr('fill', 'none')
        .attr('stroke-opacity', 0.5)
        .selectAll('g')
        .data(graphLinks)
        .join('g')
        .style('mix-blend-mode', 'screen'); // Cool glowing effect

    const gradient = link.append('linearGradient')
        .attr('id', d => (d.uid = `link-${d.index}`))
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', d => d.source.x1)
        .attr('x2', d => d.target.x0);

    gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#38bdf8'); // Source color (Cyan)

    gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#818cf8'); // Target color (Indigo)

    link.append('path')
        .attr('d', sankeyLinkHorizontal())
        .attr('stroke', d => `url(#${d.uid})`)
        .attr('stroke-width', d => Math.max(1, d.width));

    link.append('title')
        .text(d => `${d.source.name} → ${d.target.name}\n${formatBytes(d.value)}`);

    // Draw Nodes
    svg.append('g')
        .selectAll('rect')
        .data(graphNodes)
        .join('rect')
        .attr('x', d => d.x0)
        .attr('y', d => d.y0)
        .attr('height', d => d.y1 - d.y0)
        .attr('width', d => d.x1 - d.x0)
        .attr('fill', '#f8fafc')
        .attr('opacity', 0.8)
        .append('title')
        .text(d => `${d.name}\n${formatBytes(d.value)}`);

    // Draw Labels
    svg.append('g')
        .attr('font-family', 'sans-serif')
        .attr('font-size', 10)
        .attr('fill', '#94a3b8') // Secondary text color
        .selectAll('text')
        .data(graphNodes)
        .join('text')
        .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
        .attr('y', d => (d.y1 + d.y0) / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
        .text(d => d.name);
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
