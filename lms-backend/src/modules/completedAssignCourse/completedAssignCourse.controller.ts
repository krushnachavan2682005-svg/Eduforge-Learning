import { FastifyReply, FastifyRequest } from "fastify";
import { CompletedAssignCourseService } from "./completedAssignCourse.service";
import { ICompletedAssignCourse } from "./completedAssignCourse.interface";

const service = new CompletedAssignCourseService();

export class CompletedAssignCourseController {
  async addCompletedAssignCourse(req: FastifyRequest, reply: FastifyReply) {
    const organizationId = req.user?.organization_id as string;
    const body = req.body as ICompletedAssignCourse;
    const payload: ICompletedAssignCourse = {
      ...body,
    };

    const data: any = await service.saveCompletedAssignCourse(organizationId, payload);

    return reply.status(201).send({
      success: true,
      message: "Course completion successfully",
      data: { id: data?.id },
    });
  }

  async getCompletedAssignCourse(req: FastifyRequest, reply: FastifyReply) {
    const organizationId = req.user?.organization_id as string;
    const { user_id, course_id } = req.params as {
      user_id: string;
      course_id: string;
    };

    const course = await service.getCompletedAssignCourse(
      organizationId,
      user_id,
      course_id
    );

    if (!course) {
      return reply.code(200).send({
        message: "Assigned course not found for this user",
      });
    }

    return reply.code(200).send({
      data: course,
      message: "Course fetched successfully",
    });
  }
}
