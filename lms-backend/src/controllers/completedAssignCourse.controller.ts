import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { CompletedAssignCours } from "../repositories/completedAssignCourse.repositorie";
import { ICompletedAssignCourse } from "../interfaces/completedAssignCourse.interface";

const repositorie = new CompletedAssignCours();
export class CompletedAssignCourseController {
  async addCompletedAssignCourse(req: FastifyRequest, reply: FastifyReply) {
    {
      try {
        const body = req.body as ICompletedAssignCourse;
        const payload: ICompletedAssignCourse = {
          ...body,
        };

        const data: any = await repositorie.saveCompletedAssignCourse(payload);

        return reply.status(201).send({
          success: true,
          message: "Course completion successfully",
          data: { id: data?.id },
        });
      } catch (error) {
        throw new InternalServerError("Something went wrong");
      }
    }
  }

  async getCompletedAssignCourse(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id, course_id } = req.params as {
        user_id: string;
        course_id: string;
      };

      const course = await repositorie.getCompletedAssignCourse(
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
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch assigned course");
    }
  }
}
