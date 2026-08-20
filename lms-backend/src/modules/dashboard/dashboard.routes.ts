import { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/rbac.middleware";
import { LocalDashboardController, DashboardController } from "./dashboard.controller";
import { verifyToken } from "../../utils/auth";
import { getDashboardSchema, getTutorDashboardSchema } from "./dashboard.schema";

const localDashboardController = new LocalDashboardController();

export default async function localDashboardRoutes(fastify: FastifyInstance) {
  fastify.get("/me", { preHandler: requirePermission("LMS_VIEW") }, (req, reply) =>
    localDashboardController.me(req, reply),
  );
}


const dashboardController = new DashboardController();

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/dashboard/:user_id",
    { schema: getDashboardSchema, preHandler: verifyToken },
    (req, reply) => dashboardController.getDashboard(req, reply)
  );

  fastify.get(
    "/tutor-dashboard/:user_id",
    { schema: getTutorDashboardSchema, preHandler: verifyToken },
    (req, reply) => dashboardController.getTutorDashboard(req, reply)
  );    
}
