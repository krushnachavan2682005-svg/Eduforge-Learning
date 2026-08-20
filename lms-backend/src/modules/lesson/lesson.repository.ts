import { Sequelize } from "sequelize";
import { lesson } from "./lesson.model";
import { paginate } from "../../utils/pagination";
import { asyncLocalStorage as cls } from "../../constants/request-context";
import { Course } from "../course/course.model";

export class lessonRepsitory {
  async getLesson(page: number, limit: number, filters: Record<string, any>) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
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
    const store = cls.getStore();
    organizationId = store?.organizationId || organizationId;
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

  async createLesson(data: Partial<lesson>) {
    const store = cls.getStore();
    if (store?.organizationId) {
      data.organization_id = store.organizationId;
      
      if (data.course_id) {
         const course = await Course.findOne({ where: { id: data.course_id, organization_id: store.organizationId } });
         if (!course) throw new Error("Course not found or access denied");
      }
    }
    return lesson.create(data as any);
  }

  async updateLesson(id: string, data: Partial<lesson>) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    const result = await lesson.findOne({ where: { id, organization_id: organizationId } });
    if (!result) return null;
    
    if (data.course_id && data.course_id !== result.course_id) {
        const course = await Course.findOne({ where: { id: data.course_id, organization_id: organizationId } });
        if (!course) throw new Error("Course not found or access denied");
    }
    
    return result.update(data);
  }

  async deleteLesson(id: string) {
    const store = cls.getStore();
    const organizationId = store?.organizationId;
    const data = await lesson.findOne({ where: { id, organization_id: organizationId } });
    if (!data) return null;
    await data.destroy();
    return data;
  }
}
