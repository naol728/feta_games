// middleware/auth.ts
import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { verifyAccessToken, JwtPayload } from "../services/token.service";

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const requireAuth = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError("Authentication required", 401));
  }

  const token = authHeader.split(" ")[1];

  const payload = verifyAccessToken(token); // 💥 throws if invalid

  req.user = payload;

  next();
};
