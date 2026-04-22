import { FastifyReply, FastifyRequest } from "fastify";
import { ResumeRepository } from "../repositories/resumes.repositorie";
import { ResumeInterface } from "..//interfaces/resumes.interface";

const repository = new ResumeRepository();
export class ResumeController {
  async createResume(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const body = req.body as ResumeInterface;
      const data = { ...body, client_id };
      const record = await repository.createResume(data);

      return reply.code(201).send({
        data: record,
        message: "Resume created successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        message: "Failed to create resume",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // UPDATE Resume
  async updateResume(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = req.params as { userId: string };
      const body = req.body as ResumeInterface;

      const record = await repository.updateResume(userId , body);
      if (!record) {
        return reply.code(404).send({ message: "Resume not found" });
      }

      return reply.code(200).send({
        data: record,
        message: "Resume updated successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        message: "Failed to update resume",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }


  // Get Resume by User ID
  async getResumeByUserId(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = req.params as { userId: string };
      const resume = await repository.getResumeByUserId(userId);
      if (!resume) {
        return reply.code(404).send({
          message: "Resume not found for this user",
        });
      }
      return reply.code(200).send({
        data: resume,
        message: "Resume fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        message: "Failed to fetch resume",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  //  Delete Resume
  async deleteResume(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await repository.deleteResume(id);

      if (!deleted) {
        return reply.code(404).send({
          message: "Resume not found",
        });
      }

      return reply.code(200).send({
        message: "Resume deleted successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        message: "Failed to delete resume",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
