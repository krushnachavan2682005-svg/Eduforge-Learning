import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalServerError,
  ServiceUnavailableError,
} from "../../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { ResumeService } from "./resumes.service";
import { ResumeInterface } from "./resumes.interface";

const resumeService = new ResumeService();
export class ResumeController {
  async createResume(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as ResumeInterface;
      const organization_id = req.user?.organization_id as string;
      const record = await resumeService.createResume(body, organization_id);

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

      const record = await resumeService.updateResume(userId, body);

      return reply.code(200).send({
        data: record,
        message: "Resume updated successfully",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof NotFoundError) throw error;
      throw new InternalServerError("Failed to update resume");
    }
  }

  // Get Resume by User ID
  async getResumeByUserId(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = req.params as { userId: string };
      const resume = await resumeService.getResumeByUserId(userId);

      return reply.code(200).send({
        data: resume,
        message: "Resume fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof NotFoundError) throw error;
      throw new InternalServerError("Failed to fetch resume");
    }
  }

  //  Delete Resume
  async deleteResume(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      await resumeService.deleteResume(id);

      return reply.code(200).send({
        message: "Resume deleted successfully",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof NotFoundError) throw error;
      throw new InternalServerError("Failed to delete resume");
    }
  }
}
