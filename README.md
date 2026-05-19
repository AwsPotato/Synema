# <p align="center"><img src="https://nestjs.com/img/logo-small.svg" width="60" alt="Nest Logo" style="vertical-align: middle; margin-right: 15px;" /> Synema <img src="https://assets.vercel.com/image/upload/v1662130559/nextjs/Icon_dark_background.png" width="55" alt="Next.js Logo" style="vertical-align: middle; margin-left: 15px;" /></p>
<p align="center">
  <strong>A high-performance, self-hosted watch party platform for real-time video synchronization and interactive room chat.</strong>
</p>

<p align="center">
  <a href="https://github.com/AwsPotato/Synema"><img src="https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" /></a>
  <a href="https://github.com/AwsPotato/Synema"><img src="https://img.shields.io/badge/NestJS-11.0-%23E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" /></a>
  <a href="https://github.com/AwsPotato/Synema"><img src="https://img.shields.io/badge/Socket.io-4.8-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io" /></a>
  <a href="https://github.com/AwsPotato/Synema"><img src="https://img.shields.io/badge/Redis-7.0-%23DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" /></a>
  <a href="https://github.com/AwsPotato/Synema"><img src="https://img.shields.io/badge/Nginx-Alpine-%23009639?style=for-the-badge&logo=nginx&logoColor=white" alt="Nginx" /></a>
  <a href="https://github.com/AwsPotato/Synema"><img src="https://img.shields.io/badge/Tailwind_CSS-v4-%2338B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" /></a>
</p>

---

## 🎥 Introduction

**Synema** is a modern, web-based watch party application designed to let groups of users watch videos together in perfect sync. Whether you are hosting a movie night using a direct link to an MP4 video or streaming HLS content, or watching a video on YouTube, Twitch, or Vimeo, Synema bridges the distance by synchronizing playback state, current timestamp, and video sources with sub-second accuracy across all connected peers.

The application incorporates a sleek, cyber-dark UI theme, featuring an integrated real-time text chat sidebar, an HLS quality levels selector, and a dockerized multi-container runtime that coordinates reverse proxying, state persistence, and automatic scaling.

---

## ✨ Key Features

*   🔄 **Zero-Drift Synchronization:** Employs room-wide event broadcasting (`Play`, `Pause`, `Seek`, `Source Swap`) with WebSocket support to enforce playback synchronization.
*   🎥 **Hybrid Playback Engine:**
    *   **Native Player:** Seamlessly plays direct media files (`.mp4`, `.webm`, `.m3u8` streams) with complete hardware acceleration.
    *   **Third-Party Embeds:** Dynamically handles third-party stream URLs (YouTube, Twitch, Vimeo, Soundcloud) using an on-demand `react-player` bridge.
*   📶 **HLS Adaptive Stream Selector:** Auto-detects HTTP Live Streaming (HLS) formats, exposing an overlay menu to manually swap or auto-negotiate video qualities and bitrates.
*   💬 **Interactive Room Chat:** Features a synced chat sidebar with custom username color hashing, formatted timestamps, and smooth auto-scrolling notifications.
*   💾 **Persistent Session Storage:** Leverages a Redis cache on the backend. Active rooms preserve their current source, play state, and timestamp, allowing users to reconnect or reload without breaking the sync state.
*   🛡️ **Dockerized Microservices:** Orchestrated using Nginx as an API gateway proxy, Next.js for client-side pages, NestJS for WebSocket events, Redis for cache tracking, and PostgreSQL for persistent configurations.

---

## 📐 Architecture & Data Flow

Synema is architected as a set of decoupled services coordinated through an Nginx proxy. 

```mermaid
graph TD
    ClientA[Client A] <-->|HTTP/WS| Nginx[Nginx Reverse Proxy :8080]
    ClientB[Client B] <-->|HTTP/WS| Nginx
    
    subgraph Local Stack
        Nginx <-->|Proxy port 3000| Frontend[Next.js App Server]
        Nginx <-->|Proxy /socket.io| Backend[NestJS Socket Gateway]
        Backend <-->|Read/Write State| Redis[(Redis Cache Store)]
        Backend <-->|Database Queries| Postgres[(PostgreSQL Database)]
    end
```

### Flow of a Sync Event
1. **User Interaction:** Client A performs an action (e.g. pauses or seeks the video).
2. **Gateway Dispatch:** The client emits a socket payload containing the `roomId` and the exact `currentTime`.
3. **Room Broadcast & Storage:** The NestJS Gateway handles the event, writes the updated state to the Redis key-value store, and broadcasts the event to all other clients joined to the same `roomId`.
4. **Client-side Intercept:** Client B receives the socket notification, disables local event echo loops, updates its player state, and executes `seekTo` or `play/pause`.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16 (React 19)** | UI Architecture, App Router, Server-side rendering compatibility. |
| **Styling** | **Tailwind CSS v4** | Modern dark-themed CSS framework, glassy filters, and layout layouts. |
| **Media Player** | **HTML5 Video & React-Player** | Custom wrapper supporting HLS streaming levels and third-party platforms. |
| **Backend Engine** | **NestJS 11** | TypeScript framework hosting the WebSocket gateway logic. |
| **WebSockets** | **Socket.IO (WebSockets Transport)** | Real-time bi-directional messaging with low-overhead packets. |
| **Caching Store** | **Redis (ioredis client)** | Persistent active room states, play/pause statuses, and 24h TTLs. |
| **Reverse Proxy** | **Nginx (Alpine)** | Unified gateway handling static assets, WebSocket upgrades, and HMR headers. |
| **Containers** | **Docker & Docker Compose** | Simple, platform-agnostic environment deployment. |

---

## 🚀 Quick Start (Docker Compose)

The easiest way to run the entire Synema ecosystem (Nginx, Frontend, Backend, Redis, Postgres) is with Docker Compose.

### Prerequisites
Make sure you have [Docker](https://www.docker.com/products/docker-desktop/) and **Docker Compose** installed on your machine.

### Installation & Execution
1. Clone this repository to your local directory:
   ```bash
   git clone https://github.com/your-username/synema.git
   cd synema
   ```

2. Spin up the container stack:
   ```bash
   docker-compose up --build
   ```

3. Open your browser and navigate to:
   [http://localhost:8080](http://localhost:8080)

> [!NOTE]
> The Nginx container acts as a reverse proxy, listening on port `8080` and routing traffic automatically:
> - `/` routes to the Next.js Frontend.
> - `/socket.io/` routes to the NestJS Gateway.

---

## 💻 Local Development Setup (Manual)

If you prefer running services outside of Docker for debugging, follow these steps.

### 1. Start External Dependencies
Ensure you have running instances of **Redis** and **PostgreSQL** locally:
*   Redis should be running on `redis://localhost:6379`.
*   PostgreSQL should be running on `postgres://synema:synema@localhost:5432/synema`.

### 2. Configure and Start the Backend
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Set your environment variables in a local file or environment shell:
   ```env
   REDIS_URL=redis://localhost:6379
   DATABASE_URL=postgres://synema:synema@localhost:5432/synema
   PORT=3001
   ```
4. Start the NestJS application in watch mode:
   ```bash
   npm run start:dev
   ```

### 3. Configure and Start the Frontend
1. Navigate to the `frontend` folder:
   ```bash
   cd ../frontend
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Run the Next.js dev server:
   ```bash
   npm run dev
   ```
4. The client will be accessible at [http://localhost:3000](http://localhost:3000).

---

## 📡 WebSocket Event API

The socket interface establishes real-time syncing between clients and the NestJS Gateway.

| Incoming Event (from Client) | Data Payload | Server Action |
| :--- | :--- | :--- |
| `joinRoom` | `{ roomId: string }` | Joins client to the socket room, notifies other peers, and sends back the cached `room:state` from Redis. |
| `leaveRoom` | `{ roomId: string }` | Removes client from socket room and notifies peers. |
| `video:source` | `{ roomId: string, source: string }` | Updates the cached video source to Redis, resets play time to `0`, and broadcasts to room. |
| `video:play` | `{ roomId: string, currentTime: number }` | Caches play status and current time to Redis, broadcasts event to room. |
| `video:pause` | `{ roomId: string, currentTime: number }` | Caches pause status and current time to Redis, broadcasts event to room. |
| `video:seek` | `{ roomId: string, currentTime: number }` | Updates active playback time in Redis, broadcasts seek position to room. |
| `chat:message` | `{ roomId: string, username: string, text: string }` | Broadcasts text chat message payload to room members. |

---

## 📁 Directory Structure

```text
Synema/
├── backend/                  # NestJS API & WebSocket Service
│   ├── src/
│   │   ├── redis/            # Redis cache service wrapper
│   │   ├── sync/             # Real-time WebSocket gateways and logic
│   │   ├── main.ts           # Bootstraps the NestJS server
│   │   └── app.module.ts     # Main application container
│   ├── package.json
│   └── tsconfig.json
├── frontend/                 # Next.js UI Application
│   ├── app/                  # App router layout & entry point page
│   ├── components/           # UI elements (SyncPlayer, ChatBox, etc.)
│   ├── lib/                  # Helper utilities (Socket client setup)
│   ├── public/               # Static assets & public files
│   ├── package.json
│   └── next.config.ts
├── nginx/                    # Reverse Proxy Configuration
│   └── nginx.conf            # Proxy rules and HMR socket upgrades
├── docker-compose.yml        # Orchestration script for full stack deployment
└── LICENSE                   # MIT License
```

---

## 🤝 Contributing

We welcome contributions of all shapes and sizes! To get started:
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📜 License

Distributed under the MIT License. See the [LICENSE](LICENSE) file for more information.
