import { FastifyReply, FastifyRequest } from "fastify";
import { Section } from "../models/section.models";
import { sectionRepository } from "../repositories/section.repository";
import { SectionInterface } from "../interfaces/section.interface";

const sectionRep = new sectionRepository();

export class sectionController {
  async getAllSection(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const { page, limit } = req.query as { page?: string; limit?: string };

      const sections = await sectionRep.getSection(
        Number(page),
        Number(limit),
        {
          client_id,
        }
      );

      return reply.status(200).send(sections);
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to fetch sections",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getSectionById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, id } = req.params as { id: string; client_id: string };
      const section = await sectionRep.getSectionById(client_id, id);

      if (!section) {
        return reply.code(404).send({ message: "Section not found" });
      }
      return reply
        .code(200)
        .send({ data: section, message: "Section fetched successfully" });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to fetch section",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async createSection(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const body = req.body as SectionInterface;
      const data = { ...body, client_id };
      const section = await sectionRep.createSection(data);
      return reply.code(201).send({
        data: { id: section?.id },
        message: "Section created successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        return reply.status(409).send({
          message: "Failed to create section",
          error: error.message,
        });
      }

      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to create section",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async updateSection(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, id } = req.params as { id: string; client_id: string };
      const body = req.body as Partial<Section>;

      const updateData = { ...body, client_id };
      const updated = await sectionRep.updateSection(id, updateData);

      if (!updated) {
        return reply.code(404).send({ message: "Section not found" });
      }

      return reply.send({
        data: updated?.id,
        message: "Section updated successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        return reply.status(409).send({
          message: "Failed to update section",
          error: error.message,
        });
      }

      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to update section",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async deleteSection(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await sectionRep.delete(id);

      if (!deleted) {
        return reply.code(500).send({ message: "Section not found" });
      }

      return reply.send({ message: "Section deleted" });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to delete section",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
