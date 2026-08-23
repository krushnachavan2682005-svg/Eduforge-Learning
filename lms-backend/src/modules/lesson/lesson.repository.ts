import { Sequelize } from "sequelize";
import { lesson } from "./lesson.model";
import { paginate } from "../../utils/pagination";

export class lessonRepsitory {
  async getLesson(
    organizationId: string,
    page: number,
    limit: number,
    filters: Record<string, any>,
  ) {
    const finalFilters = { ...filters, organization_id: organizationId };

    const data = await paginate(lesson, {
      page: Number(page),
      limit: Number(limit),
      filters: finalFilters,
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

  async getlessonById(organizationId: string, id: string) {
    return lesson.findOne({
      where: { id, organization_id: organizationId },
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

  async createLesson(organizationId: string, data: Partial<lesson>) {
    data.organization_id = organizationId;
    return lesson.create(data as any);
  }

  async findById(organizationId: string, id: string) {
    return lesson.findOne({ where: { id, organization_id: organizationId } });
  }

  async updateLesson(lessonInstance: any, data: Partial<lesson>) {
    return lessonInstance.update(data);
  }

  async deleteLesson(lessonInstance: any) {
    await lessonInstance.destroy();
    return lessonInstance;
  }
}
