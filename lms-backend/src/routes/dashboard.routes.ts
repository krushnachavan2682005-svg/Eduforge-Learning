import { FastifyInstance } from "fastify";
import { DashboardController } from "../controllers/dashboard.controller";
import { verifyToken } from "../utils/auth";
import { getDashboardSchema, getTutorDashboardSchema } from "../schemas/dashboard.schema";

const dashboardController = new DashboardController();

export default async function dashboardRoutes(fastify: FastifyInstance) {
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
