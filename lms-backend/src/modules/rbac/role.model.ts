import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";
import { Organization } from "../organizations/organization.model";

export interface RoleAttributes {
  id: string;
  organization_id?: string | null;
  code: string;
  name: string;
  description?: string | null;
  is_system_role: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface RoleCreationAttributes
  extends Optional<RoleAttributes, "id" | "organization_id" | "description" | "is_system_role" | "created_at" | "updated_at"> {}

export class Role
  extends Model<RoleAttributes, RoleCreationAttributes>
  implements RoleAttributes
{
  public id!: string;
  public organization_id?: string | null;
  public code!: string;
  public name!: string;
  public description?: string | null;
  public is_system_role!: boolean;
  public created_at?: Date;
  public updated_at?: Date;
}

Role.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "organizations", key: "id" },
    },
    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_system_role: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    tableName: "roles",
    timestamps: false,
    indexes: [
      { unique: true, fields: ["organization_id", "code"] },
      { fields: ["code"] },
      { fields: ["organization_id"] },
    ],
    hooks: {
      beforeValidate: (role) => {
        if (role.code) role.code = role.code.trim().toLowerCase();
      },
      beforeUpdate: (role) => {
        role.updated_at = new Date();
      },
    },
  },
);

Organization.hasMany(Role, { foreignKey: "organization_id", as: "rbac_roles" });
Role.belongsTo(Organization, { foreignKey: "organization_id", as: "organization" });
