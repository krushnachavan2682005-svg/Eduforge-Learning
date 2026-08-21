import { AuthRepository } from "../auth/auth.repository";
import { NotFoundError } from "../../utils/globalErrorHandlingFile";

export class UserService {
  private authRepository: AuthRepository;

  constructor() {
    this.authRepository = new AuthRepository();
  }

  async getCurrentUser(userId: string, organizationId: string) {
    const membership = await this.authRepository.findUserContext(
      userId,
      organizationId,
    );

    if (!membership) {
      throw new NotFoundError("Authenticated user was not found");
    }

    const user = (membership as any).user;
    const organization = (membership as any).organization;

    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: membership.role,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        is_active: organization.is_active,
      },
    };
  }
}
