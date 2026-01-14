import * as d3 from 'd3';

export function renderTimeline(packets, containerId, onBrush) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear previous
    container.innerHTML = '';

    if (packets.length === 0) return;

    // Dimensions
    const margin = { top: 10, right: 20, bottom: 25, left: 50 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    // 1. Bin data
    const startTime = packets[0].timestamp;
    const endTime = packets[packets.length - 1].timestamp;
    const timeSpan = endTime - startTime;
    if (timeSpan <= 0) return;

    const binCount = Math.min(120, Math.max(40, width / 10)); // Responsive bin count
    const binSize = timeSpan / binCount;

    const bins = new Array(Math.ceil(binCount)).fill(0);
    const binTimes = [];
    for (let i = 0; i < bins.length; i++) binTimes.push(startTime + (i * binSize));

    packets.forEach(p => {
        const binIndex = Math.min(Math.floor((p.timestamp - startTime) / binSize), binCount - 1);
        bins[binIndex] += p.length;
    });

    const maxBytes = Math.max(...bins);

    // 2. Setup SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleTime()
        .domain([new Date(startTime * 1000), new Date(endTime * 1000)])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, maxBytes])
        .range([height, 0]);

    // 3. Axes with Theme Styles
    const xAxis = d3.axisBottom(xScale)
        .ticks(width / 100)
        .tickFormat(d3.timeFormat("%H:%M:%S"));

    const yAxis = d3.axisLeft(yScale)
        .ticks(4)
        .tickFormat(d => formatBytes(d, 0));

    // Append Axes
    const xAxisG = svg.append('g')
        .attr('class', 'axis axis-x')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis);

    // Style Axis Text
    xAxisG.selectAll("text")
        .style("fill", "var(--text-secondary)")
        .style("font-family", "var(--font-mono)");
    xAxisG.selectAll("line").style("stroke", "var(--border-neon)");
    xAxisG.selectAll("path").style("stroke", "var(--border-neon)");

    const yAxisG = svg.append('g')
        .attr('class', 'axis axis-y')
        .call(yAxis);

    yAxisG.selectAll("text")
        .style("fill", "var(--text-secondary)")
        .style("font-family", "var(--font-mono)");
    yAxisG.selectAll("line").style("stroke", "var(--border-neon)");
    yAxisG.selectAll("path").style("stroke", "var(--border-neon)");

    // 4. Draw Bars (Neon Style)
    svg.selectAll('rect')
        .data(bins)
        .join('rect')
        .attr('x', (d, i) => xScale(new Date(binTimes[i] * 1000)))
        .attr('y', d => yScale(d))
        .attr('width', Math.max(1, (width / binCount) - 2)) // Gap between bars
        .attr('height', d => height - yScale(d))
        .attr('fill', 'var(--accent-cyan)')
        .attr('opacity', 0.6)
        .on("mouseover", function () { d3.select(this).attr("opacity", 1).attr("fill", "var(--accent-magenta)"); })
        .on("mouseout", function () { d3.select(this).attr("opacity", 0.6).attr("fill", "var(--accent-cyan)"); });

    // 5. Brush
    if (onBrush) {
        const brush = d3.brushX()
            .extent([[0, 0], [width, height]])
            .on("end", (event) => {
                if (!event.selection) {
                    onBrush(null, null);
                    return;
                }
                const [x0, x1] = event.selection;
                const start = xScale.invert(x0).getTime() / 1000;
                const end = xScale.invert(x1).getTime() / 1000;
                onBrush(start, end);
            });

        const brushG = svg.append("g")
            .attr("class", "brush")
            .call(brush);

        // Style Brush
        brushG.selectAll(".selection")
            .style("fill", "var(--accent-cyan)")
            .style("fill-opacity", "0.2")
            .style("stroke", "var(--accent-cyan)");
    }
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}
