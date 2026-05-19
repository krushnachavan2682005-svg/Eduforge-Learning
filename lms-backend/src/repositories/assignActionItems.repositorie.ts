import { QueryTypes } from "sequelize";
import { externalDB, sequelize } from "../config/database";
import { AssignedActionItemsModel } from "../models/assignActionItems.model";
import { AssignedActionItemsTimelineModel } from "../models/assignedActionItemsTimeline.model";
import { StudentClass } from "../modules/students/class.model";
import { Student } from "../modules/students/student.model";
import { StudentRepository } from "../modules/students/student.repository";

const studentRepository = new StudentRepository();

export class AssiginActionItemsrepositorie {
  async createAssignCourse(data: Partial<AssignedActionItemsModel>) {
    return AssignedActionItemsModel.create(data as any);
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

  async getUsersByClientId(client_id: string) {
    const localStudents = await studentRepository.listStudents(client_id);
    const localUserIds = localStudents
      .map((student) => student.user_id)
      .filter(Boolean);

    if (localUserIds.length) {
      return localUserIds;
    }

    // Compatibility fallback while legacy ERP admissions still exist.
    const sql = `
    SELECT user_id
    FROM addmissions
    WHERE client_id = :clientId
  `;

    const results: any[] = await externalDB.query(sql, {
      replacements: { clientId: client_id },
      type: QueryTypes.SELECT,
    });

    return results.map((row: any) => row.user_id);
  }
  async getClientIdByClassId(class_id: string): Promise<string | null> {
    const localClass = await StudentClass.findByPk(class_id);
    if (localClass?.organization_id) {
      return localClass.organization_id;
    }

    // Compatibility fallback while legacy ERP admissions still exist.
    const sql = `
    SELECT client_id
    FROM addmissions
    WHERE class = :classId
    LIMIT 1
  `;

    const [result]: any[] = await externalDB.query(sql, {
      replacements: { classId: class_id },
      type: QueryTypes.SELECT,
    });

    return result?.client_id ?? null;
  }
  async getClientIdByUserId(user_id: string): Promise<string | null> {
    const localStudent = await Student.findOne({ where: { user_id } });
    if (localStudent?.organization_id) {
      return localStudent.organization_id;
    }

    // Compatibility fallback while legacy ERP admissions still exist.
    const sql = `
    SELECT client_id
    FROM addmissions
    WHERE user_id = :userId
    LIMIT 1
  `;

    const [result]: any[] = await externalDB.query(sql, {
      replacements: { userId: user_id },
      type: QueryTypes.SELECT,
    });

    return result?.client_id ?? null;
  }

  async getActionItemsByUserId(
    client_id: string,
    user_id: string,
    class_id?: string | string[],
  ): Promise<any[]> {
    try {
      const checkQuery = `
        SELECT count(*) as count
        FROM assigned_action_items
        WHERE client_id = :client_id
          AND :user_id = ANY(user_id)
      `;
      const [countResult]: any[] = await sequelize.query(checkQuery, {
        replacements: { client_id, user_id },
        type: QueryTypes.SELECT,
      });

      if (countResult?.count > 0) {
        const rawIds = await sequelize.query(
          `
            SELECT action_item_id 
            FROM assigned_action_items 
            WHERE client_id = :client_id AND :user_id = ANY(user_id)
         `,
          {
            replacements: { client_id, user_id },
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
    WHERE aai.client_id = :client_id
      AND :user_id = ANY(aai.user_id)
    `;

    const replacements: any = { client_id, user_id };

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

  async getApprovedActionItemsByUserId(user_id: string, client_id: string) {
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
      AND aai.client_id = :client_id
    ORDER BY aai.updated_at DESC
  `;

    try {
      const rows = await sequelize.query(query, {
        replacements: { user_id, client_id },
        type: QueryTypes.SELECT,
      });
      return rows as any[];
    } catch (error) {
      throw error;
    }
  }
  async getApprovedActionItemsWithStudentName(client_id: string) {
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
    WHERE aai.client_id = :client_id
      AND aai.status = 'APPROVED'
    ORDER BY aai.updated_at DESC
    `,
      {
        replacements: { client_id },
        type: QueryTypes.SELECT,
      },
    );

    const userIds = [...new Set((actionItems as any[]).map((i) => i.user_id))];

    if (userIds.length === 0) return [];

    const students = await externalDB.query(
      `
  SELECT user_id, first_name, last_name
  FROM addmissions
  WHERE client_id = :client_id
    AND user_id IN (:user_ids)
  `,
      {
        replacements: {
          client_id,
          user_ids: userIds,
        },
        type: QueryTypes.SELECT,
      },
    );

    const studentMap = new Map(
      (students as any[]).map((s: any) => [
        s.user_id,
        `${s.first_name} ${s.last_name}`,
      ]),
    );

    return (actionItems as any[]).map((item) => ({
      ...item,
      student_name: studentMap.get(item.user_id) ?? "",
    }));
  }
}
