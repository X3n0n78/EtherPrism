import * as d3 from 'd3';

export function renderTimeline(packets, containerId, onBrush) {
    const container = document.getElementById(containerId);
    if (!container) return; // Guard

    // Clear previous
    const svgEl = container.querySelector('svg');
    if (svgEl) svgEl.innerHTML = '';

    if (packets.length === 0) return;

    // Dimensions
    const margin = { top: 10, right: 20, bottom: 30, left: 40 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    // 1. Bin packets by time (e.g., 100 bins)
    const startTime = packets[0].timestamp;
    const endTime = packets[packets.length - 1].timestamp;
    const timeSpan = endTime - startTime;

    // Safety check for single packet or zero time
    if (timeSpan <= 0) return;

    const binCount = Math.min(100, Math.max(20, packets.length / 10)); // Dynamic bin count
    const binSize = timeSpan / binCount;

    const bins = new Array(Math.ceil(binCount)).fill(0);
    // Track time range for each bin
    const binTimes = [];

    for (let i = 0; i < bins.length; i++) {
        binTimes.push(startTime + (i * binSize));
    }

    packets.forEach(p => {
        const binIndex = Math.min(Math.floor((p.timestamp - startTime) / binSize), binCount - 1);
        bins[binIndex] += p.length; // Sum bytes
    });

    const maxBytes = Math.max(...bins);

    // 2. Setup D3
    const svg = d3.select(svgEl)
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

    // 3. Axes
    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat(d3.timeFormat("%H:%M:%S"));

    const yAxis = d3.axisLeft(yScale)
        .ticks(3)
        .tickFormat(d => formatBytes(d, 0));

    // Append Axes
    svg.append('g')
        .attr('class', 'axis axis-x')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis);

    svg.append('g')
        .attr('class', 'axis axis-y')
        .call(yAxis);

    // 4. Draw Bars
    svg.selectAll('rect')
        .data(bins)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', (d, i) => xScale(new Date(binTimes[i] * 1000)))
        .attr('y', d => yScale(d))
        .attr('width', (width / binCount) - 1)
        .attr('height', d => height - yScale(d))
        .append('title')
        .text((d, i) => `${d3.timeFormat("%H:%M:%S")(new Date(binTimes[i] * 1000))}\n${formatBytes(d)}`);

    // 5. Brush
    if (onBrush) {
        const brush = d3.brushX()
            .extent([[0, 0], [width, height]])
            .on("end", (event) => {
                if (!event.selection) {
                    onBrush(null, null); // Clear filter
                    return;
                }
                const [x0, x1] = event.selection;
                // Invert scale to get timestamps (seconds)
                const start = xScale.invert(x0).getTime() / 1000;
                const end = xScale.invert(x1).getTime() / 1000;
                onBrush(start, end);
            });

        svg.append("g")
            .attr("class", "brush")
            .call(brush);
    }
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
