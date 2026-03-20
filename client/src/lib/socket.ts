import { io } from "socket.io-client";

export const socket = io("https://feta-games.onrender.com", {
  transports: ["websocket"],
  withCredentials: true,
});
