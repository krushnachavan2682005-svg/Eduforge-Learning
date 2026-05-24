import { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/auth.middleware";
import { AuthController } from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.schemas";

const authController = new AuthController();

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/register", { schema: registerSchema }, (req, reply) =>
    authController.register(req, reply),
  );

  fastify.post("/login", { schema: loginSchema }, (req, reply) =>
    authController.login(req, reply),
  );

  fastify.get("/me", { preHandler: authenticate }, (req, reply) =>
    authController.me(req, reply),
  );

  fastify.get("/permissions", { preHandler: authenticate }, (req, reply) =>
    authController.permissions(req, reply),
  );
}
