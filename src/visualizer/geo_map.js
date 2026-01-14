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

    // 2. Graticule (Grid) - Denser for Cyberpunk look
    const graticule = d3.geoGraticule().step([10, 10]); // More lines
    globe.append("path")
        .datum(graticule())
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "var(--accent-cyan)")
        .attr("stroke-width", 0.3)
        .attr("stroke-opacity", 0.15);

    // 2.1 Equator / Prime Meridian - Stronger
    globe.append("path")
        .datum(d3.geoGraticule().outline())
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "var(--accent-cyan)")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.5);

    // 2.2 Continents (Try loading from CDN)
    const url = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

    d3.json(url).then(data => {
        // Dynamic Import topojson only if needed or assume d3 includes it? 
        // D3 v7 doesn't bundle topojson. We need to check if we can import it or if user has it.
        // The prompt says "build tool is Vite". We might not have topojson-client installed.
        // User said "dependencies: d3, d3-sankey, pixi.js, d3-geo". 
        // If topojson is not in package.json, we can't use it easily without installing.
        // BUT, we can use a pure GeoJSON endpoint or attempt to fetch topojson and ignore if fail.
        // Actually, let's use a GeoJSON source to avoid topojson dependency if possible?
        // Or just ask to install topojson-client?
        // Wait, user said "api hívás nélkül valami online forrást" - usually implies static file.

        // Let's try to simulate fetching a GeoJSON file instead which D3 can handle natively without topojson lib.
        // GeoJSON version of world map:
        // https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson

        const geoJsonUrl = "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";

        d3.json(geoJsonUrl).then(geojson => {
            globe.insert("g", ".graticule") // Insert before graticule or after?
                .selectAll("path")
                .data(geojson.features)
                .enter().append("path")
                .attr("d", path)
                .attr("fill", "#1e293b")
                .attr("stroke", "var(--accent-cyan)")
                .attr("stroke-width", 0.5)
                .attr("opacity", 0.3);
        }).catch(err => {
            console.warn("Could not load online map, falling back to procedural", err);
            renderProceduralContinents(globe, path);
        });

    }).catch(() => {
        renderProceduralContinents(globe, path);
    });

    // Fallback function
    function renderProceduralContinents(globe, path) {
        // ... (Keep the previous abstract polygon logic here as fallback)
        const techZones = [
            { type: "Polygon", coordinates: [[[-100, 40], [-80, 50], [-60, 30], [-80, 20], [-100, 40]]] }, // NA
            { type: "Polygon", coordinates: [[[10, 50], [40, 60], [50, 40], [20, 30], [10, 50]]] }, // EU
            { type: "Polygon", coordinates: [[[100, 40], [120, 50], [140, 30], [110, 20], [100, 40]]] }, // ASIA
            { type: "Polygon", coordinates: [[[-60, -20], [-40, -10], [-30, -30], [-50, -40], [-60, -20]]] }, // SA
            { type: "Polygon", coordinates: [[[20, -20], [40, -10], [50, -30], [30, -40], [20, -20]]] }, // AF
        ];
        globe.selectAll(".tech-zone")
            .data(techZones)
            .enter().append("path")
            .attr("d", path)
            .attr("fill", "var(--accent-cyan)")
            .attr("fill-opacity", 0.05)
            .attr("stroke", "var(--accent-cyan)")
            .attr("stroke-width", 0.5)
            .attr("stroke-dasharray", "4,2");
    }

    /* 
    // Commented out original procedural block to avoid duplicate declaration if strict
    // 2.2 Cyber Continents (Simulated with simple Polygons)
    // ...
    */

    // We need to move the ipToGo function outside or keep it clean


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

    // Draw Nodes (Sources/Targets) using Path for perfect sync
    // We convert points to GeoJSON Point features
    const pointFeatures = points.map(p => ({
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: p
        }
    }));

    globe.selectAll(".node")
        .data(pointFeatures)
        .enter().append("path")
        .attr("class", "node")
        .attr("d", path.pointRadius(2))
        .attr("fill", "var(--accent-cyan)")
        .attr("opacity", 0.6);

    // Interaction: Drag to Rotate, Scroll to Zoom
    const drag = d3.drag()
        .on("drag", (event) => {
            const rotate = projection.rotate();
            const k = sensitivity / projection.scale();
            projection.rotate([
                rotate[0] + event.dx * k,
                rotate[1] - event.dy * k
            ]);
            updateAll();
        });

    const zoom = d3.zoom()
        .scaleExtent([100, 1000])
        .on("zoom", (event) => {
            projection.scale(event.transform.k);
            updateAll();
        });

    function updateAll() {
        svg.selectAll("path").attr("d", path);
    }

    // Apply interactions to SVG wrapper (or a rect overlay)
    // To allow rotation everywhere, apply to svg
    svg.call(drag);
    svg.call(zoom)
        .call(zoom.transform, d3.zoomIdentity.scale(projection.scale()));

    const sensitivity = 75;

    // ... (rest of rendering)

    // Helper to update point positions (since they are circles, not paths in original code, but we moved to paths? 
    // Wait, previous code used circles for nodes. Let's switch nodes to use geoPath point features for easier sync, 
    // or manually update cx/cy.

    function updatePoints() {
        globe.selectAll(".node")
            .attr("cx", d => {
                const p = projection(d);
                return p ? p[0] : -10;
            })
            .attr("cy", d => {
                const p = projection(d);
                return p ? p[1] : -10;
            })
            // Hide if behind globe
            .attr("display", d => {
                const center = projection.invert([width / 2, height / 2]);
                const dist = d3.geoDistance(d, center);
                return (dist > 1.57) ? 'none' : 'block';
            });
    }

    // Packet Particles
    // Animate small circles moving along the connection paths
    const particles = [];
    links.forEach(l => {
        particles.push({
            link: l,
            t: Math.random(),
            speed: 0.005 + Math.random() * 0.005
        });
    });

    const particleGroup = svg.append("g").attr("class", "particles");

    // Animation Loop
    d3.timer((elapsed) => {
        // We disabled auto-rotation for manual control, or we can keep it until user interacts?
        // Let's rely on manual interaction now as requested.

        // Update Particles
        const particleSel = particleGroup.selectAll(".particle")
            .data(particles);

        particleSel.enter().append("circle")
            .attr("class", "particle")
            .attr("r", 2)
            .attr("fill", "#fff")
            .merge(particleSel)
            .attr("cx", d => {
                // Interpolate along Great Arc?
                // D3-geo doesn't give easy point-at-t.
                // But we can interpolate coordinates manually or use d3.geoInterpolate
                const interpolator = d3.geoInterpolate(d.link.source, d.link.target);
                const pos = interpolator(d.t);
                const projected = projection(pos);
                return projected ? projected[0] : -100;
            })
            .attr("cy", d => {
                const interpolator = d3.geoInterpolate(d.link.source, d.link.target);
                const pos = interpolator(d.t);
                const projected = projection(pos);
                return projected ? projected[1] : -100;
            })
            .attr("opacity", d => {
                // Fade if behind globe
                const interpolator = d3.geoInterpolate(d.link.source, d.link.target);
                const pos = interpolator(d.t);
                const center = projection.invert([width / 2, height / 2]);
                return (d3.geoDistance(pos, center) > 1.57) ? 0 : 1;
            });

        // Advance particles
        particles.forEach(p => {
            p.t += p.speed;
            if (p.t > 1) p.t = 0;
        });
    });
}
