import * as d3 from 'd3';

export class GraphSimulation {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.simulation = null;
        this.nodes = [];
        this.links = [];
        this.onTick = () => { };
    }

    init(nodes, links) {
        this.nodes = nodes;
        this.links = links;

        if (this.simulation) this.simulation.stop();

        // Configure Force Simulation
        // We use a stronger repulsion and collision to keep nodes clear
        this.simulation = d3.forceSimulation(this.nodes)
            .force("link", d3.forceLink(this.links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-500)) // Strong repulsion
            .force("center", d3.forceCenter(this.width / 2, this.height / 2))
            .force("collide", d3.forceCollide().radius(30).iterations(2))
            .velocityDecay(0.4) // Medium friction for organic movement
            .alphaMin(0.01)     // Stop sooner to save CPU
            .on("tick", () => {
                this.onTick();
            });
    }

    updateDimensions(width, height) {
        this.width = width;
        this.height = height;
        if (this.simulation) {
            this.simulation.force("center", d3.forceCenter(width / 2, height / 2));
            this.simulation.alpha(0.3).restart();
        }
    }

    // Helper for dragging
    dragStart(x, y, nodeId) {
        // Find node? Or assume renderer passes node reference?
        // Ideally renderer manages interaction-to-simulation mapping.
        // For d3 force, we usually set fx/fy.
    }

    stop() {
        if (this.simulation) this.simulation.stop();
    }
}
