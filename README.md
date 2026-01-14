# EtherPrism 💎 v0.6.1-alpha

> **PCAP Visualizer Studio** - See the network in a new dimension.

**EtherPrism** is a modern, high-performance web-based network traffic analyzer. It visualizes PCAP files purely in the browser using WebAssembly-like performance via Web Workers.

## Status 🚧
**Current Version:** `v0.6.1-alpha`
**State:** Beta (Feature Complete for initial roadmap)

## Features ✨

### 🔍 Visualization & Analysis
- **Advanced Network Graph**: Force-directed graph with semantic icons, glowing links, and physics-based interactions.
- **Timeline View**: Interactive histogram to filter traffic by time segments.
- **Deep Protocol Analysis**: Automatic detection of HTTP, DNS, TLS (SNI), and more.
- **Statistical Dashboard**: 
    - Protocol Distribution (Pie Chart)
    - Top Talkers (Bar Chart)

### 🚀 Performance & UX
- **Web Worker Engine**: Multi-threaded parsing to prevent UI freezes with large files.
- **Instant Filters**: Search by IP, protocol, or time range.
- **Privacy First**: Files never leave your device.
- **Professional UI**: Dark mode, glassmorphism design, and fluid animations.

## Technologies 🛠️
- **Frontend**: Vanilla JS (ES Modules)
- **Visualization**: D3.js (Graph, Timeline, Charts)
- **Engine**: Custom Binary Parser (DataView) + Web Workers
- **Build**: Vite

## Installation 📦

```bash
npm install
npm run dev
```

## Roadmap Completion 🗺️
- [x] PCAP Parsing Engine
- [x] Network Graph Visualization
- [x] Timeline & Filtering
- [x] Protocol Analysis (L7)
- [x] Statistical Dashboard
- [x] Performance Optimization (Web Workers)
