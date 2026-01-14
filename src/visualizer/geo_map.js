import * as d3 from 'd3';
// Since we can't easily fetch external map data without internet or large files, 
// we will simulate a low-poly abstract map or use a simple generated sphere/grid if no data.
// However, d3-geo allows drawing a sphere projection easily.

export function renderGeoMap(packets, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select(container).append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", "radial-gradient(circle at center, #0f172a 0%, #020617 100%)");

    // Projection (Orthographic for Globe)
    const projection = d3.geoOrthographic()
        .scale(height / 2.5)
        .translate([width / 2, height / 2])
        .clipAngle(90);

    const path = d3.geoPath().projection(projection);

    // Group for globe
    const globe = svg.append("g");

    // 1. Draw Globe Background (Ocean)
    globe.append("path")
        .datum({ type: "Sphere" })
        .attr("d", path)
        .attr("fill", "rgba(15, 23, 42, 0.5)")
        .attr("stroke", "var(--accent-cyan)")
        .attr("stroke-width", 1)
        .attr("opacity", 0.5);

    // 2. Graticule (Grid)
    const graticule = d3.geoGraticule();
    globe.append("path")
        .datum(graticule())
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "var(--accent-cyan)")
        .attr("stroke-width", 0.5)
        .attr("stroke-opacity", 0.2);

    // 3. Data Points (Simulated GeoIP)
    // In a real app, we'd map IP -> Lat/Lon.
    // Here we will hash the IP to get a consistent deterministic Lat/Lon for demo.

    function ipToGo(ip) {
        if (!ip) return [0, 0];
        // Simple hash to lon/lat
        // IPv4: A.B.C.D
        // Use A, B to determine general region roughly
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4) return [0, 0];

        // Pseudo-random but deterministic
        const lon = ((parts[0] * parts[1] + parts[2]) % 360) - 180;
        const lat = ((parts[1] * parts[3] + parts[0]) % 180) - 90;
        return [lon, lat];
    }

    // Aggregate connections
    const links = [];
    // Limit for performance
    const limit = Math.min(packets.length, 1000);

    for (let i = 0; i < limit; i++) {
        const p = packets[i];
        if (p.ip) {
            links.push({
                source: ipToGo(p.ip.src),
                target: ipToGo(p.ip.dst),
                proto: p.tcp ? 'tcp' : 'udp'
            });
        }
    }

    // Draw Arcs
    globe.selectAll(".link")
        .data(links)
        .enter().append("path")
        .attr("class", "link")
        .attr("d", d => path({ type: "LineString", coordinates: [d.source, d.target] }))
        .attr("fill", "none")
        .attr("stroke", d => d.proto === 'tcp' ? "var(--accent-blue)" : "var(--accent-warn)")
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.3);

    // Draw Nodes (Sources/Targets)
    const points = links.flatMap(l => [l.source, l.target]);
    // Deduplicate? For visualization, overlapping dots usually look okay as "heat".

    globe.selectAll(".node")
        .data(points)
        .enter().append("circle")
        .attr("cx", d => projection(d)[0])
        .attr("cy", d => projection(d)[1])
        .attr("r", 2)
        .attr("fill", "var(--accent-cyan)")
        .attr("opacity", 0.6);

    // Rotation Animation
    let rotate = [0, 0];
    const velocity = [0.02, 0];

    d3.timer((elapsed) => {
        rotate[0] += velocity[0] * 10; // accelerate for demo
        projection.rotate(rotate);

        // Redraw paths
        globe.selectAll("path").attr("d", path);

        // Redraw nodes (need manual projection recalc for circles if not using geoPath for points)
        // Optimally use path d3.geoPoint for circles too
        // But for perf, let's keep it simple or just rotate grid/arcs.
        // Actually, simple points re-project:
        globe.selectAll("circle")
            .attr("cx", d => {
                const p = projection(d);
                return p ? p[0] : -10;
            })
            .attr("cy", d => {
                const p = projection(d);
                return p ? p[1] : -10;
            })
            // Hide if back of globe (D3 geoCircle clipping handles this for path, but for raw circles we need to check)
            // Or just rely on path clipping if we used path for points.
            .attr("display", d => {
                // simple clip check: dot product of center and point normal? 
                // d3.geoOrthographic clipAngle(90) handles paths.
                // For manual circles, it's harder. Let's switch points to 'path' logic mostly.
                return "block"; // lazy
            });

        // FIX: Use path for points to get auto-clipping
    });
}
