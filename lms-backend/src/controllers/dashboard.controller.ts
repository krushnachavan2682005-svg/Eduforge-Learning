import { FastifyRequest, FastifyReply } from "fastify";
import { DashboardRepository } from "../repositories/dashboard.repository";

const dashboardRepo = new DashboardRepository();

export class DashboardController {
  async getDashboard(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, user_id } = req.params as {
        client_id: string;
        user_id: string;
      };

      if (!client_id || !user_id) {
        return reply
          .code(400)
          .send({ success: false, message: "client_id and user_id required" });
      }

      const data = await dashboardRepo.getUserDashboard(client_id, user_id);
      return reply.code(200).send({
        success: true,
        message: "Dashboard data fetched successfully",
        data,
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to fetch dashboard data",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getTutorDashboard(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, user_id } = req.params as {
        client_id: string;
        user_id: string; 
      };

      const data = await dashboardRepo.getTutorCounts(client_id, user_id);
      return reply.code(200).send({
        success: true,
        message: "Tutor dashboard data fetched successfully",
        data,
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to fetch tutor dashboard data",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
