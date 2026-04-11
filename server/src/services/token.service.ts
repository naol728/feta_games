import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

export interface JwtPayload {
  userId: string;
  telegramId: number;
  iat?: number;
  exp?: number;
}
export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      throw new AppError("Token expired", 401);
    }

    if (err.name === "JsonWebTokenError") {
      throw new AppError("Invalid token", 401);
    }

    throw new AppError("Authentication failed", 401);
  }
};
