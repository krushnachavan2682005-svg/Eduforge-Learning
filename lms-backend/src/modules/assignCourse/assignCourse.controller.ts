import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { AssiginCourseRepositorie } from "./assignCourse.repository";
import { AssignedCourseModel } from "./assignCourse.model";
import { OrganizationUser } from "../roles/role.model";
import { Op } from "sequelize";

const repositorie = new AssiginCourseRepositorie();
// type CreateCourseBody = Partial<AssignedCourseModel>;

export class AssiginCourseController {
  async createAssiginCourse(req: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = req.user?.organization_id as string;
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
          organizationId
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

      const validMembers = await OrganizationUser.findAll({
        where: {
          organization_id: organizationId,
          user_id: { [Op.in]: finalUserIds },
          is_active: true
        }
      });
      if (validMembers.length !== finalUserIds.length) {
        throw new ValidationError("One or more users do not belong to this organization or are inactive.");
      }

      const existingRecords = await AssignedCourseModel.findAll({
        where: { user_id: { [Op.overlap]: finalUserIds }, organization_id: organizationId },
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
          organization_id: organizationId,
        });

        // Local SaaS compatibility: keep local student_enrollments in sync
        // while the legacy course_user_mapping assignment table remains active.
        await repositorie.createLocalEnrollmentsForUserCourses(
          organizationId,
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
      const { user_id } = req.params as { user_id: string; };
      const organizationId = req.user?.organization_id as string;

      const course = await repositorie.getCourseByUserId(organizationId, user_id);

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
      const { course_id } = req.params as { course_id: string; };
      const organizationId = req.user?.organization_id as string;

      const course = await repositorie.getCourseById(organizationId, course_id);

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
