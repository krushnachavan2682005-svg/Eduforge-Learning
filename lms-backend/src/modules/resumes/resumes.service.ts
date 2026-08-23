import { ResumeRepository } from "./resumes.repository";
import { ResumeInterface } from "./resumes.interface";
import { NotFoundError } from "../../utils/globalErrorHandlingFile";

export class ResumeService {
  private repository: ResumeRepository;

  constructor() {
    this.repository = new ResumeRepository();
  }

  async createResume(data: ResumeInterface, organizationId: string) {
    const payload = { ...data, organization_id: organizationId };
    return await this.repository.createResume(payload);
  }

  async updateResume(userId: string, data: ResumeInterface) {
    const count = await this.repository.updateResume(userId, data);

    if (count === 0) {
      throw new NotFoundError("Resume not found");
    }

    // Explicitly return a message since the frontend might expect it
    return { message: "Resume updated successfully" };
  }

  async getResumeByUserId(userId: string) {
    const resume = await this.repository.getResumeByUserId(userId);

    if (!resume) {
      throw new NotFoundError("Resume not found for this user");
    }

    return resume;
  }

  async deleteResume(id: string) {
    const deleted = await this.repository.deleteResume(id);

    if (!deleted) {
      throw new NotFoundError("Resume not found");
    }

    return true;
  }
}
