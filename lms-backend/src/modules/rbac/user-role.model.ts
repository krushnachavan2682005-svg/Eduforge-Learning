import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";
import { Organization } from "../organizations/organization.model";
import { User } from "../users/user.model";
import { Role } from "./role.model";

export interface UserRoleAttributes {
  id: string;
  user_id: string;
  role_id: string;
  organization_id: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface UserRoleCreationAttributes
  extends Optional<UserRoleAttributes, "id" | "created_at" | "updated_at"> {}

export class UserRole
  extends Model<UserRoleAttributes, UserRoleCreationAttributes>
  implements UserRoleAttributes
{
  public id!: string;
  public user_id!: string;
  public role_id!: string;
  public organization_id!: string;
  public created_at?: Date;
  public updated_at?: Date;
}

UserRole.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    role_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "roles", key: "id" },
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "organizations", key: "id" },
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
    tableName: "user_roles",
    timestamps: false,
    indexes: [
      { unique: true, fields: ["organization_id", "user_id", "role_id"] },
      { fields: ["user_id"] },
      { fields: ["role_id"] },
    ],
    hooks: {
      beforeUpdate: (mapping) => {
        mapping.updated_at = new Date();
      },
    },
  },
);

User.belongsToMany(Role, {
  through: UserRole,
  foreignKey: "user_id",
  otherKey: "role_id",
  as: "rbac_roles",
});
Role.belongsToMany(User, {
  through: UserRole,
  foreignKey: "role_id",
  otherKey: "user_id",
  as: "users",
});
Organization.hasMany(UserRole, { foreignKey: "organization_id", as: "user_roles" });
UserRole.belongsTo(Organization, { foreignKey: "organization_id", as: "organization" });
UserRole.belongsTo(User, { foreignKey: "user_id", as: "user" });
UserRole.belongsTo(Role, { foreignKey: "role_id", as: "role" });
