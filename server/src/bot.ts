import TelegramBot from "node-telegram-bot-api";
import { env } from "./config/env";
import { upsertTelegramUser } from "./services/user.service";

export const bot = new TelegramBot(env.BOT_TOKEN, {
  polling: true,
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await upsertTelegramUser(msg);
  const text = `
🎮 *Welcome to ${env.APP_NAME}!* ${msg.from?.first_name}

Play 1v1 games 

💰 Win matches & earn Money  
⚡ Fast Cash

👇 Tap the button below to start playing
`;

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🚀 Play Game",
            web_app: {
              url: env.APP_URL,
            },
          },
        ],
      ],
    },
  });
});
