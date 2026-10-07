import { Course } from "./course.model";
import { redis } from "../../config/redis_client";
import { CourseRepository } from "./course.repository";
import {
  ConflictError,
  InternalServerError,
  NotFoundError,
} from "../../utils/globalErrorHandlingFile";
import S3_FOLDER from "../../constants/s3-folder-constant";
import { handleFormDataFileUpload } from "../../utils/s3-upload-utility";
import { ALLOWED_MIME_TYPES } from "../../constants/mimeType";

export class CourseService {
  private courseRepo = new CourseRepository();

  async getAllCourses(
    organizationId: string,
    page: number,
    limit: number,
    cursor: string | undefined,
    filters: Record<string, any>,
    skipFirstLesson: boolean,
    includeLessons: boolean = false,
  ) {
    return await this.courseRepo.getAllCourses(
      organizationId,
      page,
      limit,
      cursor,
      filters,
      skipFirstLesson,
      includeLessons,
    );
  }

  async getCourseById(organizationId: string, id: string) {
    const key = `org:${organizationId}:course:${id}`;

    // Redis read — isolated try/catch, failure here means "treat as cache miss"
    try {
      const cached = await redis.get(key);
      if (cached) {
        try {
          console.log("CACHE HIT");
          return JSON.parse(cached);
        } catch {
          console.warn("Corrupted JSON in cache, falling back to DB");
          // fall through to DB fetch below
        }
      }
    } catch {
      console.warn("Redis GET failed, falling back to DB");
      // fall through to DB fetch below
    }

    console.log("CACHE MISS");
    const course = await this.courseRepo.getCourseById(organizationId, id);

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    try {
      await redis.set(key, JSON.stringify(course), { EX: 300 });
    } catch {
      console.warn("Redis SET failed, serving DB result uncached");
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

  async updateCourse(
    organizationId: string,
    id: string,
    data: Partial<Course>,
  ) {
    const key = `org:${organizationId}:course:${id}`;
    const course = await this.courseRepo.findById(organizationId, id);
    if (!course) {
      throw new NotFoundError("Course not found");
    }

    try {
      const updated = await this.courseRepo.updateCourse(course, data);
      try {
        await redis.del(key);
      } catch (err) {
        console.warn(
          "Redis Key Deletation Failed The following error introduced",
          err,
        );
      }
      return updated;
    } catch (error: any) {
      if (error?.message?.includes("already exists")) {
        throw new ConflictError(error.message);
      }
      throw error;
    }
  }

  async deleteCourse(organizationId: string, id: string) {
    const key = `org:${organizationId}:course:${id}`;

    const course = await this.courseRepo.findById(organizationId, id);

    if (!course) {
      throw new NotFoundError("Course not found");
    }

    const result = await this.courseRepo.deleteCourse(course);

    console.log("DB Course Deletion Successful, Deleting Redis Key");

    try {
      await redis.del(key);
    } catch (err) {
      console.warn(
        "Redis Key Deletation Failed The following error introduced",
        err,
      );
    }

    return result;
  }

  async uploadCourseImage(
    organizationId: string,
    file: any,
    server: any,
    id: string,
  ) {
    const folder = S3_FOLDER.COURSR_FOLDER(organizationId, id);

    const result = await handleFormDataFileUpload(file, { server } as any, {
      folder,
      allowedTypes: ALLOWED_MIME_TYPES,
      maxSize: 5 * 1024 * 1024,
    });

    return result;
  }
}
