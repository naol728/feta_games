import server from "./app";
import { env } from "./config/env";

server.listen(env.PORT, () => {
  console.log(`🚀 Server running on port ${env.PORT}`);
  console.log(`🌐 CORS enabled for: ${env.CLIENT_URL}`);
  console.log(`📡 WebSocket server ready at ws://localhost:${env.PORT}`);
});
