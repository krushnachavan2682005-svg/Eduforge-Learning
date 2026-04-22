import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../utils/globalErrorHandlingFile";
import { FastifyRequest, FastifyReply } from "fastify";
import { lesson } from "../models/lesson.model";
import { lessonRepsitory } from "../repositories/lesson.repository";
import { lessonInterface } from "../interfaces/lesson.interface";

const lessonRepo = new lessonRepsitory();

export class lessonController {
  async getAllLesson(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const { page, limit, course_id } = req.query as {
        page?: string;
        limit?: string;
        course_id?: string;
      };

      const lessons = await lessonRepo.getLesson(Number(page), Number(limit), {
        client_id,
        course_id,
      });

      return reply.status(200).send(lessons);
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch lessons");
    }
  }

  async getLessonById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, id } = req.params as { id: string; client_id: string };
      const lesson = await lessonRepo.getlessonById(client_id, id);

      if (!lesson) {
        throw new InternalServerError("Lesson not found");
      }
      return reply
        .code(200)
        .send({ data: lesson, message: "Lesson fetched successfully" });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch lesson");
    }
  }

  async createLesson(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const body = req.body as lessonInterface;
      const data = { ...body, client_id };
      const lesson = await lessonRepo.createLesson(data);
      return reply.code(201).send({
        data: {
          id: lesson?.id,
        },
        message: "Lesson created successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw new ConflictError("Failed to create lesson");
      }

      req.log.error(error);
      throw new InternalServerError("Failed to create lesson");
    }
  }

  async updateLesson(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, id } = req.params as { id: string; client_id: string };
      const body = req.body as Partial<lesson>;

      const updateData = { ...body, client_id };
      const updated = await lessonRepo.updateLesson(id, updateData);

      if (!updated) {
        throw new InternalServerError("Lesson not found");
      }

      return reply.send({
        data: updated?.id,
        message: "Lesson updated successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw new ConflictError("Failed to update lesson");
      }

      req.log.error(error);
      throw new InternalServerError("Failed to update lesson");
    }
  }

  async deleteLesson(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await lessonRepo.deleteLesson(id);

      if (!deleted) {
        throw new InternalServerError("Lesson not found");
      }

      return reply.send({ message: "Lesson deleted" });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to delete lesson");
    }
  }
}