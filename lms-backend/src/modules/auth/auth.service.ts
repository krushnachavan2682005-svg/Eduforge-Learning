import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { AuthRepository } from "./auth.repository";
import { comparePassword, hashPassword } from "../../utils/password";
import { RbacService } from "../rbac/rbac.service";

export interface RegisterInput {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  organization_name?: string;
  user_agent?: string | null;
  ip_address?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
  user_agent?: string | null;
  ip_address?: string | null;
}

export class AuthService {
  constructor(
    private readonly authRepository = new AuthRepository(),
    private readonly rbacService = new RbacService(),
  ) {}

  async register(input: RegisterInput, fastify: FastifyInstance) {
    const email = this.normalizeEmail(input.email);
    const existing = await this.authRepository.findActiveUserByEmail(email);
    if (existing) {
      const error = new Error("User with this email already exists");
      (error as any).statusCode = 409;
      throw error;
    }

    const password_hash = await hashPassword(input.password);
    const organization_name =
      input.organization_name?.trim() ||
      `${input.first_name.trim()} ${input.last_name.trim()}`.trim() ||
      "Default Organization";

    const account = await this.authRepository.createLocalAccount({
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      email,
      password_hash,
      organization_name,
    });

    await this.rbacService.assignRoleToUser({
      user_id: account.user.id,
      organization_id: account.organization.id,
      role_code: "organization_admin",
    });

    return this.createAuthResponse(
      account.user,
      account.organization,
      account.membership.role,
      fastify,
      input.user_agent,
      input.ip_address,
    );
  }

  async login(input: LoginInput, fastify: FastifyInstance) {
    const email = this.normalizeEmail(input.email);
    const user = await this.authRepository.findActiveUserByEmail(email);
    if (!user) {
      const error = new Error("Invalid email or password");
      (error as any).statusCode = 401;
      throw error;
    }

    const validPassword = await comparePassword(input.password, user.password_hash);
    if (!validPassword) {
      const error = new Error("Invalid email or password");
      (error as any).statusCode = 401;
      throw error;
    }

    const membership = await this.authRepository.findPrimaryMembership(user.id);
    if (!membership) {
      const error = new Error("User does not belong to an active organization");
      (error as any).statusCode = 403;
      throw error;
    }

    const organization = (membership as any).organization;
    return this.createAuthResponse(
      user,
      organization,
      membership.role,
      fastify,
      input.user_agent,
      input.ip_address,
    );
  }

  async me(userId: string, organizationId: string) {
    const membership = await this.authRepository.findUserContext(userId, organizationId);
    if (!membership) {
      const error = new Error("Authenticated user was not found");
      (error as any).statusCode = 404;
      throw error;
    }

    return this.serializeUserContext(
      (membership as any).user,
      (membership as any).organization,
      membership.role,
    );
  }

  private async createAuthResponse(
    user: any,
    organization: any,
    role: string,
    fastify: FastifyInstance,
    userAgent?: string | null,
    ipAddress?: string | null,
  ) {
    const [roleIds, permissionsVersion] = await Promise.all([
      this.rbacService.getUserRoleIds(user.id, organization.id),
      this.rbacService.getPermissionsVersion(user.id, organization.id),
    ]);

    const access_token = fastify.generateAccessToken({
      sub: user.id,
      email: user.email,
      organization_id: organization.id,
      role,
      role_ids: roleIds,
      permissions_version: permissionsVersion,
    });

    const refresh_token = randomUUID();
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 30);

    await this.authRepository.createSession({
      user_id: user.id,
      refresh_token,
      expires_at,
      user_agent: userAgent,
      ip_address: ipAddress,
    });

    return {
      access_token,
      refresh_token,
      token_type: "Bearer",
      user: this.serializeUser(user),
      organization: this.serializeOrganization(organization),
      membership: { role, role_ids: roleIds },
      permissions_version: permissionsVersion,
    };
  }

  private serializeUserContext(user: any, organization: any, role: string) {
    return {
      user: this.serializeUser(user),
      organization: this.serializeOrganization(organization),
      membership: { role },
    };
  }

  private serializeUser(user: any) {
    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  private serializeOrganization(organization: any) {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      is_active: organization.is_active,
    };
  }

  private normalizeEmail(email: string) {
    return String(email || "").trim().toLowerCase();
  }
}
