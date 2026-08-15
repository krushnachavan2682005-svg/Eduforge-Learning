import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { ResumeRepository } from "../repositories/resumes.repositorie";
import { ResumeInterface } from "..//interfaces/resumes.interface";

const repository = new ResumeRepository();
export class ResumeController {
  async createResume(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as ResumeInterface;
      const data = { ...body, organization_id: req.user?.organization_id as string };
      const record = await repository.createResume(data);

      return reply.code(201).send({
        data: record,
        message: "Resume created successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to create resume");
    }
  }

  // UPDATE Resume
  async updateResume(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = req.params as { userId: string };
      const body = req.body as ResumeInterface;

      const record = await repository.updateResume(userId , body);
      if (!record) {
        throw new NotFoundError("Resume not found");
      }

      return reply.code(200).send({
        data: record,
        message: "Resume updated successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to update resume");
    }
  }


  // Get Resume by User ID
  async getResumeByUserId(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = req.params as { userId: string };
      const resume = await repository.getResumeByUserId(userId);
      if (!resume) {
        throw new NotFoundError("Resume not found for this user");
      }
      return reply.code(200).send({
        data: resume,
        message: "Resume fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch resume");
    }
  }

  //  Delete Resume
  async deleteResume(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await repository.deleteResume(id);

      if (!deleted) {
        throw new NotFoundError("Resume not found");
      }

      return reply.code(200).send({
        message: "Resume deleted successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to delete resume");
    }
  }
}
