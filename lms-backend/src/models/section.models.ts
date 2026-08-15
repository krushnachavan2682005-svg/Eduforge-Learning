import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/database";
import { convertEmptyStringsToNull } from "../db/hooks/convert_empty_strings_to_null";
import { beforeSave } from "../db/hooks/time_format_hook";
import { Course } from "../models/course.model";
import { lesson } from "./lesson.model";
import { uniqueTitleCheckHook } from "../db/hooks/unique_title";

// Define an interface that guarantees an id property
export interface ModelWithId extends Model {
  id: string | number;
}

export class Section extends Model implements ModelWithId {
  public id!: string;
  public title!: string;
  public seq_no!: number;
  public course_id!: string;
  public lesson_id!: string;
  public content_type?: any;
  public quizzes?: any;
  public organization_id!: string;
  public created_at?: Date;
  public updated_at?: Date;
}

Section.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    seq_no: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    duration: {
      type: DataTypes.STRING(255),
    },
    content_type: {
      type: DataTypes.JSON,
    },
    quizzes: {
      type: DataTypes.JSON,
    },
    course_id: {
      type: DataTypes.UUID,
      references: { model: "courses", key: "id" },
      allowNull: false,
    },
    lesson_id: {
      type: DataTypes.UUID,
      references: { model: "lessons", key: "id" },
      allowNull: false,
    },
    organization_id: { type: DataTypes.UUID, allowNull: false,
    },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "sections",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    hooks: {
      beforeValidate: async (instance: any) => {
        convertEmptyStringsToNull(instance);
        if (instance.isNewRecord && instance.lesson_id) {
          const maxSection = await Section.findOne({
            where: { lesson_id: instance.lesson_id },
            order: [["seq_no", "DESC"]],
          });

          instance.seq_no = maxSection ? maxSection.seq_no + 1 : 1;
        }
      },
      beforeSave: (instance: any) => {
        if (!instance.isNewRecord && instance.changed("seq_no")) {
          throw new Error("seq_no cannot be updated once generated");
        }
        beforeSave(instance);
      },
      beforeCreate: uniqueTitleCheckHook({
        uniqueTitle: ["title", "organization_id", "course_id"],
        errorMessage: "Section with this title already exists",
        caseInsensitive: true,
      }),
    },
  }
);

Section.belongsTo(Course, { foreignKey: "course_id" });
Section.belongsTo(lesson, { foreignKey: "lesson_id" });
