import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../../utils/globalErrorHandlingFile";
import { FastifyRequest, FastifyReply } from "fastify";
import { ActionItemsInterface } from "./actionItems.interface";
import { ActionItems } from "./actionItems.model";
import { ActionItemRepository } from "./actionItems.repository";

const actionRep = new ActionItemRepository();

export class ActionItemsController {
  async getAllActionItems(req: FastifyRequest, reply: FastifyReply) {
    try {
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new Error("Tenant context missing");
      const { page = "1", limit = "10" } = req.query as {
        page?: string;
        limit?: string;
      };

      const items = await actionRep.getActionItems(
        Number(page),
        Number(limit),
        {
          organization_id,
        }
      );

      return reply.code(200).send({
        data: items,
        message: "Action items fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch action items");
    }
  }

  async getActionItemById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id, organization_id: req_organization_id } = req.params as { id: string; organization_id: string };
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new Error("Tenant context missing");
      const item = await actionRep.getActionItemById(organization_id, id);

      if (!item)
        throw new NotFoundError("Action item not found");

      return reply
        .code(200)
        .send({ data: item, message: "Action item fetched successfully" });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch action item");
    }
  }

  async createActionItem(req: FastifyRequest, reply: FastifyReply) {
    try {
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new Error("Tenant context missing");
      const body = req.body as ActionItemsInterface;
      const data = { ...body, organization_id };

      const existing = await ActionItems.findOne({
        where: { organization_id, task_name: body.task_name },
      });

      if (existing) {
        throw new Error("Action item already exists for this client");
      }

      const item = await actionRep.createActionItem(data);
      return reply.code(201).send({
        data: {
          id: item?.id,
        },
        message: "Action item created successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw new ConflictError("Failed to create action item");
      }

      req.log.error(error);
      throw new InternalServerError("Failed to create action item");
    }
  }

  async updateActionItem(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<ActionItemsInterface>;

      const updated = await actionRep.updateActionItem(id, body);

      if (!updated)
        throw new NotFoundError("Action item not found");

      return reply.send({
        data: updated.id,
        message: "Action item updated successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to update action item");
    }
  }

  async getReviewerDashboard(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { reviewer_id } = req.params as { reviewer_id: string; };
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new Error("Tenant context missing");

      if (!organization_id || !reviewer_id) {
        throw new ValidationError("organization_id and reviewer_id are required");
      }

      const items = await actionRep.getReviewerActionItems(
        organization_id,
        reviewer_id
      );

      return reply.code(200).send({
        data: items,
        message: "Reviewer data fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Internal Server Error");
    }
  }

  async deleteActionItem(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await actionRep.deleteActionItem(id);

      if (!deleted)
        throw new NotFoundError("Action item not found");

      return reply.send({ message: "Action item deleted successfully" });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to delete action item");
    }
  }
}
