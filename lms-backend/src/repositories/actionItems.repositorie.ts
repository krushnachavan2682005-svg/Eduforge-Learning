import { ActionItems } from "../models/actionItems.model";
import { paginate } from "../utils/pagination";
import { ActionItemsInterface } from "../interfaces/actionItems.interface";
import { QueryTypes, Op } from "sequelize";
import { sequelize, externalDB } from "../config/database";
import { AssignedActionItemsModel } from "../models/assignActionItems.model";

export class ActionItemRepository {
  async getActionItems(
    page: number,
    limit: number,
    filters: Record<string, any>,
  ) {
    return paginate(ActionItems, {
      page: Number(page),
      limit: Number(limit),
      filters,
      attributes: [
        "id",
        // "client_id",
        "task_name",
        "total_score",
        "description",
        "level",
        "reviewer",
        "pdf_attachment",
        "created_at",
        "updated_at",
      ],
      order: [["created_at", "DESC"]],
    });
  }

  async getActionItemById(client_id: string, id: string) {
    return ActionItems.findOne({
      where: { client_id, id },
      attributes: [
        "id",
        // "client_id",
        "task_name",
        "total_score",
        "description",
        "level",
        "reviewer",
        "pdf_attachment",
        "created_at",
        "updated_at",
      ],
    });
  }

  async createActionItem(data: ActionItemsInterface) {
    return ActionItems.create(data);
  }

  async updateActionItem(id: string, data: Partial<ActionItemsInterface>) {
    const action = await ActionItems.findByPk(id);
    if (!action) return null;
    return action.update(data);
  }

  async deleteActionItem(id: string) {
    const action = await ActionItems?.findByPk(id);
    if (!action) return null;
    const assignments = await AssignedActionItemsModel?.findAll({
      where: { action_item_id: { [Op.contains]: [id] } },
    });

    for (const a of assignments) {
      const ids = a?.action_item_id?.filter((i) => i !== id);
      ids?.length
        ? await a?.update({ action_item_id: ids })
        : await a?.destroy();
    }
    await action.destroy();
    return action;
  }

  async getReviewerActionItems(clientId: string, reviewerId: string) {
    const sql = `
    SELECT 
      ai.*,
     COALESCE(
  (
    SELECT json_agg(
      json_build_object(
        'assignment_id', aai.id,
        'status', aai.status,
        'attachment', aai.attachment,
        'comment', aai.comment,
        'notes', aai.notes,
        'user_ids', aai.user_id,
        'class_id', aai.class_id,
        'assigned_at', aai.created_at
      )
    )
    FROM assigned_action_items aai
    WHERE 
       ai.id = ANY (aai.action_item_id)
  ),
  '[]'
) AS student_assignments

    FROM action_items ai
    WHERE ai.client_id = :clientId
      AND ai.reviewer @> :reviewerIdFilter::jsonb
    ORDER BY ai.created_at DESC;
  `;

    try {
      const results: any[] = await sequelize.query(sql, {
        replacements: {
          clientId,
          reviewerIdFilter: JSON.stringify([{ id: reviewerId }]),
        },
        type: QueryTypes.SELECT,
      });

      // Extract all unique user_ids from all assignments
      const allUserIds = new Set<string>();
      results.forEach((item) => {
        item.student_assignments?.forEach((assignment: any) => {
          assignment?.user_ids?.forEach((uid: string) => allUserIds?.add(uid));
        });
      });

      if (allUserIds.size > 0) {
        // Fetch student names from externalDB
        const userIdsArray = Array?.from(allUserIds);
        const studentNamesQuery = `
          SELECT user_id, first_name, middle_name, last_name
          FROM addmissions
          WHERE user_id IN (:userIdsArray) AND client_id = :clientId;
        `;
        const studentResults: any[] = await externalDB?.query(
          studentNamesQuery,
          {
            replacements: { userIdsArray, clientId },
            type: QueryTypes?.SELECT,
          },
        );

        // Create a map of user_id to name
        const nameMap: Record<string, string> = {};
        studentResults.forEach((row) => {
          nameMap[row?.user_id] = [
            row?.first_name,
            row?.middle_name,
            row?.last_name,
          ]
            .filter(Boolean)
            .join(" ");
        });

        // Update results with student details
        results.forEach((item) => {
          item.student_assignments?.forEach((assignment: any) => {
            assignment.user_ids = (assignment?.user_ids || [])?.map(
              (uid: string) => ({
                id: uid,
                name: nameMap[uid] || "",
              }),
            );
          });
        });
      }

      return results;
    } catch (error) {
      console.error("Reviewer Dashboard Query Error:", error);
      throw error;
    }
  }
}
