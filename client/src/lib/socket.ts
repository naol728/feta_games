// lib/socket.ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket) return socket; // ✅ prevent duplicate connections

  const token = localStorage.getItem("access_token");

  if (!token) {
    throw new Error("No token for socket connection");
  }

  socket = io(import.meta.env.VITE_BACKEND_URL!, {
    transports: ["websocket"],
    auth: { token },
    autoConnect: true,
  });

  return socket;
}

export function getSocket(): Socket {
  if (!socket) {
    throw new Error("Socket not initialized. Call connectSocket() first.");
  }
  return socket;
}
