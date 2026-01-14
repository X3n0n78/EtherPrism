import * as d3 from 'd3';
import * as PIXI from 'pixi.js';

let app = null;
let containerEl = null;

export async function renderGeoMap(packets, containerId) {
    try {
        containerEl = document.getElementById(containerId);
        if (!containerEl) return;

        // Cleanup previous instance
        if (app) {
            app.destroy(true, { children: true, texture: true, baseTexture: true });
            app = null;
        }

        containerEl.innerHTML = '';
        containerEl.className = 'map-container';

        const width = containerEl.clientWidth;
        const height = containerEl.clientHeight;

        // --- Pixi Setup (v8 Syntax) ---
        app = new PIXI.Application();

        await app.init({
            width: width,
            height: height,
            backgroundAlpha: 0, // Transparent
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            preference: 'webgl' // Prefer WebGL
        });

        // v8 uses app.canvas instead of app.view
        containerEl.appendChild(app.canvas);

        // --- Projection (Math only) ---
        const projection = d3.geoOrthographic()
            .scale(height / 2.2)
            .translate([width / 2, height / 2])
            .clipAngle(90);

        const path = d3.geoPath().projection(projection);

        // --- Containers ---
        const globeContainer = new PIXI.Container();
        const mapContainer = new PIXI.Container(); // Rotating part
        const particleContainer = new PIXI.Container();

        app.stage.addChild(globeContainer);
        app.stage.addChild(mapContainer);
        app.stage.addChild(particleContainer);


        // --- Graphics Objects ---
        const sphereGfx = new PIXI.Graphics();
        const graticuleGfx = new PIXI.Graphics();
        const landGfx = new PIXI.Graphics();
        const linksGfx = new PIXI.Graphics();
        const markersGfx = new PIXI.Graphics();

        // Static Sphere Background (Ocean)
        sphereGfx.circle(width / 2, height / 2, projection.scale());
        sphereGfx.fill({ color: 0x0f172a, alpha: 0.5 });
        sphereGfx.stroke({ width: 1, color: 0x1e293b });
        globeContainer.addChild(sphereGfx);

        // Add other layers
        mapContainer.addChild(graticuleGfx);
        mapContainer.addChild(landGfx);
        mapContainer.addChild(linksGfx);
        mapContainer.addChild(markersGfx);


        // --- Data Prep ---
        const nodes = new Map();
        const links = [];
        const limit = 2000; // Increased limit for WebGL

        function getCoords(ip) {
            if (!ip) return [0, 0];
            const parts = ip.split('.').map(Number);
            if (parts.length !== 4) return [0, 0];
            const lon = ((parts[0] * 97 + parts[1] * 11) % 360) - 180;
            const lat = ((parts[2] * 43 + parts[3] * 7) % 160) - 80;
            return [lon, lat];
        }

        packets.slice(0, limit).forEach(p => {
            if (!p.ip) return;
            const src = p.ip.src;
            const dst = p.ip.dst;

            if (!nodes.has(src)) nodes.set(src, { id: src, coords: getCoords(src) });
            if (!nodes.has(dst)) nodes.set(dst, { id: dst, coords: getCoords(dst) });

            links.push({
                source: nodes.get(src).coords,
                target: nodes.get(dst).coords,
                protocol: p.tcp ? 'tcp' : 'udp',
                color: p.tcp ? 0x38bdf8 : 0xf59e0b
            });
        });

        const nodeList = Array.from(nodes.values());
        console.log(`[GeoMapGL] Loaded ${nodeList.length} Nodes, ${links.length} Links`);

        // --- Load World Data ---
        let worldFeatures = [];
        const graticuleObj = d3.geoGraticule10 ? d3.geoGraticule10() : d3.geoGraticule(); // Helper for older versions

        fetch("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
            .then(res => res.json())
            .then(data => {
                worldFeatures = data.features;
            })
            .catch(err => console.warn("GeoJSON fallback", err));

        // --- Particles ---
        const particles = links.map(l => ({
            link: l,
            t: Math.random(),
            speed: 0.003 + Math.random() * 0.005,
            gfx: new PIXI.Graphics()
        }));

        particles.forEach(p => {
            // v8 Graphics API: circle(x,y,r).fill(color)
            p.gfx.circle(0, 0, 2);
            p.gfx.fill(0xFFFFFF);
            particleContainer.addChild(p.gfx);
        });


        // --- Animation State ---
        const config = { speed: 0.005, sensitivity: 75 };
        let isDragging = false;
        let rotation = [0, -20]; // Initial rotation

        // --- Interaction (D3 Drag on Canvas) ---
        // We attach D3 drag behavior to the canvas element
        const canvas = d3.select(app.canvas);

        const drag = d3.drag()
            .on("start", () => { isDragging = true; })
            .on("drag", (event) => {
                const k = config.sensitivity / projection.scale();
                rotation[0] += event.dx * k;
                rotation[1] -= event.dy * k;
                projection.rotate(rotation);
            })
            .on("end", () => { isDragging = false; });

        const zoom = d3.zoom()
            .scaleExtent([200, 1000])
            .on("zoom", (event) => {
                const newScale = event.transform.k;
                projection.scale(newScale);

                // Resize static sphere (Pixi v8)
                sphereGfx.clear();
                sphereGfx.circle(width / 2, height / 2, newScale);
                sphereGfx.fill({ color: 0x0f172a, alpha: 0.5 });
                sphereGfx.stroke({ width: 1, color: 0x1e293b });
            });

        canvas.call(drag);
        canvas.call(zoom).call(zoom.transform, d3.zoomIdentity.scale(projection.scale()));


        // --- Render Loop ---
        app.ticker.add(() => {
            if (!app || !app.stage) return;

            // 1. Auto Rotate
            if (!isDragging) {
                rotation[0] += 0.1;
                projection.rotate(rotation);
            } else {
                projection.rotate(rotation);
            }

            // 2. Draw World & Graticule
            // Graticule
            graticuleGfx.clear();
            const gratCtx = getPixiContext(graticuleGfx);
            // .stroke() needs to be called after path for context? 
            // Our context proxy mimics 2D canvas, using direct PIXI calls.
            // Pixi v8 expects explicit Stroke styles usually?
            // Actually, we can just use `lineStyle` (deprecated but works) or `stroke`?
            // Let's stick to our proxy mapping to `graphics` methods.
            // In v8 `moveTo`, `lineTo` work, but `stroke()` needs to be called?
            // "GraphicsContext" is complex.
            // Simplest v8: `graphics.moveTo(..).lineTo(..).stroke(...)`.
            // D3 path calls `moveTo`, `lineTo`. It doesn't call `stroke`.
            // So we must set style BEFORE (in v7) or call `stroke` AFTER (in v8)?
            // v8: `graphics.beginPath()...stroke()`.

            // To be safe with v8 and D3's synchronous drawing:
            // We set the stroke style first using modern v8 `setStrokeStyle` equivalent or just `stroke(...)` at the end?
            // Actually D3 sends commands. We need to execute them.
            // Let's use `graphics.moveTo` etc. and then `graphics.stroke(...)`.

            // But D3 calls multiple sub-paths.
            // We'll define a robust context.

            // Graticule Style
            // graticuleGfx.strokeStyle = { width: 1, color: 0x00f3ff, alpha: 0.15 }; // v7?
            // v8: `graphics.context.stroke(...)` but `graphics` is high level.

            // Let's iterate using D3 path.

            // v8 workaround: D3 path expects a context with 2D-API.
            // We can wrap it.

            path.context(gratCtx)(graticuleObj);
            graticuleGfx.stroke({ width: 1, color: 0x00f3ff, alpha: 0.15 });


            // Land
            landGfx.clear();
            const landCtx = getPixiContext(landGfx);
            if (worldFeatures.length > 0) {
                worldFeatures.forEach(f => {
                    path.context(landCtx)(f);
                    // Fill and Stroke for each feature? 
                    // D3 path just traces.
                });
                landGfx.fill({ color: 0x0f172a, alpha: 0.8 });
                landGfx.stroke({ width: 1, color: 0x38bdf8, alpha: 0.4 });
            }

            // Links
            linksGfx.clear();
            const linkCtx = getPixiContext(linksGfx);
            links.forEach(l => {
                // For efficiency, we should batch. But simple loop is okay for <2000 lines.
                // Ideally we draw all TCP then all UDP.
            });

            // Optimization: Draw all same-colored links in one path
            const tcpLinks = links.filter(l => l.protocol === 'tcp');
            const udpLinks = links.filter(l => l.protocol !== 'tcp');

            // Draw TCP
            linksGfx.beginPath(); // v8
            tcpLinks.forEach(l => {
                path.context(linkCtx)({ type: "LineString", coordinates: [l.source, l.target] });
            });
            linksGfx.stroke({ width: 1, color: 0x38bdf8, alpha: 0.3 });

            // Draw UDP
            linksGfx.beginPath();
            udpLinks.forEach(l => {
                path.context(linkCtx)({ type: "LineString", coordinates: [l.source, l.target] });
            });
            linksGfx.stroke({ width: 1, color: 0xf59e0b, alpha: 0.3 });


            // Markers
            markersGfx.clear();
            const center = projection.invert([width / 2, height / 2]);
            const isVisible = (coords) => center && d3.geoDistance(coords, center) <= 1.57;

            nodeList.forEach(n => {
                if (isVisible(n.coords)) {
                    const p = projection(n.coords);
                    if (p) {
                        markersGfx.circle(p[0], p[1], 2);
                    }
                }
            });
            markersGfx.fill({ color: 0x38bdf8, alpha: 0.8 });


            // Particles
            particles.forEach(p => {
                p.t += p.speed;
                if (p.t > 1) p.t = 0;

                const interpolator = d3.geoInterpolate(p.link.source, p.link.target);
                const geoPos = interpolator(p.t);

                if (isVisible(geoPos)) {
                    const screenPos = projection(geoPos);
                    if (screenPos) {
                        p.gfx.visible = true;
                        p.gfx.x = screenPos[0];
                        p.gfx.y = screenPos[1];
                        return;
                    }
                }
                p.gfx.visible = false;
            });
        });

    } catch (err) {
        console.error("Map Render Fail:", err);
        if (containerEl) {
            containerEl.innerHTML = `<div class="error-msg" style="color:red; p:20px;">WebGL Error: ${err.message}</div>`;
        }
    }
}

// v8-Compatible Context Proxy
function getPixiContext(graphics) {
    return {
        beginPath: () => { /* graphics.beginPath() called manually */ },
        moveTo: (x, y) => graphics.moveTo(x, y),
        lineTo: (x, y) => graphics.lineTo(x, y),
        arc: (x, y, r, sa, ea, ccw) => graphics.arc(x, y, r, sa, ea, ccw),
        closePath: () => graphics.closePath(),
    };
}
