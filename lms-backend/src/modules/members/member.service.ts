import { MemberRepository } from "./member.repository";

export class MemberService {
  constructor(private readonly repository = new MemberRepository()) {}

  async createMember(
    organizationId: string,
    input: {
      first_name: string;
      last_name: string;
      email: string;
      phone?: string | null;
      role: "teacher" | "student";
      password: string;
      confirm_password?: string;
    },
  ) {
    this.validatePassword(input.password, input.confirm_password);

    const created = await this.repository.createMember({
      organization_id: organizationId,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      phone: input.phone,
      role: input.role,
      password: input.password,
    });

    return this.repository.getMemberById(organizationId, created.user.id);
  }

  async listMembers(
    organizationId: string,
    query: {
      search?: string;
      role?: string;
      active?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 10), 1), 100);
    const active =
      query.active === "true"
        ? true
        : query.active === "false"
          ? false
          : undefined;

    return this.repository.listMembers({
      organization_id: organizationId,
      search: query.search,
      role: query.role,
      active,
      page,
      limit,
    });
  }

  getMember(organizationId: string, userId: string) {
    return this.repository.getMemberById(organizationId, userId);
  }

  updateMember(
    organizationId: string,
    userId: string,
    input: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string | null;
      is_active?: boolean;
    },
  ) {
    return this.repository.updateMember(organizationId, userId, input);
  }

  deactivateMember(organizationId: string, userId: string) {
    return this.repository.deactivateMember(organizationId, userId);
  }

  async resetPassword(
    organizationId: string,
    userId: string,
    input: { password: string; confirm_password?: string },
  ) {
    this.validatePassword(input.password, input.confirm_password);
    return this.repository.updatePassword(
      organizationId,
      userId,
      input.password,
    );
  }

  assignRole(organizationId: string, userId: string, roleCode: string) {
    return this.repository.assignRole(organizationId, userId, roleCode);
  }

  removeRole(organizationId: string, userId: string, roleId: string) {
    return this.repository.removeRole(organizationId, userId, roleId);
  }

  listRoles(organizationId: string) {
    return this.repository.listRoles(organizationId);
  }

  listPermissions() {
    return this.repository.listPermissions();
  }

  private validatePassword(password?: string, confirmPassword?: string) {
    if (!password) {
      const error = new Error("Password is required");
      (error as any).statusCode = 400;
      throw error;
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      const error = new Error("Password confirmation does not match");
      (error as any).statusCode = 400;
      throw error;
    }

    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      const error = new Error(
        "Password must be at least 8 characters and include at least one letter and one number",
      );
      (error as any).statusCode = 400;
      throw error;
    }
  }
}
