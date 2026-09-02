import { lesson } from "./lesson.model";
import { lessonRepsitory } from "./lesson.repository";
import { CourseRepository } from "../course/course.repository";
import {
  ConflictError,
  InternalServerError,
  NotFoundError,
} from "../../utils/globalErrorHandlingFile";

export class LessonService {
  private lessonRepo = new lessonRepsitory();
  private courseRepo = new CourseRepository();

  async getAllLessons(
    organizationId: string,
    page: number,
    limit: number,
    cursor: string | undefined,
    filters: Record<string, any>,
  ) {
    return await this.lessonRepo.getLesson(
      organizationId,
      page,
      limit,
      cursor,
      filters,
    );
  }

  async getLessonById(organizationId: string, id: string) {
    const result = await this.lessonRepo.getlessonById(organizationId, id);
    if (!result) throw new NotFoundError("Lesson not found");
    return result;
  }

  async createLesson(organizationId: string, data: Partial<lesson>) {
    if (data.course_id) {
      const course = await this.courseRepo.getCourseById(
        organizationId,
        data.course_id,
      );
      if (!course || (Array.isArray(course) && course.length === 0)) {
        throw new NotFoundError("Course not found or access denied");
      }
    }

    try {
      return await this.lessonRepo.createLesson(organizationId, data);
    } catch (error: any) {
      if (error?.message?.includes("already exists")) {
        throw new ConflictError(error.message);
      }
      throw error;
    }
  }

  async updateLesson(
    organizationId: string,
    id: string,
    data: Partial<lesson>,
  ) {
    if (data.course_id) {
      const course = await this.courseRepo.getCourseById(
        organizationId,
        data.course_id,
      );
      if (!course || (Array.isArray(course) && course.length === 0)) {
        throw new NotFoundError("Course not found or access denied");
      }
    }

    const lessonInstance = await this.lessonRepo.findById(organizationId, id);
    if (!lessonInstance) {
      throw new NotFoundError("Lesson not found");
    }

    try {
      const updated = await this.lessonRepo.updateLesson(lessonInstance, data);
      return updated;
    } catch (error: any) {
      if (error?.message?.includes("already exists")) {
        throw new ConflictError(error.message);
      }
      throw error;
    }
  }

  async deleteLesson(organizationId: string, id: string) {
    const lessonInstance = await this.lessonRepo.findById(organizationId, id);
    if (!lessonInstance) {
      throw new NotFoundError("Lesson not found");
    }

    return await this.lessonRepo.deleteLesson(lessonInstance);
  }
}
