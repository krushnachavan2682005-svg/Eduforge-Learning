import { Sequelize } from "sequelize";
import { lesson } from "./lesson.model";
import { paginate } from "../../utils/pagination";

export class lessonRepsitory {
  async getLesson(
    organizationId: string,
    page: number,
    limit: number,
    cursor: string | undefined,
    filters: Record<string, any>,
  ) {
    const finalFilters = { ...filters, organization_id: organizationId };

    const data = await paginate(lesson, {
      page: Number(page),
      limit: Number(limit),
      cursor,
      useCursorPagination:true,
      cursorFields: ["created_at", "id"],
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
      order: [
        ["created_at", "DESC"],
        ["id", "DESC"],
      ],
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
