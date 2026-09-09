import http from "http";
import { Server } from "socket.io";

import app from "./app";
import initSocket from "./socket";
import { env } from "./config/env";

const server = http.createServer(app);

export const io = new Server(server, {
  path: "/socket.io",

  cors: {
    origin: (origin: any, cb: any) => cb(null, true),
    credentials: true,
  },

  transports: ["websocket", "polling"],
});

initSocket(io);

server.listen(env.PORT, () => {
  console.log(`🚀 Server running on port ${env.PORT}`);
  console.log(`🌐 CORS enabled for: ${env.CLIENT_URL}`);
  console.log(`📡 WebSocket server ready on port ${env.PORT}`);
});
