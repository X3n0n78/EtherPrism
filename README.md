<div align="center">

# ETHERPRISM // NEXUS
### Advanced Network Traffic Analysis & Visualization

![Version](https://img.shields.io/badge/version-2.0.0-38bdf8?style=for-the-badge)
![Status](https://img.shields.io/badge/status-STABLE-10b981?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-818cf8?style=for-the-badge)

<p align="center">
  <img src="https://via.placeholder.com/800x400/0f111a/38bdf8?text=EtherPrism+Nexus+UI" alt="EtherPrism Nexus UI" width="100%" />
</p>

*A high-performance, cyberpunk-inspired PCAP analyzer built for next-gen security operations.*

[Features](#-features) • [Installation](#-quick-start) • [Documentation](#-documentation) • [Roadmap](#-roadmap)

</div>

---

## ⚡ Overview

**EtherPrism Nexus** is not just a packet sniffer—it's a **network observability platform**. By combining high-performance WebGL rendering with deep packet inspection (DPI), it transforms raw binary data into interactive, actionable intelligence.

Designed for **Security Analysts**, **Network Engineers**, and **Forensics Specialists** who need to visualize 100,000+ packets without skipping a beat.

## ✨ Features

### 🕸️ High-Fidelity Network Graph
- **WebGL Powered**: Renders 10,000+ nodes at 60fps using PixiJS.
- **Force-Directed Physics**: Real-time layout adjustment with D3-compatible physics.
- **Protocol Coloring**: Instant visual identification of TCP (Blue), UDP (Green), and ICMP (Red) traffic.
- **Cyber-Aesthetics**: Neon glow effects, additive blending, and smooth camera inertia.

### 📋 Deep Packet Inspection
- **Virtual Scrolling**: Custom-built `div`-recycling scroller handles **100k+ events** with zero lag.
- **Stream Reassembly**: Reconstruct TCP streams to view full HTML/ASCII payloads.
- **JSON Tree View**: Wireshark-style collapsible detail inspection for every header field.

### 🌍 Holomap & Threat Intel
- **3D Geo-Visualization**: Interactive D3 globe mapping IP geolocation.
- **Live Threat Detection**: Automated heuristics for **DNS Tunneling**, **Port Scans**, and **Anomalous Payloads**.
- **Real-time Statistics**: Interactive charts and sparklines for bandwidth and protocol distribution.

## 🛠️ Technology Stack

| Domain | Technologies |
|:---|:---|
| **Core** | ![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-yellow) ![Vite](https://img.shields.io/badge/Vite-Bundler-646cff) |
| **Visualization** | ![PixiJS](https://img.shields.io/badge/PixiJS-WebGL-e72264) ![D3](https://img.shields.io/badge/D3.js-Data_Viz-f9a03c) |
| **Parsing** | ![PCAP](https://img.shields.io/badge/PCAP-Binary_Parsing-blue) ![Workers](https://img.shields.io/badge/Web_Workers-Multi_Thread-lightgrey) |
| **UI/UX** | ![CSS3](https://img.shields.io/badge/CSS3-Variables_&_Grid-1572B6) ![Neon](https://img.shields.io/badge/Style-Cyberpunk_Dark-black) |

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- Modern Browser (Chrome/Edge/Firefox) with WebGL 2.0 support.

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/X3n0n78/EtherPrism.git

# 2. Enter directory
cd EtherPrism

# 3. Install dependencies
npm install

# 4. Start the engine
npm run dev
```

> The application will launch at `http://localhost:5173`

## 📚 Documentation

Comprehensive documentation is available in the `Dokumentaciok` folder:

- **📄 Product Documentation**: Architecture, SRS, and API specs.
- **📘 User Manual**: How-to guides for filtering and analyzing streams.
- **📊 Business Specs**: Functional requirements and project goals.

## 🔮 Roadmap

- [x] **v1.0**: Basic PCAP parsing and SVG Graph.
- [x] **v2.0**: WebGL Engine (PixiJS), Virtual Scroller, Dark Theme.
- [ ] **v2.1**: Export Analysis Reports (PDF/JSON).
- [ ] **v3.0**: Real-time WebSocket Capture Mode.

---

<div align="center">
  <sub>Built with ❤️ by the EtherPrism Team. 2026.</sub>
</div>
