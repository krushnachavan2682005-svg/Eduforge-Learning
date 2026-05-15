import { FastifyReply, FastifyRequest } from "fastify";
import { AuthRepository } from "../auth/auth.repository";

const authRepository = new AuthRepository();

export class OrganizationController {
  async current(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) {
        return reply.code(401).send({
          success: false,
          message: "Authentication required",
        });
      }

      const membership = await authRepository.findUserContext(
        req.user.sub,
        req.user.organization_id,
      );

      if (!membership) {
        return reply.code(404).send({
          success: false,
          message: "Current organization was not found",
        });
      }

      const organization = (membership as any).organization;

      return reply.code(200).send({
        success: true,
        data: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          is_active: organization.is_active,
          role: membership.role,
        },
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to fetch current organization",
      });
    }
  }
}
