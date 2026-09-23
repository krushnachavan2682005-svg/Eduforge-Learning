import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
import { createClient } from "redis";

export const redis = createClient(
  process.env.REDIS_URL ? { url: process.env.REDIS_URL } : {}
);
redis.on("error", (err) => {
  console.log("Redis Error Intoduced", err);
});
