import { Sequelize } from "sequelize";
import { Section } from "./section.model";
import { paginate } from "../../utils/pagination";

export class sectionRepository {
  async getSection(organizationId: string, page: number, limit: number) {
    const finalFilters = { organization_id: organizationId };

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
        [
          Sequelize.literal(`json_build_object(
          'id', "Section"."course_id",
          'title', (SELECT c.title FROM courses c WHERE c.id = "Section"."course_id"::uuid)
        )`),
          "course",
        ] as any,
        [
          Sequelize.literal(`json_build_object(
          'id', "Section"."lesson_id",
          'title', (SELECT l.title FROM lessons l WHERE l.id = "Section"."lesson_id"::uuid)
        )`),
          "lesson",
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
          "course",
        ],
        [
          Sequelize.literal(`json_build_object(
            'id', "Section"."lesson_id",
            'title', (SELECT l.title FROM lessons l WHERE l.id = "Section"."lesson_id"::uuid)
          )`),
          "lesson",
        ],
      ],
    });
  }

  async createSection(organizationId: string, data: Partial<Section>) {
    data.organization_id = organizationId;
    return Section.create(data as any);
  }

  async updateSection(
    organizationId: string,
    id: string,
    data: Partial<Section>,
  ) {
    const lesson = await Section.findOne({
      where: { id, organization_id: organizationId },
    });
    if (!lesson) return null;
    return lesson.update(data);
  }

  async delete(organizationId: string, id: string) {
    const lesson = await Section.findOne({
      where: { id, organization_id: organizationId },
    });
    if (!lesson) return null;
    await lesson?.destroy();
    return lesson;
  }
}
