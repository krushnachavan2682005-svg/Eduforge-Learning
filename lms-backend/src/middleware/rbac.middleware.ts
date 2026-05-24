import { FastifyReply, FastifyRequest } from "fastify";
import { authenticate } from "./auth.middleware";
import { RbacService } from "../modules/rbac/rbac.service";

const rbacService = new RbacService();

export function requirePermission(permissionCode: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await authenticate(req, reply);
    if (reply.sent || !req.user) return;

    if (!isSameOrganization(req)) {
      return reply.code(403).send({
        success: false,
        message: "Cross-organization access is forbidden",
      });
    }

    const allowed = await rbacService.hasPermission(
      req.user.sub,
      req.user.organization_id,
      permissionCode,
    );

    if (!allowed) {
      return reply.code(403).send({
        success: false,
        message: `Permission '${permissionCode}' is required`,
      });
    }
  };
}

export function requireRole(roleCode: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await authenticate(req, reply);
    if (reply.sent || !req.user) return;

    if (!isSameOrganization(req)) {
      return reply.code(403).send({
        success: false,
        message: "Cross-organization access is forbidden",
      });
    }

    const allowed = await rbacService.hasRole(
      req.user.sub,
      req.user.organization_id,
      roleCode,
    );

    if (!allowed) {
      return reply.code(403).send({
        success: false,
        message: `Role '${roleCode}' is required`,
      });
    }
  };
}

function isSameOrganization(req: FastifyRequest) {
  const params = req.params as { client_id?: string; organization_id?: string };
  const scopedOrganizationId = params?.organization_id || params?.client_id;

  if (!scopedOrganizationId || !req.user) return true;

  return scopedOrganizationId === req.user.organization_id;
}
