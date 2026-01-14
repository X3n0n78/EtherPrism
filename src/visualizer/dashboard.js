import * as d3 from 'd3';

export function renderDashboard(packets, containerId, onClose) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Data Preparation
    const protocolStats = {};
    const ipBytes = {};

    packets.forEach(p => {
        // Protocol Stats
        let proto = 'Other';
        if (p.tcp) proto = 'TCP';
        else if (p.udp) proto = 'UDP';

        // Refine with App Layer if available
        if (p.app && p.app.type) {
            proto = p.app.type; // HTTP, DNS, TLS
        }

        protocolStats[proto] = (protocolStats[proto] || 0) + 1;

        // Top Talkers (Bytes Source)
        if (p.ip) {
            ipBytes[p.ip.src] = (ipBytes[p.ip.src] || 0) + p.length;
        }
    });

    const protocolData = Object.entries(protocolStats)
        .map(([key, value]) => ({ label: key, value }))
        .sort((a, b) => b.value - a.value);

    const topTalkersData = Object.entries(ipBytes)
        .map(([ip, bytes]) => ({ ip, bytes }))
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 10); // Top 10

    // Render HTML Structure
    container.innerHTML = `
        <div class="dashboard-overlay">
            <div class="dashboard-content">
                <div class="dashboard-header">
                    <h2>📊 Network Statistics</h2>
                    <button id="close-dashboard-btn" class="close-btn">×</button>
                </div>
                <div class="charts-grid">
                    <div class="chart-card">
                        <h3>Protocol Distribution (Packets)</h3>
                        <div id="protocol-chart"></div>
                    </div>
                    <div class="chart-card">
                        <h3>Top Talkers (By Volume)</h3>
                        <div id="top-talkers-chart"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.classList.remove('hidden');

    // Event Listeners
    document.getElementById('close-dashboard-btn').onclick = () => {
        container.classList.add('hidden');
        if (onClose) onClose();
    };

    // Render Charts
    renderProtocolPieChart(protocolData, '#protocol-chart');
    renderTopTalkersBarChart(topTalkersData, '#top-talkers-chart');
}

function renderProtocolPieChart(data, selector) {
    const container = document.querySelector(selector);
    const width = container.clientWidth || 400;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 20;

    const svg = d3.select(selector)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.label))
        .range(d3.schemeTableau10);

    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(radius * 0.5) // Donut chart
        .outerRadius(radius * 0.8);

    const outerArc = d3.arc()
        .innerRadius(radius * 0.9)
        .outerRadius(radius * 0.9);

    const arcs = svg.selectAll('arc')
        .data(pie(data))
        .enter()
        .append('g')
        .attr('class', 'arc');

    arcs.append('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.label))
        .attr('stroke', 'var(--bg-card)')
        .style('stroke-width', '2px')
        .on('mouseover', function (event, d) {
            d3.select(this).transition().duration(200).attr('d', d3.arc().innerRadius(radius * 0.5).outerRadius(radius * 0.85));
            // Tooltip could go here
        })
        .on('mouseout', function (event, d) {
            d3.select(this).transition().duration(200).attr('d', arc);
        });

    // Labels
    const text = arcs.append('text')
        .attr('transform', d => {
            const pos = outerArc.centroid(d);
            const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
            pos[0] = radius * 0.95 * (midAngle < Math.PI ? 1 : -1);
            return `translate(${pos})`;
        })
        .attr('dy', '.35em')
        .text(d => d.data.value > (d3.sum(data, x => x.value) * 0.02) ? d.data.label : '') // Hide small labels
        .attr('text-anchor', d => {
            const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
            return midAngle < Math.PI ? 'start' : 'end';
        })
        .style('fill', 'var(--text-primary)')
        .style('font-size', '12px');

    // Polylines
    arcs.append('polyline')
        .attr('points', d => {
            if (d.data.value <= (d3.sum(data, x => x.value) * 0.02)) return []; // Hide lines for small slices
            const pos = outerArc.centroid(d);
            const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
            pos[0] = radius * 0.95 * (midAngle < Math.PI ? 1 : -1);
            return [arc.centroid(d), outerArc.centroid(d), pos];
        })
        .style('fill', 'none')
        .style('stroke', 'var(--text-muted)')
        .style('stroke-width', 1);
}

function renderTopTalkersBarChart(data, selector) {
    const container = document.querySelector(selector);
    const margin = { top: 20, right: 30, bottom: 40, left: 120 }; // More left for IP labels
    const width = (container.clientWidth || 400) - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(selector)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // X axis: Bytes
    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.bytes)])
        .range([0, width]);

    svg.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".2s")))
        .selectAll("text")
        .style("fill", "var(--text-muted)");

    // Y axis: IP
    const y = d3.scaleBand()
        .range([0, height])
        .domain(data.map(d => d.ip))
        .padding(0.2);

    svg.append('g')
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("fill", "var(--text-primary)")
        .style("font-family", "JetBrains Mono");

    // Bars
    svg.selectAll("myRect")
        .data(data)
        .join("rect")
        .attr("x", x(0))
        .attr("y", d => y(d.ip))
        .attr("width", d => x(d.bytes))
        .attr("height", y.bandwidth())
        .attr("fill", "var(--accent-primary)")
        .attr("rx", 4)
        .on("mouseover", function () { d3.select(this).attr("fill", "var(--accent-secondary)"); })
        .on("mouseout", function () { d3.select(this).attr("fill", "var(--accent-primary)"); });

    // Labels inside bars (if fits)
    svg.selectAll(".bar-label")
        .data(data)
        .enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.bytes) + 5)
        .attr("y", d => y(d.ip) + y.bandwidth() / 2 + 4)
        .text(d => formatBytes(d.bytes))
        .style("fill", "var(--text-muted)")
        .style("font-size", "10px");
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
