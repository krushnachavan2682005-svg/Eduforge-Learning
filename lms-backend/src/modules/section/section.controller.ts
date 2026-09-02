import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { Section } from "./section.model";
import { SectionService } from "./section.service";
import { SectionInterface } from "./section.interface";

const service = new SectionService();

export class sectionController {
  async getAllSection(req: FastifyRequest, reply: FastifyReply) {
    try {
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new UnauthorizedError("Tenant context missing");
      const { page = "1", limit = "10", cursor } = req.query as { page?: string; limit?: string; cursor?: string };

      const sections = await service.getAllSection(
        organization_id,
        page,
        limit,
        cursor
      );

      return reply.status(200).send(sections);
    } catch (error) {
      req.log.error(error);
      if (error instanceof UnauthorizedError) throw error;
      throw new InternalServerError("Failed to fetch sections");
    }
  }

  async getSectionById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new UnauthorizedError("Tenant context missing");

      const section = await service.getSectionById(organization_id, id);

      if (!section) {
        throw new NotFoundError("Section not found");
      }
      return reply
        .code(200)
        .send({ data: section, message: "Section fetched successfully" });
    } catch (error) {
      req.log.error(error);
      if (error instanceof UnauthorizedError || error instanceof NotFoundError) throw error;
      throw new InternalServerError("Failed to fetch section");
    }
  }

  async createSection(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as SectionInterface;
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new UnauthorizedError("Tenant context missing");

      const section = await service.createSection(organization_id, body);
      
      return reply.code(201).send({
        data: { id: section?.id },
        message: "Section created successfully",
      });
    } catch (error) {
      if (error instanceof ConflictError || error instanceof UnauthorizedError) {
        throw error;
      }
      req.log.error(error);
      throw new InternalServerError("Failed to create section");
    }
  }

  async updateSection(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<Section>;
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new UnauthorizedError("Tenant context missing");

      const updated = await service.updateSection(organization_id, id, body);

      if (!updated) {
        throw new NotFoundError("Section not found");
      }

      return reply.send({
        data: updated?.id,
        message: "Section updated successfully",
      });
    } catch (error) {
      if (error instanceof ConflictError || error instanceof UnauthorizedError || error instanceof NotFoundError) {
        throw error;
      }
      req.log.error(error);
      throw new InternalServerError("Failed to update section");
    }
  }

  async deleteSection(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const organization_id = req.user?.organization_id;
      if (!organization_id) throw new UnauthorizedError("Tenant context missing");

      const deleted = await service.deleteSection(organization_id, id);

      if (!deleted) {
        throw new NotFoundError("Section not found");
      }

      return reply.send({ message: "Section deleted" });
    } catch (error) {
      req.log.error(error);
      if (error instanceof UnauthorizedError || error instanceof NotFoundError) throw error;
      throw new InternalServerError("Failed to delete section");
    }
  }
}
