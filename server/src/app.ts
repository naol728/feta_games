import express from "express";
import cors from "cors";
import {Response } from "express";
import http from "http"
import connectFour from "./routes/connectfour.route"
import { Server } from "socket.io";
import initSocket from "./socket";

const app = express();
app.use(cors({origin:"https://feta-games.vercel.app/"}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "https://feta-games.vercel.app/", methods: ["GET", "POST","PUT","DELETE"], credentials: true },
  transports: ["websocket", "polling"],
});

app.use("/conectfour",connectFour)

app.use("/",(_,res:Response)=>{res.status(200).send("<h1>Feta Games</h1>")})

initSocket(io)


app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});
export default server