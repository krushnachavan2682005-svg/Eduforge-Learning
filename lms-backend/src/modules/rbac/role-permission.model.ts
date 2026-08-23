import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";
import { Permission } from "./permission.model";
import { Role } from "./role.model";

export interface RolePermissionAttributes {
  id: string;
  role_id: string;
  permission_id: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface RolePermissionCreationAttributes extends Optional<
  RolePermissionAttributes,
  "id" | "created_at" | "updated_at"
> {}

export class RolePermission
  extends Model<RolePermissionAttributes, RolePermissionCreationAttributes>
  implements RolePermissionAttributes
{
  public id!: string;
  public role_id!: string;
  public permission_id!: string;
  public created_at?: Date;
  public updated_at?: Date;
}

RolePermission.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    role_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "roles", key: "id" },
    },
    permission_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "permissions", key: "id" },
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
    tableName: "role_permissions",
    timestamps: false,
    indexes: [
      { unique: true, fields: ["role_id", "permission_id"] },
      { fields: ["permission_id"] },
    ],
    hooks: {
      beforeUpdate: (mapping) => {
        mapping.updated_at = new Date();
      },
    },
  },
);

Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: "role_id",
  otherKey: "permission_id",
  as: "permissions",
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: "permission_id",
  otherKey: "role_id",
  as: "roles",
});
RolePermission.belongsTo(Role, { foreignKey: "role_id", as: "role" });
RolePermission.belongsTo(Permission, {
  foreignKey: "permission_id",
  as: "permission",
});
