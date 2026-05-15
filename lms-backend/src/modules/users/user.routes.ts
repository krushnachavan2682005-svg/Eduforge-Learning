import { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/auth.middleware";
import { UserController } from "./user.controller";

const userController = new UserController();

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/me", { preHandler: authenticate }, (req, reply) =>
    userController.me(req, reply),
  );
}
