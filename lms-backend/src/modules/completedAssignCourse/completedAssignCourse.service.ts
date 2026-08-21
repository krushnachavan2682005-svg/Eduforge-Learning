import { CompletedAssignCours } from "./completedAssignCourse.repository";
import { CourseRepository } from "../course/course.repository";
import { ForbiddenError } from "../../utils/globalErrorHandlingFile";

export class CompletedAssignCourseService {
  private repository = new CompletedAssignCours();
  private courseRepository = new CourseRepository();

  async saveCompletedAssignCourse(organizationId: string, payload: any) {
    if (payload.course_id) {
      const course = await this.courseRepository.getCourseById(
        organizationId,
        payload.course_id
      );
      if (!course || course.length === 0) {
        throw new ForbiddenError("Course not found or access denied");
      }
    }

    return this.repository.saveCompletedAssignCourse(organizationId, payload);
  }

  async getCompletedAssignCourse(organizationId: string, userId: string, courseId: string) {
    return this.repository.getCompletedAssignCourse(organizationId, userId, courseId);
  }
}
