
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../../utils/globalErrorHandlingFile";
import { DashboardService } from "./dashboard.service";
import { FastifyReply, FastifyRequest } from "fastify";

const dashboardService = new DashboardService();

export class LocalDashboardController {
  async me(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user || !req.user.organization_id) {
        throw new UnauthorizedError("Tenant context missing");
      }

      const data = await dashboardService.getMeDashboard(
        req.user.sub,
        req.user.organization_id
      );

      return reply.code(200).send({
        success: true,
        data,
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof NotFoundError || error instanceof UnauthorizedError) throw error;
      throw new InternalServerError("Failed to fetch dashboard");
    }
  }
}

export class DashboardController {
  async getDashboard(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id } = req.params as {
        user_id: string;
      };

      if (!user_id) {
        throw new ValidationError("user_id required");
      }

      const organizationId = req.user?.organization_id;
      if (!organizationId) throw new UnauthorizedError("Tenant context missing");

      const data = await dashboardService.getUserDashboard(organizationId, user_id);
      return reply.code(200).send({
        success: true,
        message: "Dashboard data fetched successfully",
        data,
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof ValidationError || error instanceof UnauthorizedError) throw error;
      throw new InternalServerError("Failed to fetch dashboard data");
    }
  }

  async getTutorDashboard(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id } = req.params as {
        user_id: string; 
      };

      const organizationId = req.user?.organization_id;
      if (!organizationId) throw new UnauthorizedError("Tenant context missing");

      const data = await dashboardService.getTutorDashboard(organizationId, user_id);
      return reply.code(200).send({
        success: true,
        message: "Tutor dashboard data fetched successfully",
        data,
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof UnauthorizedError) throw error;
      throw new InternalServerError("Failed to fetch tutor dashboard data");
    }
  }
}
