import { Level } from "../models/level.model";
import { sequelize } from "../config/database";
import { QueryTypes } from "sequelize";

export class LevelRepository {
  async createLevel(data: any) {
    // Check if level_name already exists for this client
    const existing = await Level.findOne({
      where: {
        organization_id: data.organization_id,
        level_name: data.level_name
      },
    });

    if (existing) {
      const error = new Error("This level name already exists for this client");
      (error as any).name = "SequelizeUniqueConstraintError";
      throw error;
    }

    return await Level.create(data);
  }

  async getLevels(page: number, limit: number, where: any) {
    const offset = (page - 1) * limit;
    return await Level.findAll({
      where,
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });
  }

  async getLevelById(organizationId: string, id: string) {
    return await Level.findOne({
      where: { id, organization_id: organizationId },
    });
  }


  async isLevelAssignedToUsers(levelName: string, clientId: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM assigned_action_items aai
      INNER JOIN action_items ai ON ai.id = ANY(aai.action_item_id)
      WHERE ai.level = :levelName
        AND aai.organization_id = :clientId
        AND array_length(aai.user_id, 1) > 0
    `;

    const result: any = await sequelize.query(query, {
      replacements: { levelName, clientId },
      type: QueryTypes.SELECT,
    });

    return result[0]?.count > 0;
  }

  async updateLevel(id: string, data: any) {
    const item = await Level.findByPk(id);
    if (!item) return null;

    // Check if level is assigned to users
    const isAssigned = await this.isLevelAssignedToUsers(item.level_name, item.organization_id);
    if (isAssigned) {
      const error = new Error("Level cannot be updated because it is assigned to a user.");
      (error as any).statusCode = 403;
      throw error;
    }

    return await item.update(data);
  }

  async deleteLevel(id: string) {
    const item = await Level.findByPk(id);
    if (!item) return null;

    // Check if level is assigned to users
    const isAssigned = await this.isLevelAssignedToUsers(item.level_name, item.organization_id);
    if (isAssigned) {
      const error = new Error("Level cannot be deleted because it is assigned to a user.");
      (error as any).statusCode = 403;
      throw error;
    }

    await item.destroy();
    return true;
  }
}
