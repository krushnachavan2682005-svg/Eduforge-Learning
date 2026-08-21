import CompletedAssignCourse from "./completedAssignCourse.model";
import { sequelize } from "../../config/database";
import { QueryTypes } from "sequelize";

export class CompletedAssignCours {
  async saveCompletedAssignCourse(organizationId: string, data: any) {
    data.organization_id = organizationId;
    return await CompletedAssignCourse.create(data);
  }

  async getCompletedAssignCourse(
    organizationId: string,
    user_id: string,
    course_id: string
  ) {
    const sql = `
    SELECT jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'description', c.description,
      'language', c.language,
      'thumbnail_url', c.thumbnail_url,
      'tags', c.tags,
      'level', c.level
    ) AS course,
    COALESCE(
      json_agg(
        jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'seq_no', l.seq_no,
          'total_duration', COALESCE((
          SELECT SUM(CAST(s.duration AS INTEGER))         
          FROM sections s
              WHERE s.lesson_id = l.id
          ), 0),
          'remaining_duration', COALESCE((
    SELECT SUM(CAST(s.duration AS INTEGER))        
        FROM sections s
            LEFT JOIN section_user_mapping cac
              ON cac.section_id = s.id AND cac.user_id = :user_id
            WHERE s.lesson_id = l.id
              AND (cac.is_completed = false OR cac.is_completed IS NULL)
          ), 0),
          'sections', COALESCE(
            (
              SELECT json_agg(
                jsonb_build_object(
                  'id', s.id,
                  'title', s.title,
                  'seq_no', s.seq_no,
                  'duration', s.duration,
                  'quizzes',s.quizzes,
                  'content_type', s.content_type,
                  -- quizzes from sections table
                  -- completed status
                  'is_completed', COALESCE(
                    (
                      SELECT cac.is_completed
                      FROM section_user_mapping cac
                      WHERE cac.section_id = s.id
                        AND cac.user_id = :user_id
                      LIMIT 1
                    ),
                    false
                  ),

                  -- user quiz answers
                  'user_quiz_answers', COALESCE(
                    (
                      SELECT cac.user_quiz_answers
                      FROM section_user_mapping cac
                      WHERE cac.section_id = s.id
                        AND cac.user_id = :user_id
                      LIMIT 1
                    ),
                    '[]'::jsonb
                  )
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
  WHERE c.id = :course_id AND c.organization_id = :organizationId
  GROUP BY c.id, c.title, c.description, c.language, c.thumbnail_url, c.tags, c.level;
  `;

    const rows = await sequelize.query(sql, {
      replacements: { user_id, course_id, organizationId },
      type: QueryTypes.SELECT,
    });

    if (!rows || rows.length === 0) {
      return null;
    }

    return rows[0] as any;
  }
}
