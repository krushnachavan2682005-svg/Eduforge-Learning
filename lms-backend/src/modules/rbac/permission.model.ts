import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";

export interface PermissionAttributes {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface PermissionCreationAttributes
  extends Optional<PermissionAttributes, "id" | "description" | "created_at" | "updated_at"> {}

export class Permission
  extends Model<PermissionAttributes, PermissionCreationAttributes>
  implements PermissionAttributes
{
  public id!: string;
  public code!: string;
  public name!: string;
  public description?: string | null;
  public created_at?: Date;
  public updated_at?: Date;
}

Permission.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: "permissions",
    timestamps: false,
    indexes: [{ unique: true, fields: ["code"] }],
    hooks: {
      beforeValidate: (permission) => {
        if (permission.code) permission.code = permission.code.trim().toUpperCase();
      },
      beforeUpdate: (permission) => {
        permission.updated_at = new Date();
      },
    },
  },
);
