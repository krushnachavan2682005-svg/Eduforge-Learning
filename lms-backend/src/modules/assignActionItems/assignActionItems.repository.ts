import { QueryTypes } from "sequelize";
import { sequelize } from "../../config/database";
import { AssignedActionItemsModel } from "./assignActionItems.model";
import { AssignedActionItemsTimelineModel } from "./assignedActionItemsTimeline.model";
import { StudentClass } from "../students/class.model";
import { Student } from "../students/student.model";
import { StudentRepository } from "../students/student.repository";
import { asyncLocalStorage as cls } from "../../constants/request-context";
import { ActionItems } from "../actionItems/actionItems.model";

const studentRepository = new StudentRepository();

export class AssiginActionItemsrepositorie {
  async createAssignCourse(data: Partial<AssignedActionItemsModel>) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    if (organizationId) {
      data.organization_id = organizationId;
      // Phase 7: Validate that ALL action_item_ids belong to the current organization
      if (data.action_item_id && data.action_item_id.length > 0) {
        const count = await ActionItems.count({ where: { id: data.action_item_id, organization_id: organizationId } });
        if (count !== data.action_item_id.length) {
          throw new Error("One or more action items do not belong to the current organization");
        }
      }
    }
    return AssignedActionItemsModel.create(data as any);
  }

  async getUsersByClassId(class_id: string, organizationId: string) {
    const localUserIds = await studentRepository.getUserIdsByClassId(
      organizationId,
      class_id,
    );

    return localUserIds;
  }

  async getUsersByClientId(organizationId: string) {
    const localStudents = await studentRepository.listStudents(organizationId);
    const localUserIds = localStudents
      .map((student) => student.user_id)
      .filter(Boolean);

    return localUserIds;
  }
  async getClientIdByClassId(class_id: string): Promise<string | null> {
    const localClass = await StudentClass.findByPk(class_id);
    if (localClass?.organization_id) {
      return localClass.organization_id;
    }
    return null;
  }
  async getClientIdByUserId(user_id: string): Promise<string | null> {
    const localStudent = await Student.findOne({ where: { user_id } });
    if (localStudent?.organization_id) {
      return localStudent.organization_id;
    }
    return null;
  }

  async getActionItemsByUserId(
    organizationId: string,
    user_id: string,
    class_id?: string | string[],
  ): Promise<any[]> {
    const store = cls.getStore();
    organizationId = store?.organizationId as string;
    if (!organizationId) throw new Error("Tenant context missing");
    try {
      const checkQuery = `
        SELECT count(*) as count
        FROM assigned_action_items
        WHERE organizationId = :organizationId
          AND :user_id = ANY(user_id)
      `;
      const [countResult]: any[] = await sequelize.query(checkQuery, {
        replacements: { organization_id: organizationId, user_id },
        type: QueryTypes.SELECT,
      });

      if (countResult?.count > 0) {
        const rawIds = await sequelize.query(
          `
            SELECT action_item_id 
            FROM assigned_action_items 
            WHERE organizationId = :organizationId AND :user_id = ANY(user_id)
         `,
          {
            replacements: { organization_id: organizationId, user_id },
            type: QueryTypes.SELECT,
          },
        );

        const allIds = (rawIds as any[]).flatMap((r) => r.action_item_id);

        if (allIds.length > 0) {
          const existingActionItems = await sequelize.query(
            `
                SELECT id, task_name FROM action_items WHERE id IN (:ids)
             `,
            {
              replacements: { ids: allIds },
              type: QueryTypes.SELECT,
            },
          );
        }
      }
    } catch (err) {}

    let query = `
    SELECT 
      aai.id AS id,
      unnested_item.item_id AS action_item_id,
      ai.task_name,
      ai.description,
      ai.level,
      COALESCE(tat.publish, false) AS publish,
      ai.total_score,
      ai.reviewer,
      ai.pdf_attachment,
      ai.created_at AS action_item_created_at,
      ai.updated_at AS action_item_updated_at,
      aai.class_id,
      aai.status,
      aai.attachment,
      aai.notes,
      aai.comment,
      aai.score,
      aai.created_at AS assigned_at
    FROM assigned_action_items aai
    CROSS JOIN LATERAL unnest(aai.action_item_id) AS unnested_item(item_id)
    LEFT JOIN action_items ai ON ai.id = unnested_item.item_id
    LEFT JOIN publish_timeline tat
      ON tat.assigned_id = aai.id
      AND tat.assignment_id = unnested_item.item_id
      AND tat.user_id = :user_id
    WHERE aai.organization_id = :organizationId
      AND :user_id = ANY(aai.user_id)
    `;

    const replacements: any = { organization_id: organizationId, user_id };

    if (class_id) {
      const classIds = Array.isArray(class_id) ? class_id : [class_id];
      query += ` AND aai.class_id = ANY(:class_id)`;
      replacements.class_id = classIds;
    }
    query += ` ORDER BY aai.updated_at DESC`;
    try {
      const rows = await sequelize.query(query, {
        replacements,
        type: QueryTypes.SELECT,
      });
      return rows as any[];
    } catch (error) {
      throw error;
    }
  }
  async logPublishEvent(data: {
    assigned_id: string;
    assignment_id: string;
    user_id: string;
    publish: boolean;
  }) {
    const [record, created] =
      await AssignedActionItemsTimelineModel.findOrCreate({
        where: {
          assigned_id: data?.assigned_id,
          assignment_id: data?.assignment_id,
          user_id: data?.user_id,
        },
        defaults: { publish: data?.publish },
      });

    if (!created) {
      if (record.publish !== data?.publish) {
        record.publish = data?.publish;
        record.created_at = new Date();
        await record.save();
      }
    }

    return record;
  }

  async getPublishTimelineByUser(
    user_id?: string,
    publishOnly: boolean = false,
  ) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    let sql = `
      SELECT
        tat.id,
        tat.assigned_id,
        tat.assignment_id,
        tat.user_id,
        tat.publish,
        tat.created_at,
          ai.task_name,
        ai.description,
        ai.level,
        ai.total_score,
        aai.status,
        aai.score,
        aai.notes,
        aai.comment,
        aai.attachment,
        aai.created_at AS assigned_at,
        aai.updated_at AS assigned_updated_at
      FROM publish_timeline tat
      LEFT JOIN action_items ai ON ai.id = tat.assignment_id
      LEFT JOIN assigned_action_items aai ON aai.id = tat.assigned_id
    `;

    const replacements: any = {};
    const conditions: string[] = [];
    conditions.push(`ai.id IS NOT NULL`);

    if (user_id) {
      conditions.push(`tat.user_id = :user_id`);
      replacements.user_id = user_id;
    }
    if (organizationId) {
      conditions.push(`aai.organization_id = :organizationId`);
      replacements.organization_id = organizationId;
    }

    if (publishOnly) {
      conditions.push(`tat.publish = true`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += ` ORDER BY tat.created_at DESC, tat.id DESC`;

    const results: any[] = await sequelize.query(sql, {
      replacements,
      type: QueryTypes.SELECT,
    });
    return results;
  }

  async getApprovedActionItemsByUserId(user_id: string) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    if (!organizationId) throw new Error("Tenant context missing");
    const query = `
    SELECT 
      aai.id AS id,
      unnested_item.item_id AS action_item_id,
      COALESCE(ai.task_name, '') AS task_name,
      ai.description,
      ai.total_score AS total_score,
      aai.score,
      aai.status,
      aai.attachment,
      aai.comment,
      aai.notes,
      aai.created_at AS assigned_at,
      COALESCE(ai.level, '') AS level,
      aai.created_at AS start_date,
      aai.updated_at AS end_date
    FROM assigned_action_items aai
    CROSS JOIN LATERAL unnest(aai.action_item_id) AS unnested_item(item_id)
    LEFT JOIN action_items ai 
      ON ai.id = unnested_item.item_id
    WHERE :user_id = ANY(aai.user_id)
      AND aai.status = 'APPROVED'
      AND aai.organization_id = :organizationId
    ORDER BY aai.updated_at DESC
  `;

    try {
      const rows = await sequelize.query(query, {
        replacements: { user_id, organization_id: organizationId },
        type: QueryTypes.SELECT,
      });
      return rows as any[];
    } catch (error) {
      throw error;
    }
  }
  async getApprovedActionItemsWithStudentName() {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    if (!organizationId) throw new Error("Tenant context missing");
    const actionItems = await sequelize.query(
      `
    SELECT 
      au.user_id,
      aai.id AS assigned_id,
      ai.task_name,
      aai.score,
      aai.status,
      COALESCE(ai.level, '') AS level,
      aai.created_at AS start_date,
      aai.updated_at AS end_date,
      aai.notes,
      ai.total_score AS total_score
    FROM public.assigned_action_items aai
    JOIN LATERAL unnest(aai.user_id) AS au(user_id) ON true
    LEFT JOIN action_items ai 
      ON ai.id = ANY(aai.action_item_id)
    WHERE aai.organization_id = :organizationId
      AND aai.status = 'APPROVED'
    ORDER BY aai.updated_at DESC
    `,
      {
        replacements: { organization_id: organizationId },
        type: QueryTypes.SELECT,
      },
    );

    const userIds = [...new Set((actionItems as any[]).map((i) => i.user_id))];

    if (userIds.length === 0) return [];

    const studentMap = new Map(
      Object.entries(
        await studentRepository.getStudentNamesByUserIds(organizationId, userIds),
      ),
    );

    return (actionItems as any[]).map((item) => ({
      ...item,
      student_name: studentMap.get(item.user_id) ?? "",
    }));
  }
}
