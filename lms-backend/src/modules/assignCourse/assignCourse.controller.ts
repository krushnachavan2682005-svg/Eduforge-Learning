import { FastifyReply, FastifyRequest } from "fastify";
import { AssignCourseService } from "./assignCourse.service";

const assignCourseService = new AssignCourseService();

export class AssiginCourseController {
  async createAssiginCourse(req: FastifyRequest, reply: FastifyReply) {
    const organizationId = req.user?.organization_id as string;
    const { course_id, user_id, class_id } = req.body as {
      course_id: string[];
      user_id?: string[];
      class_id?: string | string[];
    };
    
    await assignCourseService.assignCourses(
      organizationId,
      course_id,
      user_id,
      class_id
    );

    return reply.code(201).send({
      message: "Courses assigned to All users successfully",
    });
  }

  async getCourseByUserId(req: FastifyRequest, reply: FastifyReply) {
    const { user_id } = req.params as { user_id: string; };
    const organizationId = req.user?.organization_id as string;

    const course = await assignCourseService.getAssignedCoursesByUser(organizationId, user_id);

    if (!course || course.length === 0) {
      return reply.code(200).send({
        message: "Assigned course not found for this user",
      });
    }

    return reply.code(200).send({
      data: course,
      message: "Course fetched successfully",
    });
  }

  async getCourse(req: FastifyRequest, reply: FastifyReply) {
    const { course_id } = req.params as { course_id: string; };
    const organizationId = req.user?.organization_id as string;

    const course = await assignCourseService.getCourseById(organizationId, course_id);

    if (!course || course.length === 0) {
      return reply.code(200).send({
        message: "course not found ",
      });
    }

    return reply.code(200).send({
      data: course,
      message: " course fetched successfully",
    });
  }
}
