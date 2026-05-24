import { AssiginActionItemsController } from "../controllers/assignActionItems.controller";
import {
  assignActionItems,
  updateAssignedActionStatus,
  getAttachmentsSchema,
  updateAttachmentsSchema,
  deleteAttachmentsSchema,
  publishAssignedItemSchema,
  getAssignedTimelineSchema,
} from "../schemas/assignActionItems.schema";
import { verifyToken } from "../utils/auth";
import { FastifyInstance } from "fastify";
import { requirePermission } from "../middleware/rbac.middleware";

const assignActionItemsController = new AssiginActionItemsController();

export default async function assignActionItemsRoutes(
  fastify: FastifyInstance,
) {
  fastify.post(
    "/assign-action-items",
    { schema: assignActionItems, preHandler: requirePermission("ACTION_ITEM_ASSIGN") },
    (req, reply) => assignActionItemsController.createAssiginCourse(req, reply),
  );
  fastify.put(
    "/update-assigned-action-status/:user_id",
    { schema: updateAssignedActionStatus, preHandler: verifyToken },
    (req, reply) =>
      assignActionItemsController.updateAssignedActionStatus(req, reply),
  );

  fastify.get(
    "/get-assigned-action-items-byuser/:user_id",
    { preHandler: verifyToken },
    (req, reply) =>
      assignActionItemsController.getAssignedActionItems(req, reply),
  );

  fastify.post(
    "/assignment/publish",
    { schema: publishAssignedItemSchema, preHandler: verifyToken },
    (req, reply) => assignActionItemsController.publishAssignedItem(req, reply),
  );

  fastify.get(
    "/assignment/publish-timeline/:user_id?",
    { schema: getAssignedTimelineSchema },
    (req, reply) =>
      assignActionItemsController.getAssignedPublishTimeline(req, reply),
  );

  // Attachment specific APIs
  fastify.get(
    "/get-attachments/:id",
    { schema: getAttachmentsSchema, preHandler: verifyToken },
    (req, reply) => assignActionItemsController.getAttachments(req, reply),
  );

  fastify.put(
    "/update-attachments/:id",
    { schema: updateAttachmentsSchema, preHandler: verifyToken },
    (req, reply) => assignActionItemsController.updateAttachments(req, reply),
  );

  fastify.delete(
    "/delete-attachments/:id",
    { schema: deleteAttachmentsSchema, preHandler: verifyToken },
    (req, reply) => assignActionItemsController.deleteAttachments(req, reply),
  );
  fastify.get(
    "/get-approved-action-items-grouped/:user_id",
    { preHandler: verifyToken },
    (req, reply) =>
      assignActionItemsController.getApprovedActionItemsByLevel(req, reply),
  );
  fastify.get(
    "/tutor/all-approved-action-items",
    { preHandler: verifyToken },
    (req, reply) =>
      assignActionItemsController.getApprovedActionItemsForTutor(req, reply),
  );
}
