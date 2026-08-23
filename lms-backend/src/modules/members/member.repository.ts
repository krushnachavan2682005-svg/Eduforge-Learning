import { Op, Transaction } from "sequelize";
import { sequelize } from "../../config/database";
import { hashPassword } from "../../utils/password";
import { Organization } from "../organizations/organization.model";
import { OrganizationUser, OrganizationUserRole } from "../roles/role.model";
import { Permission } from "../rbac/permission.model";
import { Role } from "../rbac/role.model";
import { UserRole } from "../rbac/user-role.model";
import { Student } from "../students/student.model";
import { User } from "../users/user.model";

export type MemberRoleCode =
  | "teacher"
  | "student"
  | "organization_admin"
  | "reviewer";

export interface CreateMemberInput {
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  role: "teacher" | "student";
  password: string;
}

export interface ListMembersInput {
  organization_id: string;
  search?: string;
  role?: string;
  active?: boolean;
  page: number;
  limit: number;
}

export class MemberRepository {
  async createMember(input: CreateMemberInput) {
    return sequelize.transaction(async (transaction) => {
      const email = input.email.trim().toLowerCase();
      let user = await User.findOne({ where: { email }, transaction });

      if (!user) {
        user = await User.create(
          {
            first_name: input.first_name.trim(),
            last_name: input.last_name.trim(),
            email,
            password_hash: await hashPassword(input.password),
            organization_id: input.organization_id,
          },
          { transaction },
        );
      } else {
        const existingMembership = await OrganizationUser.findOne({
          where: {
            organization_id: input.organization_id,
            user_id: user.id,
          },
          transaction,
        });

        if (existingMembership) {
          const error = new Error("User already belongs to this organization");
          (error as any).statusCode = 409;
          throw error;
        }

        const activeMembershipCount = await OrganizationUser.count({
          where: { user_id: user.id, is_active: true },
          transaction,
        });

        if (!user.password_hash || activeMembershipCount === 0) {
          await user.update(
            { password_hash: await hashPassword(input.password) },
            { transaction },
          );
        }
      }

      await OrganizationUser.create(
        {
          organization_id: input.organization_id,
          user_id: user.id,
          role: this.toOrganizationRole(input.role),
          is_active: true,
        },
        { transaction },
      );

      const role = await this.findRoleByCode(
        input.role,
        input.organization_id,
        transaction,
      );
      if (!role) {
        const error = new Error(`Role '${input.role}' was not found`);
        (error as any).statusCode = 404;
        throw error;
      }

      await UserRole.findOrCreate({
        where: {
          organization_id: input.organization_id,
          user_id: user.id,
          role_id: role.id,
        },
        defaults: {
          organization_id: input.organization_id,
          user_id: user.id,
          role_id: role.id,
        },
        transaction,
      });

      if (input.role === "student") {
        await Student.findOrCreate({
          where: {
            organization_id: input.organization_id,
            user_id: user.id,
          },
          defaults: {
            organization_id: input.organization_id,
            user_id: user.id,
            first_name: input.first_name.trim(),
            last_name: input.last_name.trim(),
            email,
            phone: input.phone || null,
            status: "active",
          },
          transaction,
        });
      }

      return { user };
    });
  }

  async listMembers(input: ListMembersInput) {
    const offset = (input.page - 1) * input.limit;
    const userWhere: any = {};

    if (input.search) {
      const search = `%${input.search.trim()}%`;
      userWhere[Op.or] = [
        { first_name: { [Op.iLike]: search } },
        { last_name: { [Op.iLike]: search } },
        { email: { [Op.iLike]: search } },
      ];
    }

    if (typeof input.active === "boolean") {
      userWhere.is_active = input.active;
    }

    const memberships = await OrganizationUser.findAndCountAll({
      where: {
        organization_id: input.organization_id,
      },
      include: [
        { model: User, as: "user", where: userWhere },
        { model: Organization, as: "organization" },
      ],
      order: [["created_at", "DESC"]],
      limit: input.limit,
      offset,
      distinct: true,
    });

    const userIds = memberships.rows.map((membership) => membership.user_id);
    const rolesByUser = await this.getRolesByUserIds(
      input.organization_id,
      userIds,
    );

    let items = memberships.rows.map((membership: any) =>
      this.serializeMember(membership, rolesByUser[membership.user_id] || []),
    );

    if (input.role) {
      items = items.filter((item) =>
        item.roles.some((role: any) => role.code === input.role),
      );
    }

    return {
      items,
      pagination: {
        page: input.page,
        limit: input.limit,
        total: input.role ? items.length : memberships.count,
        totalPages: Math.ceil(
          (input.role ? items.length : memberships.count) / input.limit,
        ),
      },
    };
  }

  async getMemberById(organizationId: string, userId: string) {
    const membership = await OrganizationUser.findOne({
      where: { organization_id: organizationId, user_id: userId },
      include: [
        { model: User, as: "user" },
        { model: Organization, as: "organization" },
      ],
    });

    if (!membership) return null;

    const rolesByUser = await this.getRolesByUserIds(organizationId, [userId]);
    return this.serializeMember(membership as any, rolesByUser[userId] || []);
  }

  async updateMember(
    organizationId: string,
    userId: string,
    data: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string | null;
      is_active?: boolean;
    },
  ) {
    return sequelize.transaction(async (transaction) => {
      const membership = await OrganizationUser.findOne({
        where: { organization_id: organizationId, user_id: userId },
        include: [{ model: User, as: "user" }],
        transaction,
      });

      if (!membership) return null;

      const user = (membership as any).user as User;
      await user.update(
        {
          ...(data.first_name !== undefined
            ? { first_name: data.first_name.trim() }
            : {}),
          ...(data.last_name !== undefined
            ? { last_name: data.last_name.trim() }
            : {}),
          ...(data.email !== undefined
            ? { email: data.email.trim().toLowerCase() }
            : {}),
          ...(data.is_active !== undefined
            ? { is_active: data.is_active }
            : {}),
        },
        { transaction },
      );

      await membership.update(
        {
          ...(data.is_active !== undefined
            ? { is_active: data.is_active }
            : {}),
        },
        { transaction },
      );

      const student = await Student.findOne({
        where: { organization_id: organizationId, user_id: userId },
        transaction,
      });

      if (student) {
        await student.update(
          {
            ...(data.first_name !== undefined
              ? { first_name: data.first_name.trim() }
              : {}),
            ...(data.last_name !== undefined
              ? { last_name: data.last_name.trim() }
              : {}),
            ...(data.email !== undefined
              ? { email: data.email.trim().toLowerCase() }
              : {}),
            ...(data.phone !== undefined ? { phone: data.phone } : {}),
            ...(data.is_active !== undefined
              ? { status: data.is_active ? "active" : "inactive" }
              : {}),
          },
          { transaction },
        );
      }

      return this.getMemberById(organizationId, userId);
    });
  }

  async deactivateMember(organizationId: string, userId: string) {
    return this.updateMember(organizationId, userId, { is_active: false });
  }

  async updatePassword(
    organizationId: string,
    userId: string,
    password: string,
  ) {
    const membership = await OrganizationUser.findOne({
      where: { organization_id: organizationId, user_id: userId },
      include: [{ model: User, as: "user" }],
    });

    if (!membership) return null;

    const user = (membership as any).user as User;
    await user.update({ password_hash: await hashPassword(password) });

    return true;
  }

  async assignRole(organizationId: string, userId: string, roleCode: string) {
    const member = await this.getMemberById(organizationId, userId);
    if (!member) return null;

    const role = await this.findRoleByCode(roleCode, organizationId);
    if (!role) {
      const error = new Error(`Role '${roleCode}' was not found`);
      (error as any).statusCode = 404;
      throw error;
    }

    await UserRole.findOrCreate({
      where: {
        organization_id: organizationId,
        user_id: userId,
        role_id: role.id,
      },
      defaults: {
        organization_id: organizationId,
        user_id: userId,
        role_id: role.id,
      },
    });

    await OrganizationUser.update(
      { role: this.toOrganizationRole(role.code as MemberRoleCode) },
      { where: { organization_id: organizationId, user_id: userId } },
    );

    return this.getMemberById(organizationId, userId);
  }

  async removeRole(organizationId: string, userId: string, roleId: string) {
    const member = await this.getMemberById(organizationId, userId);
    if (!member) return null;

    const deleted = await UserRole.destroy({
      where: {
        organization_id: organizationId,
        user_id: userId,
        role_id: roleId,
      },
    });

    return { deleted };
  }

  async listRoles(organizationId: string) {
    return Role.findAll({
      where: {
        [Op.or]: [
          { organization_id: organizationId },
          { organization_id: null },
        ],
      },
      order: [
        ["is_system_role", "DESC"],
        ["name", "ASC"],
      ],
    });
  }

  async listPermissions() {
    return Permission.findAll({ order: [["code", "ASC"]] });
  }

  private async findRoleByCode(
    code: string,
    organizationId: string,
    transaction?: Transaction,
  ) {
    return Role.findOne({
      where: {
        code: code.trim().toLowerCase(),
        [Op.or]: [
          { organization_id: organizationId },
          { organization_id: null },
        ],
      },
      order: [["organization_id", "DESC"]],
      transaction,
    });
  }

  private async getRolesByUserIds(organizationId: string, userIds: string[]) {
    if (!userIds.length) return {};

    const mappings = await UserRole.findAll({
      where: { organization_id: organizationId, user_id: { [Op.in]: userIds } },
      include: [{ model: Role, as: "role" }],
    });

    return mappings.reduce((acc: Record<string, any[]>, mapping: any) => {
      if (!acc[mapping.user_id]) acc[mapping.user_id] = [];
      if (mapping.role) {
        acc[mapping.user_id].push({
          id: mapping.role.id,
          code: mapping.role.code,
          name: mapping.role.name,
          description: mapping.role.description,
          is_system_role: mapping.role.is_system_role,
        });
      }
      return acc;
    }, {});
  }

  private serializeMember(membership: any, roles: any[]) {
    const user = membership.user;
    const organization = membership.organization;
    return {
      id: user.id,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      roles,
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
          }
        : null,
      membership: {
        id: membership.id,
        role: membership.role,
        is_active: membership.is_active,
        created_at: membership.created_at,
        updated_at: membership.updated_at,
      },
      status: user.is_active && membership.is_active ? "active" : "inactive",
      created_at: membership.created_at,
    };
  }

  private toOrganizationRole(role: MemberRoleCode): OrganizationUserRole {
    if (role === "student") return "student";
    if (role === "teacher" || role === "reviewer") return "tutor";
    return "admin";
  }
}
