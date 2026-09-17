import { AuthRepository } from "../auth/auth.repository";
import { NotFoundError } from "../../utils/globalErrorHandlingFile";
import { organizationRepo } from "./organization.repository";
import { Organization } from "./organization.model";
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
  async getActiveOrganizations() {
    let data = await organizationRepo.getactiveOrganizations();
    return data;
  }
  async getOrganizationCounts(organization_id: string) {
    let exist=Organization.findOne({where:{id:organization_id}})
    if(!exist){
         throw new Error("Organization Not Exist")
    }
    let organization_data =
      await organizationRepo.getOrganizationCounts(organization_id);
    return organization_data;
  }
}
