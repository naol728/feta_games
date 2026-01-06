import express from "express";
import http from "http";
import { Server } from "socket.io";
import { env } from "./config/env";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket"],
});

app.get("/health", (_, res) => res.send("OK"));

io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);
});

server.listen(env.PORT, () => {
  console.log(`🚀 Server running on ${env.PORT}`);
});
