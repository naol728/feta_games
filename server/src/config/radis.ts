import Redis from "ioredis";
export const client = new Redis(
  "rediss://default:gQAAAAAAARuPAAIncDI1ODUyMDI1ZDIyNTM0ZmZkYjQ2NDA1Y2IxM2E4YzM1M3AyNzI1OTE@ample-kingfish-72591.upstash.io:6379",
);
