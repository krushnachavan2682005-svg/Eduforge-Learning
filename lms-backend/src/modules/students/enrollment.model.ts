import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";
import { Organization } from "../organizations/organization.model";
import { Student } from "./student.model";

export type LocalEnrollmentStatus =
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface LocalEnrollmentAttributes {
  id: string;
  organization_id: string;
  student_id: string;
  course_id: string;
  status: LocalEnrollmentStatus;
  enrolled_at: Date;
  completed_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface LocalEnrollmentCreationAttributes extends Optional<
  LocalEnrollmentAttributes,
  "id" | "status" | "enrolled_at" | "completed_at" | "created_at" | "updated_at"
> {}

export class LocalEnrollment
  extends Model<LocalEnrollmentAttributes, LocalEnrollmentCreationAttributes>
  implements LocalEnrollmentAttributes
{
  public id!: string;
  public organization_id!: string;
  public student_id!: string;
  public course_id!: string;
  public status!: LocalEnrollmentStatus;
  public enrolled_at!: Date;
  public completed_at?: Date | null;
  public created_at?: Date;
  public updated_at?: Date;
}

LocalEnrollment.init(
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
    student_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "students", key: "id" },
    },
    course_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "courses", key: "id" },
    },
    status: {
      type: DataTypes.ENUM("assigned", "in_progress", "completed", "cancelled"),
      allowNull: false,
      defaultValue: "assigned",
    },
    enrolled_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    // Compatibility note: legacy LMS already has an "enrollments" table/model.
    // This local SaaS enrollment table is isolated to avoid destructive schema churn.
    tableName: "student_enrollments",
    timestamps: false,
    indexes: [
      { unique: true, fields: ["organization_id", "student_id", "course_id"] },
      { fields: ["student_id"] },
      { fields: ["organization_id"] },
    ],
    hooks: {
      beforeUpdate: (enrollment) => {
        enrollment.updated_at = new Date();
      },
    },
  },
);

Organization.hasMany(LocalEnrollment, {
  foreignKey: "organization_id",
  as: "student_enrollments",
});
LocalEnrollment.belongsTo(Organization, {
  foreignKey: "organization_id",
  as: "organization",
});
Student.hasMany(LocalEnrollment, {
  foreignKey: "student_id",
  as: "enrollments",
});
LocalEnrollment.belongsTo(Student, { foreignKey: "student_id", as: "student" });
