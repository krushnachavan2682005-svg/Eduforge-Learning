import { QueryTypes } from "sequelize";
import { sequelize } from "../../config/database";
import { Course } from "../course/course.model";

export class DashboardRepository {
  async hasCreatedByColumn(tableName: string): Promise<boolean> {
    const rows = await sequelize.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = :tableName
         AND column_name = 'created_by'
         AND table_schema = current_schema()`,
      { replacements: { tableName }, type: QueryTypes.SELECT },
    );
    return rows.length > 0;
  }

  async getExamIdsCreatedByTutor(
    organizationId: string,
    userId: string,
    hasCreatedBy: boolean,
  ): Promise<string[]> {
    const query = `
      SELECT id FROM exams
      WHERE organization_id = :organizationId
      ${userId && hasCreatedBy ? "AND created_by = :userId" : ""}
    `;
    const rows: any[] = await sequelize.query(query, {
      replacements: { organizationId, userId },
      type: QueryTypes.SELECT,
    });
    return rows.map((r) => r.id);
  }

  async getExamAssignmentsByExamIds(examIds: string[]): Promise<any[]> {
    if (!examIds.length) return [];
    return sequelize.query(
      `SELECT exam_id FROM exam_assignments WHERE exam_id IN (:examIds)`,
      { replacements: { examIds }, type: QueryTypes.SELECT },
    );
  }

  async getExamSubmissionsByExamIds(examIds: string[]): Promise<any[]> {
    if (!examIds.length) return [];
    try {
      return await sequelize.query(
        `SELECT submitted_at, review_status FROM exam_user_mappings WHERE exam_id IN (:examIds)`,
        { replacements: { examIds }, type: QueryTypes.SELECT },
      );
    } catch (err: any) {
      console.warn("dashboard: fallback exam_user_mappings query", err.message);
      try {
        return await sequelize.query(
          `SELECT review_status FROM exam_user_mappings WHERE exam_id IN (:examIds)`,
          { replacements: { examIds }, type: QueryTypes.SELECT },
        );
      } catch (err2: any) {
        console.error("dashboard: failed secondary query", err2.message);
        return [];
      }
    }
  }

  async getActionItemIdsAssignedToReviewer(
    organizationId: string,
    userId: string,
  ): Promise<string[]> {
    if (!userId) return [];
    const rows: any[] = await sequelize.query(
      `SELECT id FROM action_items
       WHERE organization_id = :organizationId
         AND reviewer::jsonb @> :userFilter::jsonb`,
      {
        replacements: {
          organizationId,
          userFilter: JSON.stringify([{ id: userId }]),
        },
        type: QueryTypes.SELECT,
      },
    );
    return rows.map((r) => r.id);
  }

  async getAssignedActionItems(
    organizationId: string,
    actionItemIds: string[],
  ): Promise<any[]> {
    if (actionItemIds.length == 0) {
      return [];
    }
    return sequelize.query(
      `SELECT action_item_id, user_id, status FROM assigned_action_items
       WHERE organization_id = :organizationId AND action_item_id IN (:actionItemIds)`,
      { replacements: { organizationId }, type: QueryTypes.SELECT },
    );
  }

  async getCreatedCoursesCount(
    organizationId: string,
    userId: string,
    hasCreatedBy: boolean,
  ): Promise<number> {
    const rows: any[] = await sequelize.query(
      `SELECT COUNT(*) as cnt FROM courses WHERE organization_id = :organizationId
       ${userId && hasCreatedBy ? "AND created_by = :userId" : ""}`,
      { replacements: { organizationId, userId }, type: QueryTypes.SELECT },
    );
    return Number(rows[0]?.cnt || 0);
  }

  async getCourseIdsCreatedByTutor(
    organizationId: string,
    userId: string,
    hasCreatedBy: boolean,
  ): Promise<string[]> {
    if (!userId || !hasCreatedBy) return [];
    const rows = await Course.findAll({
      attributes: ["id"],
      where: { organization_id: organizationId, created_by: userId },
      raw: true,
    });

    return rows.map((r) => r.id);
  }

  async getCourseUserMappings(
    organizationId: string,
    tutorCourseIds: string[],
  ): Promise<any[]> {
    if (tutorCourseIds.length == 0) {
      return [];
    }
    return sequelize.query(
      `SELECT course_id, user_id FROM course_user_mapping
       WHERE organization_id = :organizationId AND course_id IN (:tutorCourseIds)`,
      {
        replacements: { organizationId, tutorCourseIds },
        type: QueryTypes.SELECT,
      },
    );
  }

  async getSectionUserMappings(
    organizationId: string,
    tutorCourseIds: string[],
  ): Promise<any[]> {
    if (tutorCourseIds.length == 0) {
      return [];
    }
    return await sequelize.query(
      `SELECT course_id, user_id, is_completed FROM section_user_mapping
         WHERE organization_id = :organizationId AND course_id IN (:tutorCourseIds)`,
      {
        replacements: { organizationId, tutorCourseIds },
        type: QueryTypes.SELECT,
      },
    );
  }
}
