import { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/rbac.middleware";
import { MemberController } from "./member.controller";
import {
  assignRoleSchema,
  createMemberSchema,
  resetMemberPasswordSchema,
  updateMemberSchema,
} from "./member.schemas";

const controller = new MemberController();

export default async function memberRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/members",
    {
      schema: createMemberSchema,
      preHandler: requirePermission("MEMBER_CREATE"),
    },
    (req, reply) => controller.create(req, reply),
  );

  fastify.get(
    "/members",
    { preHandler: requirePermission("MEMBER_VIEW") },
    (req, reply) => controller.list(req, reply),
  );

  fastify.get(
    "/members/:id",
    { preHandler: requirePermission("MEMBER_VIEW") },
    (req, reply) => controller.get(req, reply),
  );

  fastify.patch(
    "/members/:id/password",
    {
      schema: resetMemberPasswordSchema,
      preHandler: requirePermission("MEMBER_UPDATE"),
    },
    (req, reply) => controller.resetPassword(req, reply),
  );

  fastify.patch(
    "/members/:id",
    {
      schema: updateMemberSchema,
      preHandler: requirePermission("MEMBER_UPDATE"),
    },
    (req, reply) => controller.update(req, reply),
  );

  fastify.delete(
    "/members/:id",
    { preHandler: requirePermission("MEMBER_DELETE") },
    (req, reply) => controller.deactivate(req, reply),
  );

  fastify.post(
    "/members/:id/roles",
    { schema: assignRoleSchema, preHandler: requirePermission("ROLE_ASSIGN") },
    (req, reply) => controller.assignRole(req, reply),
  );

  fastify.delete(
    "/members/:id/roles/:role_id",
    { preHandler: requirePermission("ROLE_ASSIGN") },
    (req, reply) => controller.removeRole(req, reply),
  );

  fastify.get(
    "/roles",
    { preHandler: requirePermission("MEMBER_VIEW") },
    (req, reply) => controller.roles(req, reply),
  );

  fastify.get(
    "/permissions",
    { preHandler: requirePermission("MEMBER_VIEW") },
    (req, reply) => controller.permissions(req, reply),
  );
}
