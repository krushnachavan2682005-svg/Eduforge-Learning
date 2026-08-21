import { AuthRepository } from "../auth/auth.repository";
import { NotFoundError } from "../../utils/globalErrorHandlingFile";

export class OrganizationService {
  private authRepository: AuthRepository;

  constructor() {
    this.authRepository = new AuthRepository();
  }

  async getCurrentOrganization(userId: string, organizationId: string) {
    const membership = await this.authRepository.findUserContext(
      userId,
      organizationId,
    );

    if (!membership) {
      throw new NotFoundError("Current organization was not found");
    }

    const organization = (membership as any).organization;

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      is_active: organization.is_active,
      role: membership.role,
    };
  }
}
