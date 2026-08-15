import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/database";
import { convertEmptyStringsToNull } from "../db/hooks/convert_empty_strings_to_null";
import { beforeSave } from "../db/hooks/time_format_hook";
import { Course } from "./course.model";
import { uniqueTitleCheckHook } from "../db/hooks/unique_title";

export interface ModelWithId extends Model {
  id: string | number;
}

export class lesson extends Model implements ModelWithId {
  public id!: string;
  public title!: string;
  public section_id?: string;
  public course_id!: string;
  public seq_no!: number;
  public organization_id!: string;
  public created_at?: Date;
  public updated_at?: Date;
}

lesson.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(225),
      allowNull: false,
    },
    course_id: {
      type: DataTypes.UUID,
      references: { model: "courses", key: "id" },
      allowNull: false,
    },
    seq_no: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    organization_id: { type: DataTypes.UUID, allowNull: false,
    },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "lessons",
    timestamps: false,
    hooks: {
      beforeValidate: async (instance: any) => {
        convertEmptyStringsToNull(instance);

        if (instance.isNewRecord && instance.course_id) {
          const maxLesson = await lesson.findOne({
            where: { course_id: instance.course_id },
            order: [["seq_no", "DESC"]],
          });

          instance.seq_no = maxLesson ? maxLesson.seq_no + 1 : 1;
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
        errorMessage: "Lesson name already exists",
        caseInsensitive: true,
      }),
      beforeUpdate: uniqueTitleCheckHook({
        uniqueTitle: ["title", "organization_id", "course_id"],
        errorMessage: "Lesson name already exists",
        caseInsensitive: true,
      }),
    },
  }
);
