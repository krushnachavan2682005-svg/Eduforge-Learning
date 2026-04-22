import { Enrollment } from "../models/enrollment.model";
import { paginate } from "../utils/pagination";

export class EnrollmentRepsitory {
  async getEnrollment(
    page: number,
    limit: number,
    filters: Record<string, any>
  ) {
    const data = await paginate(Enrollment, {
      page: Number(page),
      limit: Number(limit),
      filters,
      attributes: ["id", "enrolled_at", "course_id", "user_id", "created_at"],
      order: [["created_at", "DESC"]],
    });
    return data;
  }

  async getEnrollmentById(client_id: string, id: string) {
    return Enrollment.findOne({
      where: { id, client_id },
      attributes: ["id", "enrolled_at", "course_id", "user_id", "created_at"],
    });
  }

  async createEnrollment(data: Partial<Enrollment>) {
    return Enrollment.create(data as any);
  }

  async updateEnrollment(id: string, data: Partial<Enrollment>) {
    const result = await Enrollment.findByPk(id);
    if (!result) return null;
    return result.update(data);
  }

  async deleteEnrollment(id: string) {
    const data = await Enrollment.findByPk(id);
    if (!data) return null;
    await data.destroy();
    return data;
  }
}
