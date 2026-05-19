"use client";

import { io, Socket } from "socket.io-client";

// Singleton socket instance.
// Because we sit behind Nginx on port 80, Socket.IO auto-discovers
// the /socket.io/ path which Nginx proxies to the NestJS backend.
const socket: Socket = io({
  autoConnect: false, // we connect explicitly after the component mounts
});

export default socket;
