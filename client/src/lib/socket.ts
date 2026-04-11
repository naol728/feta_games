import { io, Socket } from "socket.io-client";
import { toast } from "react-toastify";

let socket: Socket | null = null;

export function connectSocket(): Promise<Socket> {
  if (socket && socket.connected) return Promise.resolve(socket);

  const token = localStorage.getItem("access_token");

  if (!token) {
    return Promise.reject(new Error("No token for socket connection"));
  }

  socket = io(import.meta.env.VITE_BACKEND_URL!, {
    transports: ["websocket"],
    auth: { token },
    autoConnect: true,
  });

  return new Promise((resolve, reject) => {
    let lastError = "";
    socket!.on("connect", () => {
      resolve(socket!);
    });

    socket!.on("connect_error", (err) => {
      toast.error(err.message || "Connection failed");
      reject(err);
    });
    socket!.on("error", (err) => {
      const message = err?.message || err || "Something went wrong (socket)";
      if (message === lastError) return;
      lastError = message;
      toast.error(message);
    });

    socket!.on("disconnect", (reason) => {
      if (reason === "io server disconnect") {
        toast.error("Disconnected by server");
      }
    });
  });
}

export function getSocket(): Socket {
  if (!socket) {
    throw new Error("Socket not initialized. Call connectSocket() first.");
  }
  return socket;
}
