import express from "express";
import { me, telegramAuth } from "../controller/auth.controller";
const route = express.Router();
route.post("/telegram", telegramAuth);
route.get("/me", authMiddleware, me);
export default route;
