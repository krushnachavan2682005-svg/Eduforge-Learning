import { FastifyInstance } from "fastify";
import { verifyToken } from "../../utils/auth";
import { actionItemSchema } from "./actionItems.schema";
import { ActionItemsController } from "./actionItems.controller";
import { requirePermission } from "../../middleware/rbac.middleware";

const Controller = new ActionItemsController();

export default async function actionItemsRoute(fastify: FastifyInstance) {
  fastify.post(
    "/action-items",
    { schema: actionItemSchema, preHandler: requirePermission("LMS_CREATE") },
    (req, reply) => Controller.createActionItem(req, reply)
  );

  fastify.get(
    "/action-items",
    { preHandler: verifyToken },
    (req, reply) => Controller.getAllActionItems(req, reply)
  );

  fastify.get(
    "/action-items/:id",
    { preHandler: verifyToken },
    (req, reply) => Controller.getActionItemById(req, reply)
  );
 fastify.get(
  "/reviewer-action-items/:reviewer_id",
  { preHandler: verifyToken },
  (req, reply) => Controller.getReviewerDashboard(req, reply)
);

  fastify.put(
    "/action-items/:id",
    { schema: actionItemSchema, preHandler: requirePermission("LMS_UPDATE") },
    (req, reply) => Controller.updateActionItem(req, reply)
  );

  fastify.delete(
    "/action-items/:id",
    { preHandler: requirePermission("LMS_DELETE") },
    (req, reply) => Controller.deleteActionItem(req, reply)
  );
}
