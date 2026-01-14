import * as PIXI from 'pixi.js';
import * as d3 from 'd3';

export function renderNetworkGraphGL(data, containerId, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Pixi App
    const app = new PIXI.Application({
        width: width,
        height: height,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
    });
    container.appendChild(app.view);

    // Data prep
    // Extract nodes from flows
    const nodesMap = new Map();
    data.forEach(link => {
        if (!nodesMap.has(link.source)) nodesMap.set(link.source, { id: link.source, val: 0, connections: 0, type: 'endpoint' });
        if (!nodesMap.has(link.target)) nodesMap.set(link.target, { id: link.target, val: 0, connections: 0, type: 'endpoint' });

        nodesMap.get(link.source).val += link.value || 0;
        nodesMap.get(link.source).connections++;
        nodesMap.get(link.target).val += link.value || 0;
        nodesMap.get(link.target).connections++;
    });
    const nodes = Array.from(nodesMap.values());
    // Links need source/target as objects for d3 force
    const links = data.map(d => ({ ...d }));

    // Sim
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .stop(); // We will tick manually or in Pixi loop

    // Graphics
    const linkGraphics = new PIXI.Graphics();
    const nodeGraphics = new PIXI.Graphics();
    app.stage.addChild(linkGraphics);
    app.stage.addChild(nodeGraphics);

    // Interaction
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    // Zoom/Pan Container (logic omitted for brevity, usually needs a parent Container)

    // Render Loop
    // Run simulation for N ticks to settle or run live
    // Running live might be heavy if mixed with Pixi, but Pixi is fast.

    app.ticker.add(() => {
        simulation.tick();

        // Clear
        linkGraphics.clear();
        nodeGraphics.clear();

        // Draw Links
        linkGraphics.lineStyle(1, 0x0ea5e9, 0.3); // Accent Blue
        links.forEach(d => {
            linkGraphics.moveTo(d.source.x, d.source.y);
            linkGraphics.lineTo(d.target.x, d.target.y);
        });

        // Draw Nodes
        nodes.forEach(d => {
            const color = d.type === 'gateway' ? 0xd946ef : (d.type === 'server' ? 0x22d3ee : 0x6366f1);
            nodeGraphics.beginFill(color, 0.8);
            nodeGraphics.drawCircle(d.x, d.y, 5); // Radius 5
            nodeGraphics.endFill();

            // Text? Pixi text is expensive if too many. Use bitmap text or omit for large graphs.
        });
    });

    // Cleanup reference
    // container.app = app;
}
