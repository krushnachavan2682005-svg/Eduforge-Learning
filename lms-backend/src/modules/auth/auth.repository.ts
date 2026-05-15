import { randomUUID } from "crypto";
import { Transaction } from "sequelize";
import { sequelize } from "../../config/database";
import { Organization } from "../organizations/organization.model";
import { OrganizationUser } from "../roles/role.model";
import { Session } from "../sessions/session.model";
import { User } from "../users/user.model";

export interface CreateLocalAccountInput {
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  organization_name: string;
}

export interface SessionInput {
  user_id: string;
  refresh_token: string;
  expires_at: Date;
  user_agent?: string | null;
  ip_address?: string | null;
}

export class AuthRepository {
  async createLocalAccount(input: CreateLocalAccountInput) {
    return sequelize.transaction(async (transaction) => {
      const user = await User.create(
        {
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email,
          password_hash: input.password_hash,
        },
        { transaction },
      );

      const organization = await this.createOrganizationWithUniqueSlug(
        input.organization_name,
        transaction,
      );

      const membership = await OrganizationUser.create(
        {
          organization_id: organization.id,
          user_id: user.id,
          role: "owner",
        },
        { transaction },
      );

      return { user, organization, membership };
    });
  }

  async findActiveUserByEmail(email: string) {
    return User.findOne({
      where: { email: email.trim().toLowerCase(), is_active: true },
    });
  }

  async findPrimaryMembership(userId: string) {
    return OrganizationUser.findOne({
      where: { user_id: userId, is_active: true },
      include: [{ model: Organization, as: "organization", where: { is_active: true } }],
      order: [["created_at", "ASC"]],
    });
  }

  async findUserContext(userId: string, organizationId?: string) {
    const membership = await OrganizationUser.findOne({
      where: {
        user_id: userId,
        is_active: true,
        ...(organizationId ? { organization_id: organizationId } : {}),
      },
      include: [
        { model: User, as: "user", where: { is_active: true } },
        { model: Organization, as: "organization", where: { is_active: true } },
      ],
      order: [["created_at", "ASC"]],
    });

    return membership;
  }

  async createSession(input: SessionInput) {
    return Session.create(input);
  }

  private async createOrganizationWithUniqueSlug(
    name: string,
    transaction: Transaction,
  ) {
    const baseSlug = this.slugify(name);
    let slug = baseSlug;
    let suffix = 1;

    while (await Organization.findOne({ where: { slug }, transaction })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    return Organization.create({ name, slug }, { transaction });
  }

  private slugify(value: string) {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return slug || `organization-${randomUUID()}`;
  }
}
