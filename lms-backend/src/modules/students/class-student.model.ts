import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";
import { StudentClass } from "./class.model";
import { Student } from "./student.model";

export interface ClassStudentAttributes {
  id: string;
  class_id: string;
  student_id: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface ClassStudentCreationAttributes
  extends Optional<ClassStudentAttributes, "id" | "created_at" | "updated_at"> {}

export class ClassStudent
  extends Model<ClassStudentAttributes, ClassStudentCreationAttributes>
  implements ClassStudentAttributes
{
  public id!: string;
  public class_id!: string;
  public student_id!: string;
  public created_at?: Date;
  public updated_at?: Date;
}

ClassStudent.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    class_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "classes", key: "id" },
    },
    student_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "students", key: "id" },
    },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "class_students",
    timestamps: false,
    indexes: [
      { unique: true, fields: ["class_id", "student_id"] },
      { fields: ["student_id"] },
    ],
    hooks: {
      beforeUpdate: (classStudent) => {
        classStudent.updated_at = new Date();
      },
    },
  },
);

StudentClass.belongsToMany(Student, {
  through: ClassStudent,
  foreignKey: "class_id",
  otherKey: "student_id",
  as: "students",
});
Student.belongsToMany(StudentClass, {
  through: ClassStudent,
  foreignKey: "student_id",
  otherKey: "class_id",
  as: "classes",
});
ClassStudent.belongsTo(StudentClass, { foreignKey: "class_id", as: "class" });
ClassStudent.belongsTo(Student, { foreignKey: "student_id", as: "student" });
