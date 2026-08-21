import { Enrollment } from "./enrollment.model";
import { paginate } from "../../utils/pagination";

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

  async getEnrollmentById(organizationId: string, id: string) {
    return Enrollment.findOne({
      where: { id, organization_id: organizationId },
      attributes: ["id", "enrolled_at", "course_id", "user_id", "created_at"],
    });
  }

  async createEnrollment(data: Partial<Enrollment>) {
    return Enrollment.create(data as any);
  }

  async findById(organizationId: string, id: string) {
    return Enrollment.findOne({ where: { id, organization_id: organizationId } });
  }

  async updateEnrollment(enrollment: any, data: Partial<Enrollment>) {
    return enrollment.update(data);
  }

  async deleteEnrollment(enrollment: any) {
    await enrollment.destroy();
    return enrollment;
  }
}
