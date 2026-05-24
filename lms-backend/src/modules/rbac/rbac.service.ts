import { createHash } from "crypto";
import { PermissionRepository } from "./permission.repository";
import { RoleRepository } from "./role.repository";

export class RbacService {
  constructor(
    private readonly roleRepository = new RoleRepository(),
    private readonly permissionRepository = new PermissionRepository(),
  ) {}

  async assignRoleToUser(input: {
    user_id: string;
    organization_id: string;
    role_code: string;
  }) {
    const role = await this.roleRepository.findRoleByCode(
      input.role_code,
      input.organization_id,
    );

    if (!role) {
      const error = new Error(`Role '${input.role_code}' was not found`);
      (error as any).statusCode = 404;
      throw error;
    }

    return this.roleRepository.assignRoleToUser({
      user_id: input.user_id,
      organization_id: input.organization_id,
      role_id: role.id,
    });
  }

  async getUserRoles(userId: string, organizationId: string) {
    const mappings = await this.roleRepository.getUserRoles(userId, organizationId);
    return mappings.map((mapping: any) => mapping.role).filter(Boolean);
  }

  async getUserRoleIds(userId: string, organizationId: string) {
    const roles = await this.getUserRoles(userId, organizationId);
    return roles.map((role: any) => role.id);
  }

  async getUserPermissions(userId: string, organizationId: string) {
    const permissions = await this.roleRepository.getUserPermissions(
      userId,
      organizationId,
    );

    const unique = new Map<string, any>();
    permissions.forEach((permission: any) => {
      if (permission?.code) unique.set(permission.code, permission);
    });

    return Array.from(unique.values()).sort((a, b) =>
      a.code.localeCompare(b.code),
    );
  }

  async hasPermission(userId: string, organizationId: string, code: string) {
    const permission = await this.permissionRepository.findByCode(code);
    if (!permission) return false;

    const permissions = await this.getUserPermissions(userId, organizationId);
    return permissions.some((item: any) => item.code === permission.code);
  }

  async hasRole(userId: string, organizationId: string, code: string) {
    const roles = await this.getUserRoles(userId, organizationId);
    return roles.some((role: any) => role.code === code.trim().toLowerCase());
  }

  async getPermissionsVersion(userId: string, organizationId: string) {
    const [roles, permissions] = await Promise.all([
      this.getUserRoles(userId, organizationId),
      this.getUserPermissions(userId, organizationId),
    ]);
    const material = JSON.stringify({
      roles: roles.map((role: any) => role.id).sort(),
      permissions: permissions.map((permission: any) => permission.code).sort(),
    });

    return createHash("sha256").update(material).digest("hex").slice(0, 16);
  }
}
