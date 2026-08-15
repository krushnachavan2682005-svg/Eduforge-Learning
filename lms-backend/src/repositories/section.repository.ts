import { Sequelize } from "sequelize";
import { Section } from "../models/section.models";
import { paginate } from "../utils/pagination";
import { asyncLocalStorage as cls } from "../constants/request-context";

export class sectionRepository {
  async getSection(page: number, limit: number, filters: Record<string, any>) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    const finalFilters = { ...filters, organization_id: organizationId };
    
    const data = await paginate(Section, {
      page: Number(page),
      limit: Number(limit),
      filters: finalFilters,
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

  async getSectionById(organizationId: string, id: string) {
    const store = cls.getStore();
    organizationId = store?.organizationId || organizationId;
    
    return Section.findOne({
      where: { organization_id: organizationId, id },
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
    const store = cls.getStore();
    if (store?.organizationId) {
      data.organization_id = store.organizationId;
    }
    return Section.create(data as any);
  }

  async updateSection(id: string, data: Partial<Section>) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    const lesson = await Section.findOne({ where: { id, organization_id: organizationId } });
    if (!lesson) return null;
    return lesson.update(data);
  }

  async delete(id: string) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    const lesson = await Section.findOne({ where: { id, organization_id: organizationId } });
    if (!lesson) return null;
    await lesson?.destroy();
    return lesson;
  }
}
