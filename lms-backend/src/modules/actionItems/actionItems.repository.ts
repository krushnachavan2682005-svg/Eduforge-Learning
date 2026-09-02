import { ActionItems } from "./actionItems.model";
import { paginate } from "../../utils/pagination";
import { ActionItemsInterface } from "./actionItems.interface";
import { QueryTypes } from "sequelize";
import { sequelize } from "../../config/database";

export class ActionItemRepository {
  async getActionItems(
    filters: Record<string, any>,
    page: number,
    limit: number,
    cursor?: string
  ) {
    return paginate(ActionItems, {
      page,
      limit,
      cursor,
      useCursorPagination:true,
      cursorFields: ["created_at", "id"],
      filters,
      attributes: [
        "id",
        "task_name",
        "total_score",
        "description",
        "level",
        "reviewer",
        "pdf_attachment",
        "created_at",
        "updated_at",
      ],
      order: [
        ["created_at", "DESC"],
        ["id", "DESC"],
      ],
    });
  }

  async getActionItemById(organizationId: string, id: string) {
    return ActionItems.findOne({
      where: { organization_id: organizationId, id },
      attributes: [
        "id",
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

  async updateActionItem(organizationId: string, id: string, data: Partial<ActionItemsInterface>) {
    const action = await ActionItems.findOne({ where: { id, organization_id: organizationId } });
    if (!action) return null;
    return action.update(data);
  }

  async deleteActionItem(organizationId: string, id: string) {
    // Handled purely via Service using Sequelize models directly or this could just be generic if used.
    // However, it was already handled fully in the Service.
    return null;
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
    WHERE ai.organization_id = :clientId
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

      return results;
    } catch (error) {
      console.error("Reviewer Dashboard Query Error:", error);
      throw error;
    }
  }
}
