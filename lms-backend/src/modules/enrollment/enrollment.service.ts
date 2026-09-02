import { EnrollmentRepsitory } from "./enrollment.repository";
import { EnrollmentInterface } from "./enrollment.interface";
import { NotFoundError } from "../../utils/globalErrorHandlingFile";
import { Enrollment } from "./enrollment.model";

export class EnrollmentService {
  private enrollmentRepo = new EnrollmentRepsitory();

  async getEnrollmentById(organizationId: string, id: string) {
    return this.enrollmentRepo.getEnrollmentById(organizationId, id);
  }

  async createEnrollment(organizationId: string, body: EnrollmentInterface) {
    const data = { ...body, organization_id: organizationId };

    if (data.enrolled_at) {
      const [day, month, year] = data.enrolled_at.split(/[\/\-]/).map(Number);
      const date = new Date(Date.UTC(year, month - 1, day, 18, 30, 0));
      data.enrolled_at = date.toISOString();
    } else {
      data.enrolled_at = new Date().toISOString();
    }

    return this.enrollmentRepo.createEnrollment(data);
  }

  async updateEnrollment(organizationId: string, id: string, data: Partial<Enrollment>) {
    const enrollment = await this.enrollmentRepo.findById(organizationId, id);
    if (!enrollment) return null; // Preserving legacy API contract

    return this.enrollmentRepo.updateEnrollment(enrollment, data);
  }

  async deleteEnrollment(organizationId: string, id: string) {
    const enrollment = await this.enrollmentRepo.findById(organizationId, id);
    if (!enrollment) {
      throw new NotFoundError("Enrollment not found");
    }
    
    return await this.enrollmentRepo.deleteEnrollment(enrollment);
  }

  async getAllEnrollment(organizationId: string, page?: number, limit?: number, cursor?: string) {
    return this.enrollmentRepo.getEnrollment(
      page || 1,
      limit || 20,
      cursor,
      { organization_id: organizationId }
    );
  }
}
