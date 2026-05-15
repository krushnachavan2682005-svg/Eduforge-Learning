import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";

export interface OrganizationAttributes {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface OrganizationCreationAttributes
  extends Optional<OrganizationAttributes, "id" | "is_active" | "created_at" | "updated_at"> {}

export class Organization
  extends Model<OrganizationAttributes, OrganizationCreationAttributes>
  implements OrganizationAttributes
{
  public id!: string;
  public name!: string;
  public slug!: string;
  public is_active!: boolean;
  public created_at?: Date;
  public updated_at?: Date;
}

Organization.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: true,
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
    tableName: "organizations",
    timestamps: false,
    indexes: [{ unique: true, fields: ["slug"] }],
    hooks: {
      beforeValidate: (organization) => {
        if (organization.slug) {
          organization.slug = organization.slug.trim().toLowerCase();
        }
      },
      beforeUpdate: (organization) => {
        organization.updated_at = new Date();
      },
    },
  },
);
