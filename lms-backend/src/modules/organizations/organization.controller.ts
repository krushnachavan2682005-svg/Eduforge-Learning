import { FastifyReply, FastifyRequest } from "fastify";
import { OrganizationService } from "./organization.service";
import { InternalServerError, NotFoundError, UnauthorizedError } from "../../utils/globalErrorHandlingFile";

const organizationService = new OrganizationService();

export class OrganizationController {
  async current(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user || !req.user.organization_id) {
        throw new UnauthorizedError("Authentication required");
      }

      const data = await organizationService.getCurrentOrganization(
        req.user.sub,
        req.user.organization_id,
      );

      return reply.code(200).send({
        success: true,
        data,
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof NotFoundError || error instanceof UnauthorizedError) throw error;
      throw new InternalServerError("Failed to fetch current organization");
    }
  }
}

