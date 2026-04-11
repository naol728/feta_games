import express from "express";
import { me, telegramAuth } from "../controller/auth.controller";
import { requireAuth } from "../middleware/auth";
const route = express.Router();
route.post("/telegram", telegramAuth);
route.get("/me", requireAuth, me);
export default route;
