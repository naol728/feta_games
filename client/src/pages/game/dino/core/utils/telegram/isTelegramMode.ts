/**
 * Returns true when the app is running inside Telegram's WebApp.
 *
 * Detection is intentionally defensive:
 *   - `window.Telegram.WebApp` must exist (only present when Telegram
 *     injects its SDK, i.e. when the page is opened from inside Telegram).
 *   - `initData` must be a non-empty string — this is what Telegram uses
 *     to pass the signed auth payload to the mini app.
 *   - If we're in dev and running outside Telegram, this returns false and
 *     the app falls back to LocalScoreManager.
 *
 * The result is memoized so the check runs once per page load.
 */
let cached: boolean | null = null;

const isTelegramMode = (): boolean => {
  if (cached !== null) return cached;

  try {
    const tg = (
      window as unknown as {
        Telegram?: {
          WebApp?: {
            initData?: string;
            initDataUnsafe?: unknown;
            platform?: string;
          };
        };
      }
    ).Telegram;

    const webApp = tg?.WebApp;

    const hasSdk = !!webApp;
    const hasInitData =
      typeof webApp?.initData === "string" && webApp.initData.length > 0;

    cached = hasSdk && hasInitData;
    return cached;
  } catch {
    cached = false;
    return cached;
  }
};

export default isTelegramMode;
