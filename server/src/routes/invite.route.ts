import express from "express";
import { requireAuth } from "../middleware/auth";
import { getInviteData } from "../controller/invite.controller";

const route = express.Router();
route.get("/", requireAuth, getInviteData);
export default route;
