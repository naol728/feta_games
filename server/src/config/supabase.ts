import { createClient } from "@supabase/supabase-js";
import { env } from "./env";
export const supabase = createClient(
  env.SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Optimizes the underlying fetch behavior for heavy server loads
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          // Optional: Helps reuse underlying TCP connections if your Node environment supports it
          keepalive: true,
        });
      },
    },
  },
);
