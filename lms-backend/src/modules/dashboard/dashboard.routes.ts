import { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/rbac.middleware";
import { LocalDashboardController } from "./dashboard.controller";

const dashboardController = new LocalDashboardController();

export default async function localDashboardRoutes(fastify: FastifyInstance) {
  fastify.get("/me", { preHandler: requirePermission("LMS_VIEW") }, (req, reply) =>
    dashboardController.me(req, reply),
  );
}
