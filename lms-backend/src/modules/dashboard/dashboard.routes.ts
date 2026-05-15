import { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/auth.middleware";
import { LocalDashboardController } from "./dashboard.controller";

const dashboardController = new LocalDashboardController();

export default async function localDashboardRoutes(fastify: FastifyInstance) {
  fastify.get("/me", { preHandler: authenticate }, (req, reply) =>
    dashboardController.me(req, reply),
  );
}
