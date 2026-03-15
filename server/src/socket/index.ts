import http from "http";
import { Server } from "socket.io";
import app from "./../app"
import { env } from "../config/env";
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: env.CLIENT_URL, methods: ["GET", "POST"], credentials: true },
  transports: ["websocket", "polling"],
});

export default io 