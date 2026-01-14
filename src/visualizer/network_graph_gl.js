import * as PIXI from 'pixi.js';
import { GraphSimulation } from './graph_simulation.js';

// Configuration
const COLOR_BG = 0x050510; // Deep space dark
const COLORS = {
    gateway: 0xff00ff, // Magenta Neon
    server: 0x00ffff,  // Cyan Neon
    pc: 0x4444ff,      // Blue Neon
    wan: 0x888888      // Grey
};
const LINK_COLORS = {
    TCP: 0x3b82f6,
    UDP: 0x10b981,
    DEFAULT: 0x0ea5e9
};

export class NetworkGraphRenderer {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.app = null;
        this.simulation = null;

        // Scene Graph
        this.viewport = null;
        this.layers = {
            links: null,
            particles: null,
            nodes: null,
            ui: null
        };

        // State
        this.nodes = [];
        this.links = [];
        this.nodeSprites = new Map();

        // Interaction
        this.selectedId = null;
        this.hoveredId = null;
        this.isDragging = false;
        this.dragData = null;

        // Callbacks
        this.onSelection = () => { };
    }

    async init(flows, onSelection) {
        if (!this.container) return;
        this.onSelection = onSelection;

        // Cleanup existing
        this.destroy();

        // 1. Initialize Pixi Application
        this.app = new PIXI.Application();
        await this.app.init({
            width: this.container.clientWidth,
            height: this.container.clientHeight,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            background: COLOR_BG,
            start: false // Use custom ticker loop logic if needed, or just let it run
        });

        this.container.appendChild(this.app.canvas);

        // 2. Setup Scene
        this.setupScene();

        // 3. Process Data
        this.processData(flows);

        // 4. Setup Simulation
        this.simulation = new GraphSimulation(this.app.screen.width, this.app.screen.height);
        this.simulation.onTick = () => this.updatePositions();
        this.simulation.init(this.nodes, this.links);

        // 5. Setup Events
        this.setupInteraction();

        // 6. Start Loop
        this.app.start();
        this.app.ticker.add((ticker) => this.tick(ticker));
    }

    setupScene() {
        // Root Container (Camera)
        this.viewport = new PIXI.Container();
        this.viewport.sortableChildren = true;

        // Center the viewport initially (optional, or rely on simulation centering)
        // this.viewport.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

        this.app.stage.addChild(this.viewport);

        // Layers
        // We use Graphics for links (vector lines)
        this.layers.links = new PIXI.Graphics();

        // Particles container
        this.layers.particles = new PIXI.Container();

        // Nodes container
        this.layers.nodes = new PIXI.Container();

        // Add to viewport
        this.viewport.addChild(this.layers.links);
        this.viewport.addChild(this.layers.particles);
        this.viewport.addChild(this.layers.nodes);

        // Apply Bloom Filter to heavily glowing elements (links + particles)
        // Note: Filters can be expensive. We apply a simple Blur for "Glow" duplication or actual Bloom if performant.
        // Let's mimic Bloom by duplication for checking performance, or use Pixi's AlphaFilter/BlurFilter combo.
        // Ideally: `this.layers.links.filters = [new PIXI.BlurFilter(4)];` combined with additive blending.

        // Additive Blending for "Neon" look
        this.layers.links.blendMode = 'add';
        this.layers.particles.blendMode = 'add';
    }

    processData(flows) {
        const nodesMap = new Map();

        flows.forEach(f => {
            if (!nodesMap.has(f.source)) nodesMap.set(f.source, { id: f.source, value: 0, connections: 0 });
            if (!nodesMap.has(f.target)) nodesMap.set(f.target, { id: f.target, value: 0, connections: 0 });

            nodesMap.get(f.source).value += f.value;
            nodesMap.get(f.source).connections++;
            nodesMap.get(f.target).value += f.value;
            nodesMap.get(f.target).connections++;
        });

        this.nodes = Array.from(nodesMap.values()).map(n => ({
            ...n,
            type: this.detectType(n.id, n.connections),
            x: this.app.screen.width / 2 + (Math.random() - 0.5) * 50,
            y: this.app.screen.height / 2 + (Math.random() - 0.5) * 50
        }));

        this.links = flows.map(f => ({
            source: f.source,
            target: f.target,
            value: f.value,
            protocol: this.getDominantProtocol(f.protocolCounts)
        }));

        // Create Sprites for Nodes
        const texture = this.createNodeTexture();
        this.nodes.forEach(node => {
            const sprite = new PIXI.Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.scale.set(0.5); // Base scale
            sprite.tint = COLORS[node.type] || COLORS.pc;

            // Interaction
            sprite.eventMode = 'static';
            sprite.cursor = 'pointer';
            sprite.label = node.id; // For easy access

            sprite.on('pointerover', () => this.onNodeHover(node, true));
            sprite.on('pointerout', () => this.onNodeHover(node, false));
            sprite.on('pointerdown', (e) => this.onNodeClick(e, node));

            this.layers.nodes.addChild(sprite);
            this.nodeSprites.set(node.id, sprite);
        });
    }

    createNodeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Outer Glow
        const grad = ctx.createRadialGradient(32, 32, 10, 32, 32, 30);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);

        // Core
        ctx.beginPath();
        ctx.arc(32, 32, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        return PIXI.Texture.from(canvas);
    }

    updatePositions() {
        // Sync Sprite positions with Simulation Nodes
        this.nodes.forEach(node => {
            const sprite = this.nodeSprites.get(node.id);
            if (sprite) {
                sprite.x = node.x;
                sprite.y = node.y;
            }
        });

        // We defer redraw to the main ticker to decouple physics rate from frame rate
    }

    tick(ticker) {
        // Redraw Lines
        const g = this.layers.links;
        g.clear();

        // Animate Camera Inertia if needed (omitted for brevity)

        this.links.forEach(link => {
            const color = LINK_COLORS[link.protocol] || LINK_COLORS.DEFAULT;
            const isSelected = this.selectedId && (link.source.id === this.selectedId || link.target.id === this.selectedId);
            const isDimmed = this.selectedId && !isSelected;

            let alpha = isDimmed ? 0.05 : 0.4;
            let width = 1;

            if (isSelected) {
                alpha = 0.8;
                width = 2;
            }

            if (alpha > 0.05) {
                g.moveTo(link.source.x, link.source.y);
                g.lineTo(link.target.x, link.target.y);
                g.stroke({ width, color, alpha });
            }
        });

        // Particle Logic (Advanced)
        // Spawn particles based on traffic volume?
        // Simple demo: small dots traveling along links
        // We'll skip complex particle pooling for now to keep code safe, 
        // but adding a simple pulsing effect on nodes could be nice.
    }

    // --- Interaction ---

    setupInteraction() {
        // Viewport Dragging
        const stage = this.app.stage;
        stage.eventMode = 'static';
        stage.hitArea = this.app.screen;

        let isDragging = false;
        let prevPos = null;

        stage.on('pointerdown', (e) => {
            // Check if we clicked background
            if (e.target === stage || e.target === this.viewport) {
                isDragging = true;
                prevPos = { x: e.global.x, y: e.global.y };

                // Deselect
                // User Request: "Keep details open".
                // Removing auto-deselect on background click/drag to prevent accidental closing.
                // this.updateSelection(null); 
            }
        });

        stage.on('globalpointermove', (e) => {
            if (isDragging && prevPos) {
                const dx = e.global.x - prevPos.x;
                const dy = e.global.y - prevPos.y;

                this.viewport.x += dx;
                this.viewport.y += dy;
                prevPos = { x: e.global.x, y: e.global.y };
            }
        });

        stage.on('pointerup', () => { isDragging = false; prevPos = null; });

        // Zoom
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = this.viewport.scale.x * scaleFactor;

            // Clamp zoom
            if (newScale < 0.1 || newScale > 5) return;

            // Zoom to mouse
            const rect = this.container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const worldPos = {
                x: (mouseX - this.viewport.x) / this.viewport.scale.x,
                y: (mouseY - this.viewport.y) / this.viewport.scale.y
            };

            this.viewport.scale.set(newScale);
            this.viewport.x = mouseX - worldPos.x * newScale;
            this.viewport.y = mouseY - worldPos.y * newScale;
        }, { passive: false });
    }

    onNodeHover(node, isOver) {
        if (this.isDragging) return;
        const sprite = this.nodeSprites.get(node.id);
        if (!sprite) return;

        if (isOver) {
            sprite.scale.set(0.8);
            sprite.alpha = 1;
            this.container.style.cursor = 'pointer';
        } else {
            if (this.selectedId !== node.id) {
                sprite.scale.set(0.5);

                // Dim if something else selected
                if (this.selectedId) sprite.alpha = 0.1;
                else sprite.alpha = 1;
            }
            this.container.style.cursor = 'default';
        }
    }

    onNodeClick(e, node) {
        e.stopPropagation();
        this.updateSelection(node);
    }

    updateSelection(node, emit = true) {
        this.selectedId = node ? node.id : null;

        // Notify parent
        if (emit && this.onSelection) this.onSelection('node', node);

        // Update Visuals
        this.nodeSprites.forEach((sprite, id) => {
            if (!this.selectedId) {
                sprite.alpha = 1;
                sprite.scale.set(0.5);
            } else {
                if (id === this.selectedId) {
                    sprite.alpha = 1;
                    sprite.scale.set(0.8);
                } else {
                    // Check if neighbor
                    // Slow linkage check (O(N) or O(E)), manageable for <1000 nodes
                    const isNeighbor = this.links.some(l =>
                        (l.source.id === this.selectedId && l.target.id === id) ||
                        (l.target.id === this.selectedId && l.source.id === id)
                    );

                    if (isNeighbor) {
                        sprite.alpha = 0.8;
                    } else {
                        sprite.alpha = 0.1;
                    }
                    sprite.scale.set(0.5);
                }
            }
        });
    }

    // --- Helpers ---

    detectType(ip, connections) {
        if (ip.endsWith('.1') || ip.endsWith('.254')) return 'gateway';
        if (connections > 5) return 'server';
        if (!ip.startsWith('192.') && !ip.startsWith('10.') && !ip.startsWith('172.')) return 'wan';
        return 'pc';
    }

    getDominantProtocol(counts) {
        if (!counts) return 'other';
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return sorted[0] ? sorted[0][0] : 'other';
    }

    destroy() {
        if (this.app) {
            this.app.destroy(true, { children: true, texture: true, baseTexture: true });
            this.app = null;
        }
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }
    }
}

// Global instance manager for simple integration with existing main.js
let renderer = null;

export async function renderNetworkGraphGL(flows, containerId, onSelection, onHideNode, selectedNode = null) {
    if (!renderer) {
        renderer = new NetworkGraphRenderer(containerId);
    } else {
        // Check if container changed (rare)
        if (renderer.containerId !== containerId) {
            renderer.destroy();
            renderer = new NetworkGraphRenderer(containerId);
        }
    }

    // Data Stability Check
    // If flows count matches existing links, we assume data hasn't changed (since selection doesn't filter flows).
    // This prevents simulation reset on click.
    const isSameData = renderer.app && renderer.links.length === flows.length;
    console.log(`renderNetworkGraphGL: isSameData=${isSameData}, current links=${renderer.links.length}, new flows=${flows.length}`);

    if (!isSameData) {
        await renderer.init(flows, onSelection);
    } else {
        // Just ensure callback is updated
        renderer.onSelection = onSelection;

        // CRITICAL FIX: Ensure canvas is in DOM
        // If view switched (List -> Graph), container innerHTML was wiped (or filled with other view).
        // We MUST check if we need to restore it. 
        // AND we must clear whatever junk (List/Map) is currently there.
        if (renderer.app && renderer.app.canvas && !renderer.container.contains(renderer.app.canvas)) {
            renderer.container.innerHTML = ''; // Clear List/Map content
            renderer.container.appendChild(renderer.app.canvas);
        }
    }

    // Update visual selection without emitting event back to store
    // This prevents clearing a "Packet" selection in the details panel when switching views
    if (selectedNode) {
        renderer.updateSelection(selectedNode, false);
    } else {
        // If no node selected (e.g. clean state OR packet selected), clear graph selection visually but silently
        renderer.updateSelection(null, false);
    }
}
