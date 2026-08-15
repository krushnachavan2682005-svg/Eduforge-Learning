import { Model, DataTypes } from "sequelize";
import { sequelize } from "../config/database";
import { Course } from "./course.model";

export class AssignedCourseModel extends Model {
  public id!: string;
  public course_id!: string[];
  public class_id!: string;
  public user_id!: string[];
  public organization_id!: string;
}

AssignedCourseModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    course_id: { type: DataTypes.ARRAY(DataTypes.UUID), allowNull: false },
    class_id: { type: DataTypes.UUID, allowNull: true },
    user_id: { type: DataTypes.ARRAY(DataTypes.UUID), allowNull: false },
    organization_id: { type: DataTypes.UUID, allowNull: false,
    },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "course_user_mapping",
    timestamps: false,
  }
);

AssignedCourseModel.belongsTo(Course, { foreignKey: "course_id" });
