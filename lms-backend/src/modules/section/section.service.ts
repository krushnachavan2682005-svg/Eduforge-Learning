import { ConflictError } from "../../utils/globalErrorHandlingFile";
import { sectionRepository } from "./section.repository";
import { SectionInterface } from "./section.interface";

export class SectionService {
  private repository: sectionRepository;

  constructor() {
    this.repository = new sectionRepository();
  }

  async getAllSection(organizationId: string, page: string, limit: string) {
    return this.repository.getSection(
      organizationId,
      Number(page),
      Number(limit),
    );
  }

  async getSectionById(organizationId: string, id: string) {
    return this.repository.getSectionById(organizationId, id);
  }

  async createSection(organizationId: string, body: SectionInterface) {
    try {
      const data = { ...body };
      return await this.repository.createSection(organizationId, data);
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw new ConflictError("Failed to create section: already exists");
      }
      throw error;
    }
  }

  async updateSection(
    organizationId: string,
    id: string,
    body: Partial<SectionInterface>,
  ) {
    try {
      const updateData = { ...body };
      return await this.repository.updateSection(
        organizationId,
        id,
        updateData,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        throw new ConflictError("Failed to update section: already exists");
      }
      throw error;
    }
  }

  async deleteSection(organizationId: string, id: string) {
    return this.repository.delete(organizationId, id);
  }
}
