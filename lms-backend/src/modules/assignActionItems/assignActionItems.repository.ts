import { QueryTypes, Op } from "sequelize";
import { sequelize } from "../../config/database";
import { AssignedActionItemsModel } from "./assignActionItems.model";
import { AssignedActionItemsTimelineModel } from "./assignedActionItemsTimeline.model";
import { StudentClass } from "../students/class.model";
import { Student } from "../students/student.model";
import { StudentRepository } from "../students/student.repository";
import { asyncLocalStorage as cls } from "../../constants/request-context";
import { ActionItems } from "../actionItems/actionItems.model";

export class AssiginActionItemsrepositorie {
  async getAssignedRecordById(
    id: string,
    organizationId?: string,
    userId?: string
  ) {
    const whereClause: any = { id };
    
    if (organizationId) {
      whereClause.organization_id = organizationId;
    }
    
    if (userId) {
      whereClause.user_id = { [Op.contains]: [userId] };
    }

    return AssignedActionItemsModel.findOne({
      where: whereClause,
    });
  }

  async updateAssignedRecord(
    id: string,
    updateData: any,
    organizationId?: string
  ) {
    const whereClause: any = { id };
    
    if (organizationId) {
      whereClause.organization_id = organizationId;
    }

    const [updatedCount] = await AssignedActionItemsModel.update(updateData, {
      where: whereClause,
    });
    
    return updatedCount;
  }

  async createAssignCourse(data: Partial<AssignedActionItemsModel>) {
    return AssignedActionItemsModel.create(data as any);
  }

  async bulkCreateAssignCourse(data: Partial<AssignedActionItemsModel>[]) {
    return AssignedActionItemsModel.bulkCreate(data as any[]);
  }

  async getActionItemsByUserId(
    organizationId: string,
    user_id: string,
    class_id?: string | string[],
  ): Promise<any[]> {
    if (!organizationId) throw new Error("Tenant context missing");
    try {
      const checkQuery = `
        SELECT count(*) as count
        FROM assigned_action_items
        WHERE organization_id = :organizationId
          AND :user_id = ANY(user_id)
      `;
      const [countResult]: any[] = await sequelize.query(checkQuery, {
        replacements: { organizationId, user_id },
        type: QueryTypes.SELECT,
      });

      if (countResult?.count > 0) {
        const rawIds = await sequelize.query(
          `
            SELECT action_item_id 
            FROM assigned_action_items 
            WHERE organization_id = :organizationId AND :user_id = ANY(user_id)
         `,
          {
            replacements: { organizationId, user_id },
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

    const replacements: any = { organizationId, user_id };

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
    organizationId: string,
    user_id?: string,
    publishOnly: boolean = false,
  ) {
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
      replacements.organizationId = organizationId;
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

  async getApprovedActionItemsByUserId(organizationId: string, user_id: string) {
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
        replacements: { user_id, organizationId },
        type: QueryTypes.SELECT,
      });
      return rows as any[];
    } catch (error) {
      throw error;
    }
  }
  async getApprovedActionItems(organizationId: string) {
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
        replacements: { organizationId },
        type: QueryTypes.SELECT,
      },
    );

    return actionItems as any[];
  }
}
