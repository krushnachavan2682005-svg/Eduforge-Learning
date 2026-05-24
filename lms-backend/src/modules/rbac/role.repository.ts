import { Op } from "sequelize";
import { Permission } from "./permission.model";
import { RolePermission } from "./role-permission.model";
import { Role } from "./role.model";
import { UserRole } from "./user-role.model";

export class RoleRepository {
  async findRoleByCode(code: string, organizationId?: string | null) {
    return Role.findOne({
      where: {
        code: code.trim().toLowerCase(),
        [Op.or]: [
          { organization_id: organizationId || null },
          { organization_id: null },
        ],
      },
      order: [["organization_id", "DESC"]],
    });
  }

  async findOrCreateRole(input: {
    code: string;
    name: string;
    description?: string | null;
    organization_id?: string | null;
    is_system_role?: boolean;
  }) {
    const [role] = await Role.findOrCreate({
      where: {
        code: input.code.trim().toLowerCase(),
        organization_id: input.organization_id || null,
      },
      defaults: {
        code: input.code.trim().toLowerCase(),
        name: input.name,
        description: input.description || null,
        organization_id: input.organization_id || null,
        is_system_role: Boolean(input.is_system_role),
      },
    });

    return role;
  }

  async assignPermission(roleId: string, permissionId: string) {
    const [mapping] = await RolePermission.findOrCreate({
      where: { role_id: roleId, permission_id: permissionId },
      defaults: { role_id: roleId, permission_id: permissionId },
    });

    return mapping;
  }

  async assignRoleToUser(input: {
    user_id: string;
    role_id: string;
    organization_id: string;
  }) {
    const [mapping] = await UserRole.findOrCreate({
      where: {
        user_id: input.user_id,
        role_id: input.role_id,
        organization_id: input.organization_id,
      },
      defaults: input,
    });

    return mapping;
  }

  async getUserRoles(userId: string, organizationId: string) {
    return UserRole.findAll({
      where: { user_id: userId, organization_id: organizationId },
      include: [{ model: Role, as: "role" }],
    });
  }

  async getUserPermissions(userId: string, organizationId: string) {
    const roles = await UserRole.findAll({
      where: { user_id: userId, organization_id: organizationId },
      include: [
        {
          model: Role,
          as: "role",
          include: [{ model: Permission, as: "permissions" }],
        },
      ],
    });

    return roles.flatMap((mapping: any) => mapping.role?.permissions || []);
  }
}
