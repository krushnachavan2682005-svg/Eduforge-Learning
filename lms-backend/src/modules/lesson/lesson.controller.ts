import { FastifyRequest, FastifyReply } from "fastify";
import { lesson } from "./lesson.model";
import { LessonService } from "./lesson.service";
import { lessonInterface } from "./lesson.interface";

const lessonService = new LessonService();

export class lessonController {
  async getAllLesson(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { page, limit, course_id } = req.query as {
      page?: string;
      limit?: string;
      course_id?: string;
    };

    const lessons = await lessonService.getAllLessons(
      req.user.organization_id,
      Number(page),
      Number(limit),
      {
        course_id,
      },
    );

    return reply.status(200).send(lessons);
  }

  async getLessonById(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const lesson = await lessonService.getLessonById(
      req.user.organization_id,
      id,
    );

    return reply
      .code(200)
      .send({ data: lesson, message: "Lesson fetched successfully" });
  }

  async createLesson(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const body = req.body as lessonInterface;
    const data = { ...body };
    const lesson = await lessonService.createLesson(
      req.user.organization_id,
      data,
    );

    return reply.code(201).send({
      data: {
        id: lesson?.id,
      },
      message: "Lesson created successfully",
    });
  }

  async updateLesson(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const body = req.body as Partial<lesson>;

    const updateData = { ...body };
    const updated = await lessonService.updateLesson(
      req.user.organization_id,
      id,
      updateData,
    );

    return reply.send({
      data: updated?.id,
      message: "Lesson updated successfully",
    });
  }

  async deleteLesson(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    await lessonService.deleteLesson(req.user.organization_id, id);

    return reply.send({ message: "Lesson deleted" });
  }
}
