import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/database";
import { convertEmptyStringsToNull } from "../db/hooks/convert_empty_strings_to_null";
import { beforeSave } from "../db/hooks/time_format_hook";

export class Quiz extends Model {
  public id!: string;
  public lesson_id!: string;
  public question!: string;
  public options!: string[];
  public correct_answer!: string | null;
}

Quiz.init(
  {
    id: {
      type: DataTypes.STRING,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    lesson_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    question: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    options: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    correct_answer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    client_id: { type: DataTypes.UUID, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "quizzes",
    timestamps: false,
    hooks: {
      beforeValidate: (instance) => {
        convertEmptyStringsToNull(instance);
      },
      beforeSave: (instance) => {
        beforeSave(instance);
      },
    },
  }
);
