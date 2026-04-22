import { Sequelize } from "sequelize";
import { Section } from "../models/section.models";
import { paginate } from "../utils/pagination";

export class sectionRepository {
  async getSection(page: number, limit: number, filters: Record<string, any>) {
    const data = await paginate(Section, {
      page: Number(page),
      limit: Number(limit),
      filters,
      attributes: [
        "id",
        "title",
        "seq_no",
        "duration",
        "content_type",
        "quizzes",
        "created_at",
        "updated_at",
        "lesson_id",
        [
          Sequelize.literal(`json_build_object(
          'id', "Section"."course_id",
          'title', (SELECT c.title FROM courses c WHERE c.id = "Section"."course_id"::uuid)
        )`),
          "course_id",
        ] as any,
        [
          Sequelize.literal(`json_build_object(
          'id', "Section"."lesson_id",
          'title', (SELECT l.title FROM lessons l WHERE l.id = "Section"."lesson_id"::uuid)
        )`),
          "lesson_id",
        ] as any,
      ],
      order: [
        ["updated_at", "DESC"],
        ["created_at", "DESC"],
      ],
    });

    return data;
  }

  async getSectionById(client_id: string, id: string) {
    return Section.findOne({
      where: { client_id, id },
      attributes: [
        "title",
        "id",
        "created_at",
        "seq_no",
        "content_type",
        "duration",
        "quizzes",
        [
          Sequelize.literal(`json_build_object(
            'id', "Section"."course_id",
            'title', (SELECT c.title FROM courses c WHERE c.id = "Section"."course_id"::uuid)
          )`),
          "course_id",
        ],
        [
          Sequelize.literal(`json_build_object(
            'id', "Section"."lesson_id",
            'title', (SELECT l.title FROM lessons l WHERE l.id = "Section"."lesson_id"::uuid)
          )`),
          "lesson_id",
        ],
      ],
    });
  }

  async createSection(data: Partial<Section>) {
    return Section.create(data as any);
  }

  async updateSection(id: string, data: Partial<Section>) {
    const lesson = await Section.findByPk(id);
    if (!lesson) return null;
    return lesson.update(data);
  }

  async delete(id: string) {
    const lesson = await Section.findByPk(id);
    if (!lesson) return null;
    await lesson?.destroy();
    return lesson;
  }
}
