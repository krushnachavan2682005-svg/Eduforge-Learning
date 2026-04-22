import { FastifyReply, FastifyRequest } from "fastify";
import { CompletedAssignCours } from "../repositories/completedAssignCourse.repositorie";
import { ICompletedAssignCourse } from "../interfaces/completedAssignCourse.interface";

const repositorie = new CompletedAssignCours();
export class CompletedAssignCourseController {
  async addCompletedAssignCourse(req: FastifyRequest, reply: FastifyReply) {
    {
      try {
        const { client_id } = req.params as { client_id: string };
        const body = req.body as ICompletedAssignCourse;
        const payload: ICompletedAssignCourse = {
          ...body,
          client_id,
        };

        const data: any = await repositorie.saveCompletedAssignCourse(payload);

        return reply.status(201).send({
          success: true,
          message: "Course completion successfully",
          data: { id: data?.id },
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          message: "Something went wrong",
          error: error instanceof Error ? error.message : error,
        });
      }
    }
  }

  async getCompletedAssignCourse(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, user_id, course_id } = req.params as {
        client_id: string;
        user_id: string;
        course_id: string;
      };

      const course = await repositorie.getCompletedAssignCourse(
        client_id,
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
      return reply.status(500).send({
        message: "Failed to fetch assigned course",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
