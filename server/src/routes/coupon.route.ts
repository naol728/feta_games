import express from "express";
import { redeemCoupon } from "../controller/coupon.controller";
import { requireAuth } from "../middleware/auth";

const couponRoute = express.Router();

couponRoute.post("/redeem", requireAuth, redeemCoupon);

export default couponRoute;
