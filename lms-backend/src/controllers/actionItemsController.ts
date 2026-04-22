import { FastifyRequest, FastifyReply } from "fastify";
import { ActionItemsInterface } from "../interfaces/actionItems.interface";
import { ActionItems } from "../models/actionItems.model";
import { ActionItemRepository } from "../repositories/actionItems.repositorie";

const actionRep = new ActionItemRepository();

export class ActionItemsController {
  async getAllActionItems(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const { page = "1", limit = "10" } = req.query as {
        page?: string;
        limit?: string;
      };

      const items = await actionRep.getActionItems(
        Number(page),
        Number(limit),
        {
          client_id,
        }
      );

      return reply.code(200).send({
        data: items,
        message: "Action items fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        message: "Failed to fetch action items",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getActionItemById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id, client_id } = req.params as { id: string; client_id: string };
      const item = await actionRep.getActionItemById(client_id, id);

      if (!item)
        return reply.code(404).send({ message: "Action item not found" });

      return reply
        .code(200)
        .send({ data: item, message: "Action item fetched successfully" });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to fetch action item",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async createActionItem(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const body = req.body as ActionItemsInterface;
      const data = { ...body, client_id };

      const existing = await ActionItems.findOne({
        where: { client_id, task_name: body.task_name },
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
        return reply.status(409).send({
          message: "Failed to create action item",
          error: error.message,
        });
      }

      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to create action item",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async updateActionItem(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<ActionItemsInterface>;

      const updated = await actionRep.updateActionItem(id, body);

      if (!updated)
        return reply.code(404).send({ message: "Action item not found" });

      return reply.send({
        data: updated.id,
        message: "Action item updated successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to update action item",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getReviewerDashboard(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, reviewer_id } = req.params as {
        client_id: string;
        reviewer_id: string;
      };

      if (!client_id || !reviewer_id) {
        return reply
          .code(400)
          .send({ message: "client_id and reviewer_id are required" });
      }

      const items = await actionRep.getReviewerActionItems(
        client_id,
        reviewer_id
      );

      return reply.code(200).send({
        data: items,
        message: "Reviewer data fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({ message: "Internal Server Error" });
    }
  }

  async deleteActionItem(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await actionRep.deleteActionItem(id);

      if (!deleted)
        return reply.code(404).send({ message: "Action item not found" });

      return reply.send({ message: "Action item deleted successfully" });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to delete action item",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
