/*eslint-disable*/
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { Provider } from "react-redux"
import { store } from "./store/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";


const queryclient = new QueryClient()

// 🔧 Telegram Mini App mock (VITE DEV ONLY)
if (import.meta.env.DEV && !(window as any).Telegram) {
  (window as any).Telegram = {
    WebApp: {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      ready: () => console.log("Telegram ready (mock)"),
      expand: () => console.log("Telegram expand (mock)"),
      onEvent: (_: string, cb: () => void) => {
        window.addEventListener("resize", cb);
      },
      initDataUnsafe: {
        user: {
          id: 123456,
          first_name: "Naol",
          username: "dev_user",
        },
      },
    },
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryclient}>

      <Provider store={store} >
        <App />
      </Provider>

    </QueryClientProvider>
  </React.StrictMode>
);
