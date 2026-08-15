import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../utils/globalErrorHandlingFile";
import { FastifyRequest, FastifyReply } from "fastify";
import { lesson } from "../models/lesson.model";
import { lessonRepsitory } from "../repositories/lesson.repository";
import { lessonInterface } from "../interfaces/lesson.interface";

const lessonRepo = new lessonRepsitory();

export class lessonController {
  async getAllLesson(req: FastifyRequest, reply: FastifyReply) {
    try {
      // client_id is safely extracted from context inside the repo
      const { page, limit, course_id } = req.query as {
        page?: string;
        limit?: string;
        course_id?: string;
      };

      const lessons = await lessonRepo.getLesson(Number(page), Number(limit), {
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
      const { id } = req.params as { id: string };
      // client_id is extracted inside the repo
      const lesson = await lessonRepo.getlessonById("", id);

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
      const body = req.body as lessonInterface;
      // client_id is injected inside the repository
      const data = { ...body };
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
      const { id } = req.params as { id: string };
      const body = req.body as Partial<lesson>;

      // client_id is injected inside the repository
      const updateData = { ...body };
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