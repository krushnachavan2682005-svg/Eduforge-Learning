import { Sequelize } from "sequelize";
import { lesson } from "../models/lesson.model";
import { paginate } from "../utils/pagination";

export class lessonRepsitory {
  async getLesson(page: number, limit: number, filters: Record<string, any>) {
    const data = await paginate(lesson, {
      page: Number(page),
      limit: Number(limit),
      filters,
      attributes: [
        "id",
        "title",
        "created_at",
        "seq_no",
        [
          Sequelize.literal(`json_build_object(
          'id', "lesson"."course_id",
          'title', (
            SELECT c.title
            FROM courses c
            WHERE c.id = "lesson"."course_id"::uuid
          )
        )`),
          "course_id",
        ] as any,
      ],
      order: [["seq_no", "ASC"]],
    });

    return data;
  }

  async getlessonById(client_id: string, id: string) {
    return lesson.findOne({
      where: { id, client_id },
      attributes: [
        "id",
        "title",
        "created_at",
        "seq_no",
        [
          Sequelize.literal(`json_build_object(
          'id', "lesson"."course_id",
          'title', (
            SELECT c.title
            FROM courses c
            WHERE c.id = "lesson"."course_id"::uuid
          )
        )`),
          "course_id",
        ] as any,
      ],
    });
  }

  async createLesson(data: Partial<lesson>) {
    return lesson.create(data as any);
  }

  async updateLesson(id: string, data: Partial<lesson>) {
    const result = await lesson.findByPk(id);
    if (!result) return null;
    return result.update(data);
  }

  async deleteLesson(id: string) {
    const data = await lesson.findByPk(id);
    if (!data) return null;
    await data.destroy();
    return data;
  }
}
