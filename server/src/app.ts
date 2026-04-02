import express from "express";
import cors from "cors";
import { Response } from "express";
import http from "http";
import authRoute from "./routes/auth.route";
import { Server } from "socket.io";
import initSocket from "./socket";

const app = express();
const corsConfig = {
  origin: (origin: any, cb: any) => cb(null, true),
  credentials: true,
};

app.use(cors(corsConfig));
app.options("*", cors(corsConfig));
app.set("trust proxy", 1);
const server = http.createServer(app);

const io = new Server(server, {
  path: "/socket.io",
  cors: corsConfig,
  transports: ["websocket", "polling"],
});
app.use(express.json({ limit: "1mb" }));
app.use("/auth", authRoute);

app.use("/", (_, res: Response) => {
  res.status(200).send("<h1>Feta Games</h1>");
});

initSocket(io);

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Server error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  },
);
export default server;
