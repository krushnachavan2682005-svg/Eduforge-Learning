import { Course } from "../models/course.model";
import { paginate } from "../utils/pagination";
import { Op, QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { FastifyReply, FastifyInstance, FastifyRequest } from "fastify";
import S3_FOLDER from "../constants/s3-folder-constant";
import { handleFileUpload } from "../utils/s3-upload-utility";
import { ALLOWED_MIME_TYPES } from "../constants/mimeType";
import { asyncLocalStorage as cls } from "../constants/request-context";
import { lesson } from "../models/lesson.model";
export class CourseRepository {
  // private fastify?: FastifyInstance;
  // static initialize: any;
  // initialize(fastify: FastifyInstance) {
  //   this.fastify = fastify;
  //   return this;
  // }

  async getAllCourses(
    page: number,
    limit: number,
    filters?: Record<string, any>,
    parsed_skipped_lesson?: boolean,
  ) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    console.log(`================${organizationId}=============`);
    console.log(`================${store}=============`);

    const where: any = {
      ...filters,
      organization_id: organizationId,
    };

    const include: any[] = [];

    if (parsed_skipped_lesson === true) {
      include.push({
        model: lesson,
        as: "lessons",
        where: {
          seq_no: {
            [Op.gt]: 1,
          },
        },
      });
    }

    const result = await paginate(Course, {
      page: Number(page),
      limit: Number(limit),
      filters: where,

      attributes: [
        "id",
        "title",
        "description",
        "language",
        "created_at",
        "thumbnail_url",
        "level",
        "tags",

        [
          sequelize.literal(`
          (
            SELECT COUNT(*)
            FROM lessons
            WHERE lessons.course_id = "Course".id
          )
        `),
          "lessonCount",
        ],
      ] as any,

      include,

      order: [["created_at", "DESC"]],
    });

    return result;
  }

  async getCourseById(organizationId: string, course_id: string) {
    const store = cls.getStore();
    organizationId = store?.organizationId || organizationId;
    const sql = `
    SELECT jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'description', c.description,
      'language', c.language,
      'thumbnail_url', c.thumbnail_url,
      'tags', c.tags,
      'level', c.level,
       'course_duration', COALESCE((
          SELECT SUM(CAST(s.duration AS INTEGER))
          FROM lessons l
          JOIN sections s ON s.lesson_id = l.id
          WHERE l.course_id = c.id
      ), 0)
    ) AS course,
    COALESCE(
      json_agg(
        jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'total_duration', COALESCE((
              SELECT SUM(CAST(s.duration AS INTEGER))
              FROM sections s
              WHERE s.lesson_id = l.id
          ), 0),
          'seq_no', l.seq_no,
          'sections', COALESCE(
            (
              SELECT json_agg(
                  jsonb_build_object(
                    'id', s.id,
                    'title', s.title,
                    'seq_no', s.seq_no,
                    'duration', s.duration,
                    'content_type', s.content_type,
                    'quizzes', s.quizzes
                  )
                  ORDER BY s.seq_no NULLS LAST
              )
              FROM sections s
              WHERE s.lesson_id = l.id
            ),
            '[]'::json
          )
        )
        ORDER BY l.seq_no NULLS LAST
      ) FILTER (WHERE l.id IS NOT NULL),
      '[]'::json
    ) AS lessons
  FROM courses c
    LEFT JOIN lessons l ON l.course_id = c.id
  WHERE c.organization_id = :organizationId
    AND c.id = :course_id
  GROUP BY c.id, c.title, c.description, c.language, c.thumbnail_url, c.tags, c.level;
  `;

    return await sequelize?.query(sql, {
      replacements: { organization_id: organizationId, course_id },
      type: QueryTypes?.SELECT,
    });
  }

  async createCourse(data: Partial<Course>) {
    const store = cls.getStore();
    if (store?.organizationId) {
      data.organization_id = store.organizationId;
    }
    return Course.create(data as any);
  }

  async updateCourse(id: string, data: Partial<Course>) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    const course = await Course.findOne({
      where: { id, organization_id: organizationId },
    });
    if (!course) return null;
    return course.update(data);
  }

  async deleteCourse(id: string) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    const course = await Course.findOne({
      where: { id, organization_id: organizationId },
    });
    if (!course) return null;
    await course.destroy();
    return course;
  }

  async uploadImage(req: FastifyRequest, organizationId: string, id: string) {
    const store = cls.getStore();
    organizationId = store?.organizationId || organizationId;
    const folder = S3_FOLDER.COURSR_FOLDER(organizationId, id);

    const result = await handleFileUpload(req, {
      folder,
      allowedTypes: ALLOWED_MIME_TYPES,
      maxSize: 5 * 1024 * 1024,
    });

    return result;
  }
}
