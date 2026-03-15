import express from "express";
import cors from "cors";
import {Response } from "express";
import connectFour from "./routes/connectfour.route"
import { env } from "./config/env";
const app = express();
app.use(cors());

app.use("/conectfour",connectFour)

app.use("/",(_,res:Response)=>{res.status(200).send("<h1>Feta Games</h1>")})

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});
export default app