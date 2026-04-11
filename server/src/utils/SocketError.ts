export class SocketError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "SOCKET_ERROR", status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
