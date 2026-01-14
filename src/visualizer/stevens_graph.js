import * as d3 from 'd3';

export function renderStevensGraph(streamData, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const packets = streamData.packets;
    if (packets.length === 0) return;

    // Dimensions
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    // Data Prep
    const startTime = packets[0].timestamp;
    const data = packets.map(p => ({
        relTime: p.timestamp - startTime, // microseconds usually
        seq: p.tcp ? p.tcp.seq : 0,
        len: p.payload ? p.payload.length / 2 : 0, // hex length / 2
        direction: (p.ip.src === packets[0].ip.src) ? 'out' : 'in',
        packet: p
    }));

    // SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.relTime)])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([d3.min(data, d => d.seq), d3.max(data, d => d.seq + d.len)])
        .range([height, 0]);

    // Axes
    const xAxis = d3.axisBottom(xScale).tickFormat(d => (d / 1000000).toFixed(2) + 's');
    const yAxis = d3.axisLeft(yScale).tickFormat(d3.format(".2s")); // SI prefix

    // Grid
    const makeXGrid = () => d3.axisBottom(xScale).ticks(10);
    const makeYGrid = () => d3.axisLeft(yScale).ticks(10);

    g.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(makeXGrid().tickSize(-height).tickFormat(""));

    g.append("g")
        .attr("class", "grid")
        .call(makeYGrid().tickSize(-width).tickFormat(""));

    // Draw Axes
    const gx = g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis);

    const gy = g.append('g')
        .call(yAxis);

    // Styles
    g.selectAll("text").attr("fill", "var(--text-secondary)").style("font-family", "var(--font-mono)");
    g.selectAll(".domain").attr("stroke", "var(--border-neon)");
    g.selectAll(".tick line").attr("stroke", "rgba(255,255,255,0.05)"); // Grid lines

    // Points / Lines
    g.selectAll("circle")
        .data(data)
        .join("circle")
        .attr("cx", d => xScale(d.relTime))
        .attr("cy", d => yScale(d.seq))
        .attr("r", 3)
        .attr("fill", d => d.direction === 'out' ? "var(--accent-danger)" : "var(--accent-blue)")
        .attr("opacity", 0.8)
        .append("title")
        .text(d => `Seq: ${d.seq}\nLen: ${d.len}`);

    // Zoom
    const zoom = d3.zoom()
        .scaleExtent([0.5, 20])
        .extent([[0, 0], [width, height]])
        .on("zoom", updateChart);

    svg.call(zoom);

    function updateChart(event) {
        // recover the new scale
        const newX = event.transform.rescaleX(xScale);
        const newY = event.transform.rescaleY(yScale);

        // update axes with these new boundaries
        gx.call(xAxis.scale(newX));
        gy.call(yAxis.scale(newY));

        // update circle position
        g.selectAll("circle")
            .attr('cx', d => newX(d.relTime))
            .attr('cy', d => newY(d.seq));

        // update grid
        // (Simplified: keeping grid static or implementing dynamic grid update is complex in d3 v7 concise snippet, 
        // usually we re-call the axis generator)
        g.selectAll(".grid").attr("opacity", event.transform.k > 0.8 ? 0.2 : 0); // Fade grid if zoomed out too much
    }
}
