import Fastify from "fastify";
import { connectDB, sequelize } from "./config/database";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fastifyMultipart from "@fastify/multipart";
import s3Plugin from "./plugins/s3-upload-plugins";
import publicExamRoutes from "./routes/publicExam.route";

export const buildApp = async () => {
  const app = Fastify({ logger: true });

  await connectDB();
  // Sync Sequelize models with the database
  await sequelize.sync()

  await registerS3Plugin();
  // Swagger Docs
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Credit Portal",
        description: "",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await app.register(fastifyMultipart, {
    attachFieldsToBody: false,
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });

  async function registerS3Plugin() {
    await app.register(s3Plugin, {
      bucketName: process.env.AWS_BUCKET_NAME!,
      region: process.env.AWS_REGION || "ap-south-1",
    });
  }

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  const routes = (await import("./routes/index")).default;
  app.register(routes, { prefix: "/lms/v1/api" });
  app.register(publicExamRoutes,{prefix:"/lms/v1/api"})
  return app;
};
