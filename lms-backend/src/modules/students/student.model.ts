import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";
import { Organization } from "../organizations/organization.model";
import { User } from "../users/user.model";

export type StudentStatus = "active" | "inactive";

export interface StudentAttributes {
  id: string;
  user_id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  status: StudentStatus;
  created_at?: Date;
  updated_at?: Date;
}

export interface StudentCreationAttributes
  extends Optional<StudentAttributes, "id" | "phone" | "status" | "created_at" | "updated_at"> {}

export class Student
  extends Model<StudentAttributes, StudentCreationAttributes>
  implements StudentAttributes
{
  public id!: string;
  public user_id!: string;
  public organization_id!: string;
  public first_name!: string;
  public last_name!: string;
  public email!: string;
  public phone?: string | null;
  public status!: StudentStatus;
  public created_at?: Date;
  public updated_at?: Date;
}

Student.init(
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
    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "organizations", key: "id" },
    },
    first_name: { type: DataTypes.STRING(100), allowNull: false },
    last_name: { type: DataTypes.STRING(100), allowNull: false },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { isEmail: true },
    },
    phone: { type: DataTypes.STRING(32), allowNull: true },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "students",
    timestamps: false,
    indexes: [
      { unique: true, fields: ["organization_id", "email"] },
      { fields: ["organization_id"] },
      { fields: ["user_id"] },
    ],
    hooks: {
      beforeValidate: (student) => {
        if (student.email) student.email = student.email.trim().toLowerCase();
      },
      beforeUpdate: (student) => {
        student.updated_at = new Date();
      },
    },
  },
);

User.hasMany(Student, { foreignKey: "user_id", as: "student_profiles" });
Student.belongsTo(User, { foreignKey: "user_id", as: "user" });
Organization.hasMany(Student, { foreignKey: "organization_id", as: "students" });
Student.belongsTo(Organization, { foreignKey: "organization_id", as: "organization" });
