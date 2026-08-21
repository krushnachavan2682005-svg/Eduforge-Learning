import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../../utils/globalErrorHandlingFile";
import { AssignActionItemsService } from "./assignActionItems.service";
import { FastifyReply, FastifyRequest } from "fastify";

const service = new AssignActionItemsService();

export class AssiginActionItemsController {
  async createAssiginCourse(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client, action_item_id, user_id, class_id } = req.body as {
        client?: string;
        action_item_id: string[];
        user_id?: string[];
        class_id?: string | string[];
      };

      if (!action_item_id?.length) {
        throw new ValidationError("action_item_id is required");
      }

      const classIds: string[] = class_id
        ? Array.isArray(class_id)
          ? class_id
          : [class_id]
        : [];

      const organizationId = req.user?.organization_id || null;

      const newAssignments = await service.createAssiginCourse(
        organizationId,
        client,
        action_item_id,
        user_id,
        classIds
      );

      return reply.code(201).send({
        message: newAssignments
          ? "Action items assigned successfully"
          : "Action item already assigned",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof ValidationError) throw error;
      throw new InternalServerError("Failed to assign action items");
    }
  }

  // Get assigned action items
  async getAssignedActionItems(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id } = req.params as { user_id: string };
      const { class_id } = req.query as { class_id?: string };
      const organizationId = req.user?.organization_id;

      if (!user_id)
        throw new ValidationError("user_id is required");

      const data = await service.getAssignedActionItems(organizationId as string, user_id, class_id);

      if (!data.length) {
        return reply
          .code(200)
          .send({ data: [], message: "No action items assigned" });
      }

      return reply.code(200).send({
        data,
        message: "Action items fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch assigned action items");
    }
  }

  async updateAssignedActionStatus(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id } = req.params as { user_id: string };

      const {
        assigned_action_item_id,
        status,
        notes,
        comment,
        attachment,
        score,
      } = req.body as {
        assigned_action_item_id: string;
        status: "ASSIGNED" | "SUBMITTED" | "APPROVED" | "REJECTED";
        comment?: string;
        notes?: string;
        attachment?: string[];
        score?: number;
      };
      
      const storeClientId = req.user?.organization_id;

      const data = await service.updateAssignedActionStatus(
        storeClientId,
        user_id,
        assigned_action_item_id,
        status,
        notes,
        comment,
        attachment,
        score
      );

      return reply.code(200).send({
        message: "Status updated successfully",
        data,
      });
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }
      req.log.error(error);
      throw new InternalServerError("Failed to update assigned action item");
    }
  }

  // GET - Get attachments for a specific assigned action item
  async getAttachments(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const storeClientId = req.user?.organization_id;

      const data = await service.getAttachments(storeClientId, id);

      return reply.code(200).send({
        data,
        message: "Attachments fetched successfully",
      });
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }
      req.log.error(error);
      throw new InternalServerError("Failed to fetch attachments");
    }
  }

  // PUT - Update attachments (add/replace)
  async updateAttachments(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const { attachment, action } = req.body as {
        attachment: string[];
        action?: "add" | "replace";
      };
      
      const storeClientId = req.user?.organization_id;

      const data = await service.updateAttachments(
        storeClientId,
        id,
        attachment,
        action
      );

      return reply.code(200).send({
        message:
          action === "replace"
            ? "Attachments replaced successfully"
            : "Attachments added successfully",
        data,
      });
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }
      req.log.error(error);
      throw new InternalServerError("Failed to update attachments");
    }
  }

  // DELETE - Delete specific attachments
  async deleteAttachments(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const { delete_keys } = req.body as {
        delete_keys: string[];
      };
      
      const storeClientId = req.user?.organization_id;

      const data = await service.deleteAttachments(
        storeClientId,
        id,
        delete_keys
      );

      return reply.code(200).send({
        message: "Attachments deleted successfully",
        data,
      });
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }
      req.log.error(error);
      throw new InternalServerError("Failed to delete attachments");
    }
  }

  async publishAssignedItem(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { assigned_id, assignment_id, user_id, publish } = req.body as {
        assigned_id: string;
        assignment_id: string;
        user_id: string;
        publish: boolean;
      };

      if (!assigned_id || !assignment_id || !user_id) {
        throw new ValidationError("assigned_id, assignment_id and user_id are required");
      }

      const data = await service.publishAssignedItem(
        assigned_id,
        assignment_id,
        user_id,
        publish
      );

      return reply.code(201).send({
        message: "Publish status recorded",
        data,
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof NotFoundError) throw error;
      throw new InternalServerError("Failed to record publish status");
    }
  }

  async getAssignedPublishTimeline(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id } = req.params as { user_id?: string };
      const publishOnly = !user_id;
      const organizationId = req.user?.organization_id;

      if (!organizationId) throw new Error("Tenant context missing");

      const data = await service.getAssignedPublishTimeline(
        organizationId as string,
        user_id,
        publishOnly
      );

      return reply.code(200).send({
        data,
        message: "Publish timeline fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch publish timeline");
    }
  }

  async getApprovedActionItemsByLevel(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { user_id } = req.params as { user_id: string; };
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new Error("Tenant context missing");

      if (!user_id || !organization_id) {
        throw new ValidationError("user_id and organization_id are required");
      }

      const { levels, data } = await service.getApprovedActionItemsByLevel(
        organization_id as string,
        user_id
      );

      if (!data.length) {
        return reply.code(200).send({
          levels: [],
          data: [],
          message: "No approved action items found",
        });
      }

      return reply.code(200).send({
        levels,
        data,
        message: "Approved action items fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch approved action items");
    }
  }

  async getApprovedActionItemsForTutor(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new Error("Tenant context missing");

      if (!organization_id) {
        throw new ValidationError("organization_id is required");
      }

      const { levels, data } = await service.getApprovedActionItemsForTutor(
        organization_id as string
      );

      if (!data.length) {
        return reply.code(200).send({
          levels: [],
          data: [],
          message: "No approved action items found",
        });
      }

      return reply.code(200).send({
        levels,
        data,
        message:
          "Approved action items with student names fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch tutor approved action items");
    }
  }
}
