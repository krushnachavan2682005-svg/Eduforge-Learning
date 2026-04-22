import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/database";
export class AssignedCourseModel extends Model {
  public id!: string;
  public course_id!: string;
  public section_id!: string;
  public lesson_id!: string;
  public client_id!: string;
  public user_id!: string;
  public is_completed!: boolean;
}

const CompletedAssignCourse = sequelize.define(
  "section_user_mapping",
  {
    course_id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    section_id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    lesson_id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    client_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    is_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_quiz_answers: {
      type: DataTypes.JSONB,
      defaultValue: [], 
    },
  },
  {
    tableName: "section_user_mapping",
    timestamps: false,
  }
);

export default CompletedAssignCourse;
