# EtherPrism Nexus

**EtherPrism Nexus** is a next-generation network traffic analyzer featuring a cyberpunk aesthetic and advanced visualization capabilities. Built for security analysts and network engineers who demand both performance and style.

## Features

### 🔍 Deep Dive Analyst
- **TCP Stream Reassembly**: Reconstruct and view complete TCP streams in ASCII or HTML.
- **Stevens Graph**: Visualize sequence numbers over time to identify congestion and retransmissions.
- **Hex Editor**: Synchronized Hex/ASCII view for precise packet inspection.

### 🌍 CyberMap & Security
- **GeoIP Visualization**: Interactive 3D globe visualizing connection endpoints.
- **Threat Detection**: Automated detection of Port Scans and DNS Tunneling.
- **Security Dashboard**: Real-time alert feed integrated into the sidebar.

### 🚀 Turbo Core Information Capability
- **Virtual Scrolling**: Smoothly handle capture files with 100,000+ packets.
- **WebGL Rendering**: High-performance network graph visualization powered by D3 and PixiJS.
- **Event-Driven Architecture**: Modular design for scalability and responsiveness.

## Tech Stack
- **Core**: Vanilla JS (ES Modules), Vite
- **Visualizers**: D3.js (Graph, Timeline, Geo), PixiJS (WebGL), Three.js (planned)
- **State Management**: Custom EventBus + Store Pattern

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

## Usage
Drop a `.pcap` file into the analysis zone to begin. Use the sidebar to filter traffic, switch views (Graph/List/Map), and dive deep into packet details.
