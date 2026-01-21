import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: process.env.PORT || 3000,
  BOT_TOKEN: process.env.BOT_TOKEN as string,
  ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID as string,
  APP_NAME: process.env.APP_NAME as string,
  APP_URL: process.env.APP_URL as string,
};

if (!env.BOT_TOKEN || !env.ADMIN_CHAT_ID) {
  throw new Error("❌ Missing environment variables");
}
