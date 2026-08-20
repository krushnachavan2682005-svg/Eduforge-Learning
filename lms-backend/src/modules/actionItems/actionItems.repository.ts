import { ActionItems } from "./actionItems.model";
import { paginate } from "../../utils/pagination";
import { ActionItemsInterface } from "./actionItems.interface";
import { QueryTypes, Op } from "sequelize";
import { sequelize } from "../../config/database";
import { AssignedActionItemsModel } from "../assignActionItems/assignActionItems.model";
import { StudentRepository } from "../students/student.repository";
import { asyncLocalStorage as cls } from "../../constants/request-context";

const studentRepository = new StudentRepository();

export class ActionItemRepository {
  async getActionItems(
    page: number,
    limit: number,
    filters: Record<string, any>,
  ) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    if (organizationId) {
      filters.organization_id = organizationId;
    }
    return paginate(ActionItems, {
      page: Number(page),
      limit: Number(limit),
      filters,
      attributes: [
        "id",
        // "organizationId",
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

  async getActionItemById(organizationId: string, id: string) {
    const store = cls.getStore();
    organizationId = store?.organizationId as string;
    if (!organizationId) throw new Error("Tenant context missing");
    return ActionItems.findOne({
      where: { organization_id: organizationId, id },
      attributes: [
        "id",
        // "organizationId",
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
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    if (organizationId) {
      data.organization_id = organizationId;
    }
    return ActionItems.create(data);
  }

  async updateActionItem(id: string, data: Partial<ActionItemsInterface>) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    const action = await ActionItems.findOne({ where: organizationId? { id, organization_id: organizationId } : { id } });
    if (!action) return null;
    return action.update(data);
  }

  async deleteActionItem(id: string) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    const action = await ActionItems.findOne({ where: organizationId? { id, organization_id: organizationId } : { id } });
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
    const store = cls.getStore();
    clientId = store?.organizationId as string;
    if (!clientId) throw new Error("Tenant context missing");
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

      // Extract all unique user_ids from all assignments
      const allUserIds = new Set<string>();
      results.forEach((item) => {
        item.student_assignments?.forEach((assignment: any) => {
          assignment?.user_ids?.forEach((uid: string) => allUserIds?.add(uid));
        });
      });

      if (allUserIds.size > 0) {
        const userIdsArray = Array?.from(allUserIds);
        const nameMap = await studentRepository.getStudentNamesByUserIds(
          clientId,
          userIdsArray,
        );

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
