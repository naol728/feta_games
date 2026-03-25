import { io } from "socket.io-client";

export const socket = io(import.meta.env.VITE_BACKEND_URL!, {
  transports: ["websocket", "polling"], // fallback for mobile networks
  withCredentials: true,
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});
