import { Course } from "./course.model";
import { CourseRepository } from "./course.repository";
import { ConflictError, InternalServerError, NotFoundError } from "../../utils/globalErrorHandlingFile";
import S3_FOLDER from "../../constants/s3-folder-constant";
import { handleFormDataFileUpload } from "../../utils/s3-upload-utility";
import { ALLOWED_MIME_TYPES } from "../../constants/mimeType";

export class CourseService {
  private courseRepo = new CourseRepository();

  async getAllCourses(organizationId: string, page: number, limit: number, filters: Record<string, any>, skipFirstLesson: boolean) {
    return await this.courseRepo.getAllCourses(organizationId, page, limit, filters, skipFirstLesson);
  }

  async getCourseById(organizationId: string, id: string) {
    const course = await this.courseRepo.getCourseById(organizationId, id);
    if (!course || !course.length) {
      throw new NotFoundError("Course not found");
    }
    return course;
  }

  async createCourse(organizationId: string, data: Partial<Course>) {
    try {
      return await this.courseRepo.createCourse(organizationId, data);
    } catch (error: any) {
      if (error?.message?.includes("already exists")) {
        throw new ConflictError(error.message);
      }
      throw error;
    }
  }

  async updateCourse(organizationId: string, id: string, data: Partial<Course>) {
    const course = await this.courseRepo.findById(organizationId, id);
    if (!course) {
      throw new NotFoundError("Course not found");
    }

    try {
      const updated = await this.courseRepo.updateCourse(course, data);
      return updated;
    } catch (error: any) {
      if (error?.message?.includes("already exists")) {
        throw new ConflictError(error.message);
      }
      throw error;
    }
  }

  async deleteCourse(organizationId: string, id: string) {
    const course = await this.courseRepo.findById(organizationId, id);
    if (!course) {
      throw new NotFoundError("Course not found");
    }

    return await this.courseRepo.deleteCourse(course);
  }

  async uploadCourseImage(organizationId: string, file: any, server: any, id: string) {
    const folder = S3_FOLDER.COURSR_FOLDER(organizationId, id);

    const result = await handleFormDataFileUpload(file, { server } as any, {
      folder,
      allowedTypes: ALLOWED_MIME_TYPES,
      maxSize: 5 * 1024 * 1024,
    });

    return result;
  }
}
