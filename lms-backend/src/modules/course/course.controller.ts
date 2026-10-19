import { FastifyReply, FastifyRequest } from "fastify";
import { Course } from "./course.model";
import { CourseInterface } from "./course.interface";
import { CourseService } from "./course.service";

const courseService = new CourseService();

export class CourseController {
  async getCourse(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const course = await courseService.getCourseById(req.user.organization_id, id);
    if(!course || Object.keys(course).length === 0){
      return reply.code(404).send({message:"Course Not Found"})
    }
    return reply
      .code(200)
      .send({ data: course?.[0], message: "Course fetched successfully" });
  }

  async createCourse(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const body = req.body as CourseInterface;
    const data = { ...body };
    const course = await courseService.createCourse(req.user.organization_id, data);
    
    return reply.code(201).send({
      data: {
        id: course?.id,
      },
      message: "Course created successfully",
    });
  }

  async updateCourse(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const body = req.body as Partial<Course>;
    
    const updateData = { ...body };
    const updated = await courseService.updateCourse(req.user.organization_id, id, updateData);

    return reply.send({
      data: updated?.id,
      message: "Course updated successfully",
    });
  }

  async deleteCourse(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    await courseService.deleteCourse(req.user.organization_id, id);

    return reply.send({ message: "Course deleted" });
  }

  async getAllCourses(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { page, limit, cursor, title, skipFirstLesson, includeLessons } = (req.query || {}) as {
      page?: string;
      limit?: string;
      cursor?: string;
      title?: string;
      skipFirstLesson?: string;
      includeLessons?: string;
    };
    
    const parsed_skipped_lesson: boolean = skipFirstLesson === "true";
    const parsed_include_lessons: boolean = includeLessons === "true";
    const courses = await courseService.getAllCourses(
      req.user.organization_id,
      Number(page),
      Number(limit),
      cursor,
      {},
      parsed_skipped_lesson,
      parsed_include_lessons
    );

    return reply.status(200).send(courses);
  }

  async courceImageUpload(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) return reply.code(401).send({ success: false });
    const { id } = req.params as { id: string };
    const file = await req.file();
    if (!file) {
      return reply.status(400).send({ message: "No file uploaded", success: false });
    }
    const result = await courseService.uploadCourseImage(req.user.organization_id, file, req.server, id);

    return reply.status(200).send({
      message: "Image uploded sucessfully",
      data: result,
    });
  }
}
