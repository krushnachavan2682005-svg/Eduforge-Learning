import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { Section } from "./section.model";
import { sectionRepository } from "./section.repository";
import { SectionInterface } from "./section.interface";

const sectionRep = new sectionRepository();

export class sectionController {
  async getAllSection(req: FastifyRequest, reply: FastifyReply) {
    try {
      // client_id is safely extracted from context inside the repo
      const { page, limit } = req.query as { page?: string; limit?: string };

      const sections = await sectionRep.getSection(
        Number(page),
        Number(limit),
        {}
      );

      return reply.status(200).send(sections);
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch sections");
    }
  }

  async getSectionById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      // client_id is extracted inside the repo
      const section = await sectionRep.getSectionById("", id);

      if (!section) {
        throw new NotFoundError("Section not found");
      }
      return reply
        .code(200)
        .send({ data: section, message: "Section fetched successfully" });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch section");
    }
  }

  async createSection(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as SectionInterface;
      // client_id is injected inside the repository
      const data = { ...body };
      const section = await sectionRep.createSection(data);
      return reply.code(201).send({
        data: { id: section?.id },
        message: "Section created successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw new ConflictError("Failed to create section");
      }

      req.log.error(error);
      throw new InternalServerError("Failed to create section");
    }
  }

  async updateSection(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<Section>;

      // client_id is injected inside the repository
      const updateData = { ...body };
      const updated = await sectionRep.updateSection(id, updateData);

      if (!updated) {
        throw new NotFoundError("Section not found");
      }

      return reply.send({
        data: updated?.id,
        message: "Section updated successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw new ConflictError("Failed to update section");
      }

      req.log.error(error);
      throw new InternalServerError("Failed to update section");
    }
  }

  async deleteSection(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await sectionRep.delete(id);

      if (!deleted) {
        throw new InternalServerError("Section not found");
      }

      return reply.send({ message: "Section deleted" });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to delete section");
    }
  }
}
