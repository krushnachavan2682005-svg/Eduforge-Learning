import { Course } from "./course.model";
import { paginate } from "../../utils/pagination";
import { Op, QueryTypes } from "sequelize";
import { sequelize } from "../../config/database";
import { lesson } from "../lesson/lesson.model";

export class CourseRepository {
  async getAllCourses(
    organizationId: string,
    page: number,
    limit: number,
    cursor: string | undefined,
    filters?: Record<string, any>,
    parsed_skipped_lesson?: boolean,
    includeLessons?: boolean,
  ) {
    const where: any = {
      ...filters,
      organization_id: organizationId,
    };

    const include: any[] = [];

    if (includeLessons === true) {
      const lessonInclude: any = {
        model: lesson,
        as: "lessons",
        attributes: ["id", "title", "course_id", "seq_no"],
      };

      if (parsed_skipped_lesson === true) {
        lessonInclude.where = {
          seq_no: {
            [Op.gt]: 1,
          },
        };
      }

      include.push(lessonInclude);
    }

    const result = await paginate(Course, {
      page: Number(page),
      limit: Number(limit),
      cursor,
      cursorFields: ["created_at", "id"],
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
          SELECT SUM(CAST(NULLIF(s.duration, '') AS INTEGER))
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
      replacements: { organizationId: organizationId, course_id },
      type: QueryTypes?.SELECT,
    });
  }

  async createCourse(organizationId: string, data: Partial<Course>) {
    data.organization_id = organizationId;
    return Course.create(data as any);
  }

  async findById(organizationId: string, id: string) {
    return Course.findOne({
      where: { id, organization_id: organizationId },
    });
  }

  async countCoursesByIds(organizationId: string, courseIds: string[]) {
    return Course.count({
      where: { id: { [Op.in]: courseIds }, organization_id: organizationId },
    });
  }

  async updateCourse(course: any, data: Partial<Course>) {
    return course.update(data);
  }

  async deleteCourse(course: any) {
    await course.destroy();
    return course;
  }
}
