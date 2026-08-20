import { sequelize } from "../../config/database";
import { AssignedCourseModel } from "./assignCourse.model";
import { QueryTypes } from "sequelize";
import { StudentRepository } from "../students/student.repository";
import { asyncLocalStorage as cls } from "../../constants/request-context";
import { Course } from "../course/course.model";

const studentRepository = new StudentRepository();

export class AssiginCourseRepositorie {
  async createAssignCourse(data: Partial<AssignedCourseModel>) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    if (organizationId) {
      data.organization_id = organizationId;
      // Phase 6F: Validate that ALL course_ids belong to the current organization
      if (data.course_id && data.course_id.length > 0) {
        const count = await Course.count({ where: { id: data.course_id, organization_id: organizationId } });
        if (count !== data.course_id.length) {
          throw new Error("One or more courses do not belong to the current organization");
        }
      }
    }
    return AssignedCourseModel.create(data as any);
  }

  async getUsersByClassId(class_id: string, organizationId: string) {
    const localUserIds = await studentRepository.getUserIdsByClassId(
      organizationId,
      class_id,
    );

    return localUserIds;
  }

  async createLocalEnrollmentsForUserCourses(
    organizationId: string,
    userId: string,
    courseIds: string[],
  ) {
    const student = await studentRepository.findStudentByUserId(
      organizationId,
      userId,
    );

    if (!student) return;

    await Promise.all(
      courseIds.map((courseId) =>
        studentRepository.createEnrollment({
          organization_id: organizationId,
          student_id: student.id,
          course_id: courseId,
          status: "assigned",
        }),
      ),
    );
  }

  async getCourseByUserId(organizationId: string, user_id: string) {
    const store = cls.getStore();
    organizationId = store?.organizationId || organizationId;
    return sequelize.query(
      `
    SELECT 
      ac.id AS id,
      c.id AS course_id,
      c.title,
      c.description,
      c.language,
      c.price,
      c.thumbnail_url,
      c.is_published,
      c.tags,
      c.created_at,
      c.updated_at,
      c.level,
      (SELECT COUNT(*)::int FROM sections s WHERE s.course_id = c.id) AS total_sections,
      (SELECT COUNT(DISTINCT sum.section_id)::int FROM section_user_mapping sum 
       WHERE sum.course_id = c.id 
         AND sum.user_id = :user_id 
         AND sum.is_completed = true
         AND sum.section_id IN (SELECT id FROM sections s WHERE s.course_id = c.id)) AS completed_sections,
      LEAST(
        ROUND(
          COALESCE(
            (SELECT COUNT(DISTINCT sum.section_id)::float FROM section_user_mapping sum 
             WHERE sum.course_id = c.id 
               AND sum.user_id = :user_id 
               AND sum.is_completed = true
               AND sum.section_id IN (SELECT id FROM sections s WHERE s.course_id = c.id)) 
            / NULLIF((SELECT COUNT(*)::float FROM sections s WHERE s.course_id = c.id), 0)
            * 100, 
          0)
        )::int,
        100
      ) AS progress_percentage
    FROM course_user_mapping ac
    JOIN LATERAL unnest(ac.course_id) AS cid ON TRUE
    JOIN courses c ON c.id = cid
    WHERE ac.organization_id = :organizationId
      AND :user_id = ANY(ac.user_id)
    `,
      {
        replacements: { organization_id: organizationId, user_id },
        type: QueryTypes.SELECT,
      }
    );
  }
  async getCourseById(organizationId: string, course_id: string) {
    const store = cls.getStore();
    organizationId = store?.organizationId || organizationId;
    const sql = `
    SELECT 
      jsonb_build_object(
        'id', c.id,
        'title', c.title,
         'description',c.description,
            'language',c.language,
            'thumbnail_url',c.thumbnail_url,
            'tags',c.tags
      ) AS course,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', l.id,
            'title', l.title,
            'seq_no',l.seq_no,
            'sections', COALESCE(
              (
                SELECT json_agg(
                  jsonb_build_object(
                    'id', s.id,
                    'title', s.title,
                    'seq_no',s.seq_no,
                    'duration',s.duration,
                    'content_type',s.content_type
                  )
                )
                FROM sections s
                WHERE s.lesson_id = l.id
              ), '[]'::json
            )
          )
        ) FILTER (WHERE l.id IS NOT NULL), '[]'::json
      ) AS lessons
    FROM courses c
    LEFT JOIN lessons l ON l.course_id = c.id
    WHERE c.organization_id = :organizationId
      AND c.id = :course_id
    GROUP BY c.id, c.title;
  `;

    return await sequelize?.query(sql, {
      replacements: { organization_id: organizationId, course_id },
      type: QueryTypes?.SELECT,
    });
  }
}
