import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { AssiginCourseRepositorie } from "../repositories/assignCourse.repositorie";
import { AssignedCourseModel } from "../models/assignCourse.model";
import { Op } from "sequelize";

const repositorie = new AssiginCourseRepositorie();
// type CreateCourseBody = Partial<AssignedCourseModel>;

export class AssiginCourseController {
  async createAssiginCourse(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const { course_id, user_id, class_id } = req.body as {
        course_id: string[];
        user_id?: string[];
        class_id?: string | string[];
      };
      let finalUserIds: string[] = [];
      const classIds = class_id
        ? Array.isArray(class_id)
          ? class_id
          : [class_id]
        : [];
      const userClassMap = new Map<string, string>();

      if (user_id?.length) finalUserIds.push(...user_id);
      for (const selectedClassId of classIds) {
        const classUserIds = await repositorie.getUsersByClassId(
          selectedClassId,
          client_id
        );
        finalUserIds.push(...classUserIds);
        classUserIds.forEach((user) => {
          if (!userClassMap.has(user)) userClassMap.set(user, selectedClassId);
        });
      }
      finalUserIds = [...new Set(finalUserIds)];
      if (finalUserIds.length === 0) {
        throw new ValidationError("No users found to assign.");
      }

      const existingRecords = await AssignedCourseModel.findAll({
        where: { user_id: { [Op.overlap]: finalUserIds }, client_id },
      });

      const userCourseMap = new Map<string, Set<string>>();
      finalUserIds.forEach((u) => userCourseMap.set(u, new Set()));
      existingRecords.forEach((record) => {
        record.user_id.forEach((u: string) =>
          record.course_id.forEach((c: string) => userCourseMap.get(u)?.add(c))
        );
      });

      const usersToAssign = finalUserIds.filter(
        (u) => !course_id.some((c) => userCourseMap.get(u)?.has(c))
      );
      if (usersToAssign.length === 0) {
        throw new ValidationError("All users already have this course.");
      }
      for (const user of usersToAssign) {
        await repositorie.createAssignCourse({
          course_id,
          user_id: [user],
          class_id: userClassMap.get(user),
          client_id,
        });

        // Local SaaS compatibility: keep local student_enrollments in sync
        // while the legacy course_user_mapping assignment table remains active.
        await repositorie.createLocalEnrollmentsForUserCourses(
          client_id,
          user,
          course_id,
        );
      }

      return reply.code(201).send({
        message: "Courses assigned to All users successfully",
        // users_assigned: usersToAssign,
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to Assign Courses");
    }
  }

  async getCourseByUserId(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, user_id } = req.params as {
        client_id: string;
        user_id: string;
      };

      const course = await repositorie.getCourseByUserId(client_id, user_id);

      if (!course || course.length === 0) {
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
      throw new InternalServerError("Failed to fetch Assigned course");
    }
  }

  async getCourse(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, course_id } = req.params as {
        client_id: string;
        course_id: string;
      };

      const course = await repositorie.getCourseById(client_id, course_id);

      if (!course || course.length === 0) {
        return reply.code(200).send({
          message: "course not found ",
        });
      }

      return reply.code(200).send({
        data: course,
        message: " course fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch course");
    }
  }
}
