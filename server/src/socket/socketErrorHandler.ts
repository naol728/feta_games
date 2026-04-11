import { Socket } from "socket.io";
import { SocketError } from "./../utils/SocketError";

export function handleSocketError(socket: Socket, err: unknown) {
  console.error("SOCKET ERROR 💥", err);

  if (err instanceof SocketError) {
    socket.emit("error", {
      message: err.message,
      code: err.code,
      status: err.status,
    });
    return;
  }

  if (err instanceof Error) {
    socket.emit("error", {
      message: err.message,
      code: "INTERNAL_ERROR",
      status: 500,
    });
    return;
  }

  socket.emit("error", {
    message: "Unknown error",
    code: "UNKNOWN",
    status: 500,
  });
}
