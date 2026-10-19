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
import { Json } from "sequelize/types/utils";
import { resolve } from "path";
import { resetMemberPasswordSchema } from "../members/member.schemas";

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
    const lockKey = `${key}:lock`;
    let retries = 3; // जास्तीत जास्त ३ वेळा retry करणार

    while (retries >= 0) {
      // १. तुझा जुना Cache Read चा पूर्ण try/catch ब्लॉक इथे ठेव...
      try {
        const cached = await redis.get(key);
        if (cached) {
          if (cached === "NOT_FOUND")
            throw new NotFoundError("Course not found");
          return JSON.parse(cached); // डेटा मिळाला, थेट रिटर्न करा!
        }
      } catch {
        console.warn("Redis GET failed...");
      }

      console.log("CACHE MISS");

      // २. Lock घेण्याचा प्रयत्न कर
      let aquired_lock = await redis.set(lockKey, "1", { NX: true, EX: 5 });

      if (aquired_lock) {
        try {
          // Master Process: DB मधून डेटा आणेल
          const course = await this.courseRepo.getCourseById(
            organizationId,
            id,
          );

          if (!course) {
            await redis.set(key, "NOT_FOUND", { EX: 60 });
            throw new NotFoundError("Course not found");
          }

          await redis.set(key, JSON.stringify(course), { EX: 300 });
          return course;
        } finally {
          // ३. सर्वात महत्त्वाचे: काम झाल्यावर Lock काढून टाक!
          await redis.del(lockKey);
        }
      } else {
        // ४. Lock मिळाला नाही: 50ms थांब आणि loop मुळे परत वर जाऊन cache check कर
        await new Promise((resolve) => setTimeout(resolve, 50));
        retries--;
      }
    }

    // ५. ३ वेळा retry करूनही काहीच नाही झालं तर Error दे
    throw new Error("503: Service is currently busy, try again later.");
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
