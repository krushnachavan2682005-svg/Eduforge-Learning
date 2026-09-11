import { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/auth.middleware";
import { OrganizationController } from "./organization.controller";

const organizationController = new OrganizationController();

export default async function organizationRoutes(fastify: FastifyInstance) {
  fastify.get("/current", { preHandler: authenticate }, (req, reply) =>
    organizationController.current(req, reply),
  );
  fastify.get("/active", { preHandler: authenticate }, (req, reply) =>
    organizationController.getActiveOrganiazations(req, reply),
  );
}
