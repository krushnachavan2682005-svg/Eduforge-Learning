import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../../utils/globalErrorHandlingFile";
import { FastifyRequest, FastifyReply } from "fastify";
import { ActionItemsInterface } from "./actionItems.interface";
import { ActionItemsService } from "./actionItems.service";

const service = new ActionItemsService();

export class ActionItemsController {
  async getAllActionItems(req: FastifyRequest, reply: FastifyReply) {
    try {
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new UnauthorizedError("Tenant context missing");
      const { page = "1", limit = "10" } = req.query as {
        page?: string;
        limit?: string;
      };

      const items = await service.getAllActionItems(
        organization_id,
        page,
        limit
      );

      return reply.code(200).send({
        data: items,
        message: "Action items fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof UnauthorizedError) throw error;
      throw new InternalServerError("Failed to fetch action items");
    }
  }

  async getActionItemById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new UnauthorizedError("Tenant context missing");
      const item = await service.getActionItemById(organization_id, id);

      if (!item)
        throw new NotFoundError("Action item not found");

      return reply
        .code(200)
        .send({ data: item, message: "Action item fetched successfully" });
    } catch (error) {
      req.log.error(error);
      if (error instanceof UnauthorizedError || error instanceof NotFoundError) throw error;
      throw new InternalServerError("Failed to fetch action item");
    }
  }

  async createActionItem(req: FastifyRequest, reply: FastifyReply) {
    try {
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new UnauthorizedError("Tenant context missing");
      const body = req.body as ActionItemsInterface;

      const item = await service.createActionItem(organization_id, body);
      
      return reply.code(201).send({
        data: {
          id: item?.id,
        },
        message: "Action item created successfully",
      });
    } catch (error) {
      if (error instanceof ConflictError || error instanceof UnauthorizedError) {
        throw error;
      }
      req.log.error(error);
      throw new InternalServerError("Failed to create action item");
    }
  }

  async updateActionItem(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<ActionItemsInterface>;
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new UnauthorizedError("Tenant context missing");

      const updated = await service.updateActionItem(organization_id, id, body);

      if (!updated)
        throw new NotFoundError("Action item not found");

      return reply.send({
        data: updated.id,
        message: "Action item updated successfully",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof UnauthorizedError || error instanceof NotFoundError) throw error;
      throw new InternalServerError("Failed to update action item");
    }
  }

  async getReviewerDashboard(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { reviewer_id } = req.params as { reviewer_id: string; };
      const organization_id = req.user?.organization_id;

      if (!organization_id || !reviewer_id) {
        throw new ValidationError("organization_id and reviewer_id are required");
      }

      const items = await service.getReviewerDashboard(
        organization_id,
        reviewer_id
      );

      return reply.code(200).send({
        data: items,
        message: "Reviewer data fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof ValidationError) throw error;
      throw new InternalServerError("Internal Server Error");
    }
  }

  async deleteActionItem(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new UnauthorizedError("Tenant context missing");
      
      const deleted = await service.deleteActionItem(organization_id, id);

      if (!deleted)
        throw new NotFoundError("Action item not found");

      return reply.send({ message: "Action item deleted successfully" });
    } catch (error) {
      req.log.error(error);
      if (error instanceof UnauthorizedError || error instanceof NotFoundError) throw error;
      throw new InternalServerError("Failed to delete action item");
    }
  }
}
