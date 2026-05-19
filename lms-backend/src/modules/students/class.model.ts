import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";
import { Organization } from "../organizations/organization.model";
import { User } from "../users/user.model";

export interface StudentClassAttributes {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  created_by: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface StudentClassCreationAttributes
  extends Optional<StudentClassAttributes, "id" | "description" | "created_at" | "updated_at"> {}

export class StudentClass
  extends Model<StudentClassAttributes, StudentClassCreationAttributes>
  implements StudentClassAttributes
{
  public id!: string;
  public organization_id!: string;
  public name!: string;
  public description?: string | null;
  public created_by!: string;
  public created_at?: Date;
  public updated_at?: Date;
}

StudentClass.init(
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
    name: { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "classes",
    timestamps: false,
    indexes: [
      { unique: true, fields: ["organization_id", "name"] },
      { fields: ["organization_id"] },
    ],
    hooks: {
      beforeUpdate: (studentClass) => {
        studentClass.updated_at = new Date();
      },
    },
  },
);

Organization.hasMany(StudentClass, { foreignKey: "organization_id", as: "classes" });
StudentClass.belongsTo(Organization, { foreignKey: "organization_id", as: "organization" });
User.hasMany(StudentClass, { foreignKey: "created_by", as: "created_classes" });
StudentClass.belongsTo(User, { foreignKey: "created_by", as: "creator" });
