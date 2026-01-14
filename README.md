# EtherPrism 💎

> **PCAP Visualizer Studio** - See the network in a new dimension.

**EtherPrism** is a modern, web-based network traffic analyzer and visualization tool. Its goal is not deep packet inspection (Wireshark is there for that), but to quickly and visually map communication patterns and "flows".

![Concept Art](https://via.placeholder.com/800x400?text=EtherPrism+Concept)

## Features ✨

- **🚀 Lightweight & Fast**: No installation required, runs directly in the browser.
- **🛡️ Privacy First**: PCAP files **never leave your machine**. All processing happens locally in the browser's memory.
- **Drag & Drop**: Simply drag in a file, and analysis starts immediately.
- **Sankey Visualization**: Spectacular diagrams illustrating communication directions and bandwidth.
- **Binary Engine**: Custom, pure JavaScript (DataView) based PCAP processing engine without external dependencies.

## Technologies 🛠️

- **Frontend**: Vanilla JavaScript (ES Module), Vite
- **Visualization**: D3.js
- **Data Handling**: HTML5 FileReader API, ArrayBuffer, DataView
- **Style**: Modern CSS3 (Variables, Flexbox/Grid)

## Installation and Setup 📦

To start the development environment:

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Roadmap 🗺️

- [X] Core System (Vite + Parser)
- [X] PCAP Parser (Ethernet/IP/TCP)
- [X] Flow Aggregator
- [X] D3.js Visualization
- [X] UI Polishing (Dark Mode)
