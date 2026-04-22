import { buildApp } from "./app";

import cors from "@fastify/cors";
import formBodyPlugin from "@fastify/formbody";

import dotenv from "dotenv";
dotenv.config();

const start = async () => {
  const app = await buildApp();
  let port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  let host = process.env.HOST || "0.0.0.0";
  try {
    await app.register(cors, {
      origin: "*", // Allow all origins (change this in production)
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allowed methods
      allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
    });
    app.register(formBodyPlugin);

    await app.listen({
      port: port,
      host: host,
    });
    console.log(`🚀 Server running at http://${host}:${port}`);
    console.log(`📄 Swagger Docs at http://${host}:${port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
