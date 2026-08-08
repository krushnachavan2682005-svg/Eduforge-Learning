import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { CourseRepository } from "../repositories/course.repository";
import { Course } from "../models/course.model";
import { CourseInterface } from "../interfaces/course.interface";

const courseRepo = new CourseRepository();

export class CourseController {
  async getCourse(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, id } = req.params as { id: string; client_id: string };
      const course = await courseRepo.getCourseById(client_id, id);

      if (!course || !course.length) {
        throw new InternalServerError("Course not found");
      }
      return reply
        .code(200)
        .send({ data: course?.[0], message: "Course fetched successfully" });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch course");
    }
  }

  async createCourse(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const body = req.body as CourseInterface;
      const data = { ...body, client_id };
      const course = await courseRepo.createCourse(data);
      return reply.code(201).send({
        data: {
          id: course?.id,
        },
        message: "Course created successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw new ConflictError("Failed to create course");
      }

      req.log.error(error);
      throw new InternalServerError("Failed to create course");
    }
  }

  async updateCourse(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, id } = req.params as { id: string; client_id: string };
      const body = req.body as Partial<Course>;
      const updateData = { ...body, client_id };
      const updated = await courseRepo.updateCourse(id, updateData);
      if (!updated) {
        throw new InternalServerError("Course not found");
      }

      return reply.send({
        data: updated?.id,
        message: "Course updated successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw new ConflictError("Failed to update course");
      }

      req.log.error(error);
      throw new InternalServerError("Failed to update course");
    }
  }

  async deleteCourse(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await courseRepo.deleteCourse(id);

      if (!deleted) {
        throw new InternalServerError("Course not found");
      }

      return reply.send({ message: "Course deleted" });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to delete course");
    }
  }

  async getAllCourses(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const { page, limit, title } = req.query as {
        page?: string;
        limit?: string;
        title?: string;
      };

      const courses = await courseRepo.getAllCourses(
        Number(page),
        Number(limit),
        { client_id },
        title
      );

      return reply.status(200).send(courses);
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch courses");
    }
  }

  async courceImageUpload(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, id } = req.params as { client_id: string; id: string };

      const courses = await courseRepo.uploadImage(req, client_id, id);

      return reply.status(200).send({
        message: "Image uploded sucessfully",
        data: courses
      });
    } catch (error) {
      throw new InternalServerError("Failed to fetch courses");
    }
  }
}
