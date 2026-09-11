import { FastifyReply, FastifyRequest } from "fastify";
import { OrganizationService } from "./organization.service";
import {
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../utils/globalErrorHandlingFile";

import { RbacService } from "../rbac/rbac.service";

const organizationService = new OrganizationService();
const rbacService = new RbacService();

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
      if (error instanceof NotFoundError || error instanceof UnauthorizedError)
        throw error;
      throw new InternalServerError("Failed to fetch current organization");
    }
  }
  async getActiveOrganiazations(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) {
        throw new ValidationError("Authorization Failed");
      }
      
      const isSuperAdmin = await rbacService.hasRole(req.user.sub, req.user.organization_id, "super_admin");
      console.log(`=============isSuperAdmin: ${isSuperAdmin}==================`)
      
      if (!isSuperAdmin) {
        throw new ValidationError("Authorization Failed");
      }
      let data = await organizationService.getActiveOrganizations();
      return reply.code(200).send({
        success: true,
        data:data,
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof ValidationError || error instanceof UnauthorizedError || error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError("Failed to fetch active organizations");
    }
  }
}
