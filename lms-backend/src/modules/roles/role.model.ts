import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";
import { Organization } from "../organizations/organization.model";
import { User } from "../users/user.model";

export type OrganizationUserRole = "owner" | "admin" | "tutor" | "student";

export interface OrganizationUserAttributes {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationUserRole;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface OrganizationUserCreationAttributes extends Optional<
  OrganizationUserAttributes,
  "id" | "is_active" | "created_at" | "updated_at"
> {}

export class OrganizationUser
  extends Model<OrganizationUserAttributes, OrganizationUserCreationAttributes>
  implements OrganizationUserAttributes
{
  public id!: string;
  public organization_id!: string;
  public user_id!: string;
  public role!: OrganizationUserRole;
  public is_active!: boolean;
  public created_at?: Date;
  public updated_at?: Date;
}

OrganizationUser.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "organizations", key: "id" },
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    role: {
      type: DataTypes.ENUM("owner", "admin", "tutor", "student"),
      allowNull: false,
      defaultValue: "owner",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "organization_users",
    timestamps: false,
    indexes: [
      { unique: true, fields: ["organization_id", "user_id"] },
      { fields: ["user_id"] },
      { fields: ["organization_id"] },
    ],
    hooks: {
      beforeUpdate: (membership) => {
        membership.updated_at = new Date();
      },
    },
  },
);

User.hasMany(OrganizationUser, { foreignKey: "user_id", as: "memberships" });
OrganizationUser.belongsTo(User, { foreignKey: "user_id", as: "user" });

Organization.hasMany(OrganizationUser, {
  foreignKey: "organization_id",
  as: "memberships",
});
OrganizationUser.belongsTo(Organization, {
  foreignKey: "organization_id",
  as: "organization",
});

User.belongsTo(Organization, {
  foreignKey: "organization_id",
  as: "organization",
});
Organization.hasMany(User, { foreignKey: "organization_id", as: "users" });
