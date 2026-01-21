import TelegramBot from "node-telegram-bot-api";
import { env } from "./config/env";

export const bot = new TelegramBot(env.BOT_TOKEN, {
  polling: true,
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  const text = `
🎮 *Welcome to ${env.APP_NAME}!*

Play 1v1 games like:
♟ Chess  
❌⭕ XO  

💰 Win matches & earn rewards  
⚡ Fast • Fair • Real-time

👇 Tap the button below to start playing
`;

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🚀 Open Game",
            web_app: {
              url: env.APP_URL,
            },
          },
        ],
      ],
    },
  });
});
