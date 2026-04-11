import crypto from "crypto";

export function validateTelegramData(botToken: string, initDataString: string) {
  const params = new URLSearchParams(initDataString);
  const hash = params.get("hash");
  params.delete("hash");
  params.sort();

  const dataCheckString = Array.from(params.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (calculatedHash !== hash) {
    throw new Error("Invalid hash: Data integrity check failed");
  }

  // Convert the search params back into a clean object
  const data: Record<string, any> = Object.fromEntries(params.entries());

  // If 'user' exists, parse it from a JSON string to an object
  if (data.user) {
    try {
      data.user = JSON.parse(data.user);
    } catch (e) {
      console.error("Failed to parse user data JSON");
    }
  }

  return data;
}
