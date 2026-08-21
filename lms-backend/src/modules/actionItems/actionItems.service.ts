import { ConflictError, NotFoundError } from "../../utils/globalErrorHandlingFile";
import { ActionItemsInterface } from "./actionItems.interface";
import { ActionItemRepository } from "./actionItems.repository";
import { ActionItems } from "./actionItems.model";
import { AssignedActionItemsModel } from "../assignActionItems/assignActionItems.model";
import { StudentRepository } from "../students/student.repository";
import { Op } from "sequelize";

export class ActionItemsService {
  private repository: ActionItemRepository;
  private studentRepository: StudentRepository;

  constructor() {
    this.repository = new ActionItemRepository();
    this.studentRepository = new StudentRepository();
  }

  async getAllActionItems(
    organizationId: string,
    page: string,
    limit: string,
    filters: Record<string, any> = {}
  ) {
    filters.organization_id = organizationId;
    return this.repository.getActionItems(filters, Number(page), Number(limit));
  }

  async getActionItemById(organizationId: string, id: string) {
    return this.repository.getActionItemById(organizationId, id);
  }

  async createActionItem(organizationId: string, body: ActionItemsInterface) {
    const existing = await ActionItems.findOne({
      where: { organization_id: organizationId, task_name: body.task_name },
    });

    if (existing) {
      throw new ConflictError("Action item already exists for this client");
    }

    const payload = { ...body, organization_id: organizationId };
    return this.repository.createActionItem(payload);
  }

  async updateActionItem(
    organizationId: string,
    id: string,
    payload: Partial<ActionItemsInterface>
  ) {
    return this.repository.updateActionItem(organizationId, id, payload);
  }

  async deleteActionItem(organizationId: string, id: string) {
    const action = await ActionItems.findOne({
      where: { id, organization_id: organizationId },
    });

    if (!action) return null;

    const assignments = await AssignedActionItemsModel.findAll({
      where: { action_item_id: { [Op.contains]: [id] } },
    });

    for (const a of assignments) {
      const ids = a.action_item_id?.filter((i) => i !== id);
      ids?.length
        ? await a.update({ action_item_id: ids })
        : await a.destroy();
    }

    await action.destroy();
    return action;
  }

  async getReviewerDashboard(organizationId: string, reviewerId: string) {
    const results = await this.repository.getReviewerActionItems(
      organizationId,
      reviewerId
    );

    // Extract all unique user_ids from all assignments
    const allUserIds = new Set<string>();
    results.forEach((item: any) => {
      item.student_assignments?.forEach((assignment: any) => {
        assignment?.user_ids?.forEach((uid: string) => allUserIds.add(uid));
      });
    });

    if (allUserIds.size > 0) {
      const userIdsArray = Array.from(allUserIds);
      const nameMap = await this.studentRepository.getStudentNamesByUserIds(
        organizationId,
        userIdsArray
      );

      results.forEach((item: any) => {
        item.student_assignments?.forEach((assignment: any) => {
          assignment.user_ids = (assignment?.user_ids || []).map(
            (uid: string) => ({
              id: uid,
              name: nameMap[uid] || "",
            })
          );
        });
      });
    }

    return results;
  }
}
