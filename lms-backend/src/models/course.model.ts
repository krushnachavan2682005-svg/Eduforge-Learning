import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/database";
import { convertEmptyStringsToNull } from "../db/hooks/convert_empty_strings_to_null";
import { beforeSave } from "../db/hooks/time_format_hook";
import { uniqueTitleCheckHook } from "../db/hooks/unique_title";
import { lesson } from "./lesson.model";
import { User } from "../modules/users/user.model";
export interface ModelWithId extends Model {
  id: string | number;
}

export class Course extends Model implements ModelWithId {
  public id!: string;
  //   public instructor_id!: number;
  //   public subcategory_id!: number;
  public tags?: string[];
  public title!: string;
  public description?: string;
  public language?: string;
  public price?: number;
  public level!: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  public thumbnail_url?: string;
  public is_published?: boolean;
  public client_id!: string;
  public created_at?: Date;
  public updated_at?: Date;
}

Course.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    language: { type: DataTypes.STRING(50) },
    price: { type: DataTypes.DECIMAL(10, 2) },
    level: {
      type: DataTypes.ENUM("BEGINNER", "INTERMEDIATE", "ADVANCED"),
      allowNull: false,
    },
    thumbnail_url: { type: DataTypes.TEXT },
    is_published: { type: DataTypes.BOOLEAN, defaultValue: false },
    client_id: { type: DataTypes.UUID, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "courses",
    timestamps: false,
    hooks: {
      beforeValidate: (instance) => {
        convertEmptyStringsToNull(instance);
      },
      beforeSave: (instance) => {
        beforeSave(instance);
      },
      beforeCreate: uniqueTitleCheckHook({
        uniqueTitle: ["title", "client_id"],
        errorMessage: "Course with this title already exists",
        caseInsensitive: true,
      }),
      beforeUpdate: uniqueTitleCheckHook({
        uniqueTitle: ["title", "client_id"],
        errorMessage: "Course with this title already exists",
        caseInsensitive: true,
      }),
    },
  }
);
Course.hasMany(lesson, { foreignKey: "course_id" });