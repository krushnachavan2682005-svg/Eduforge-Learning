import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../utils/globalErrorHandlingFile";
import { FastifyRequest, FastifyReply } from "fastify";
import { DashboardRepository } from "../repositories/dashboard.repository";

const dashboardRepo = new DashboardRepository();

export class DashboardController {
  async getDashboard(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id } = req.params as {
        user_id: string;
      };

      if (!user_id) {
        throw new ValidationError("user_id required");
      }

      // client_id is safely extracted from context inside the repo
      const data = await dashboardRepo.getUserDashboard("", user_id);
      return reply.code(200).send({
        success: true,
        message: "Dashboard data fetched successfully",
        data,
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch dashboard data");
    }
  }

  async getTutorDashboard(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id } = req.params as {
        user_id: string; 
      };

      // client_id is safely extracted from context inside the repo
      const data = await dashboardRepo.getTutorCounts("", user_id);
      return reply.code(200).send({
        success: true,
        message: "Tutor dashboard data fetched successfully",
        data,
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch tutor dashboard data");
    }
  }
}
