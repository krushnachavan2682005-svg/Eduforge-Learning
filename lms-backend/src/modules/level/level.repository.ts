import { Level } from "./level.model";
import { sequelize } from "../../config/database";
import { QueryTypes } from "sequelize";

export class LevelRepository {
  async findLevelByName(organizationId: string, levelName: string) {
    return await Level.findOne({
      where: {
        organization_id: organizationId,
        level_name: levelName
      },
    });
  }

  async createLevel(data: any) {
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

  async updateLevel(item: any, data: any) {
    return await item.update(data);
  }

  async deleteLevel(item: any) {
    await item.destroy();
    return true;
  }
}
