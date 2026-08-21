import { AssiginCourseRepositorie } from "./assignCourse.repository";
import { StudentRepository } from "../students/student.repository";
import { CourseRepository } from "../course/course.repository";
import { ValidationError } from "../../utils/globalErrorHandlingFile";

export class AssignCourseService {
  private repository = new AssiginCourseRepositorie();
  private studentRepository = new StudentRepository();
  private courseRepository = new CourseRepository();

  async assignCourses(
    organizationId: string,
    courseIds: string[],
    userIds?: string[],
    classIdsParam?: string | string[]
  ) {
    let finalUserIds: string[] = [];
    const classIds = classIdsParam
      ? Array.isArray(classIdsParam)
        ? classIdsParam
        : [classIdsParam]
      : [];
    const userClassMap = new Map<string, string>();

    if (userIds?.length) finalUserIds.push(...userIds);

    for (const selectedClassId of classIds) {
      const classUserIds = await this.studentRepository.getUserIdsByClassId(
        organizationId,
        selectedClassId
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

    const validMemberCount = await this.repository.countValidMembers(organizationId, finalUserIds);

    if (validMemberCount !== finalUserIds.length) {
      throw new ValidationError("One or more users do not belong to this organization or are inactive.");
    }

    if (courseIds && courseIds.length > 0) {
      const count = await this.courseRepository.countCoursesByIds(organizationId, courseIds);
      if (count !== courseIds.length) {
        throw new ValidationError("One or more courses do not belong to the current organization");
      }
    }

    const existingRecords = await this.repository.findAllAssignedCourses(organizationId, finalUserIds);

    const userCourseMap = new Map<string, Set<string>>();
    finalUserIds.forEach((u) => userCourseMap.set(u, new Set()));
    existingRecords.forEach((record: any) => {
      record.user_id.forEach((u: string) =>
        record.course_id.forEach((c: string) => userCourseMap.get(u)?.add(c))
      );
    });

    const usersToAssign = finalUserIds.filter(
      (u) => !courseIds.some((c) => userCourseMap.get(u)?.has(c))
    );

    if (usersToAssign.length === 0) {
      throw new ValidationError("All users already have this course.");
    }

    for (const user of usersToAssign) {
      await this.repository.createAssignCourse({
        course_id: courseIds,
        user_id: [user],
        class_id: userClassMap.get(user),
        organization_id: organizationId,
      });

      const student = await this.studentRepository.findStudentByUserId(
        organizationId,
        user
      );

      if (student) {
        await Promise.all(
          courseIds.map((courseId) =>
            this.studentRepository.createEnrollment({
              organization_id: organizationId,
              student_id: student.id,
              course_id: courseId,
              status: "assigned",
            })
          )
        );
      }
    }

    return { usersToAssign };
  }

  async getAssignedCoursesByUser(organizationId: string, userId: string) {
    return this.repository.getCourseByUserId(organizationId, userId);
  }

  async getCourseById(organizationId: string, courseId: string) {
    return this.repository.getCourseById(organizationId, courseId);
  }
}
