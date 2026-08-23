import { LevelRepository } from "./level.repository";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../utils/globalErrorHandlingFile";

export class LevelService {
  private repository: LevelRepository;

  constructor() {
    this.repository = new LevelRepository();
  }

  async createLevel(data: {
    organization_id: string;
    level_name: string;
    start_date?: string;
    end_date?: string;
  }) {
    const existing = await this.repository.findLevelByName(
      data.organization_id,
      data.level_name,
    );
    if (existing) {
      throw new ConflictError("This level name already exists for this client");
    }
    return await this.repository.createLevel(data);
  }

  async getLevels(page: number, limit: number, organizationId: string) {
    return await this.repository.getLevels(page, limit, {
      organization_id: organizationId,
    });
  }

  async getLevelById(organizationId: string, id: string) {
    return await this.repository.getLevelById(organizationId, id);
  }

  async updateLevel(id: string, organizationId: string, data: any) {
    const item = await this.repository.getLevelById(organizationId, id);
    if (!item) return null;

    const isAssigned = await this.repository.isLevelAssignedToUsers(
      item.level_name,
      organizationId,
    );
    if (isAssigned) {
      throw new ForbiddenError(
        "Level cannot be updated because it is assigned to a user.",
      );
    }

    return await this.repository.updateLevel(item, data);
  }

  async deleteLevel(id: string, organizationId: string) {
    const item = await this.repository.getLevelById(organizationId, id);
    if (!item) return null;

    const isAssigned = await this.repository.isLevelAssignedToUsers(
      item.level_name,
      organizationId,
    );
    if (isAssigned) {
      throw new ForbiddenError(
        "Level cannot be deleted because it is assigned to a user.",
      );
    }

    return await this.repository.deleteLevel(item);
  }
}
