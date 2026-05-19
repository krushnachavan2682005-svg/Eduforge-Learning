import { externalDB, sequelize } from "../config/database";
import { AssignedCourseModel } from "../models/assignCourse.model";
import { QueryTypes } from "sequelize";
import { StudentRepository } from "../modules/students/student.repository";

const studentRepository = new StudentRepository();

export class AssiginCourseRepositorie {
  async createAssignCourse(data: Partial<AssignedCourseModel>) {
    return AssignedCourseModel.create(data as any);
  }

  async getUsersByClassId(class_id: string, client_id: string) {
    const localUserIds = await studentRepository.getUserIdsByClassId(
      client_id,
      class_id,
    );

    if (localUserIds.length) {
      return localUserIds;
    }

    // Compatibility fallback while legacy ERP class/admission data still exists.
    const sql = `
    SELECT user_id
    FROM addmissions
    WHERE class = :classId
      AND client_id = :clientId
  `;

    const results: any[] = await externalDB.query(sql, {
      replacements: { classId: class_id, clientId: client_id },
      type: QueryTypes.SELECT,
    });

    return results.map((row: any) => row.user_id);
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

  async getCourseByUserId(client_id: string, user_id: string) {
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
    WHERE ac.client_id = :client_id
      AND :user_id = ANY(ac.user_id)
    `,
      {
        replacements: { client_id, user_id },
        type: QueryTypes.SELECT,
      }
    );
  }
  async getCourseById(client_id: string, course_id: string) {
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
    WHERE c.client_id = :client_id
      AND c.id = :course_id
    GROUP BY c.id, c.title;
  `;

    return await sequelize?.query(sql, {
      replacements: { client_id, course_id },
      type: QueryTypes?.SELECT,
    });
  }
}
