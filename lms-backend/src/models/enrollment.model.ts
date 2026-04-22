import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/database";
import { convertEmptyStringsToNull } from "../db/hooks/convert_empty_strings_to_null";
import { beforeSave } from "../db/hooks/time_format_hook";

export class Enrollment extends Model {
  public id!: string;
  public user_id!: string;
  public course_id!: string;
  public enrolled_at!: string;
}

Enrollment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    course_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    enrolled_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    client_id: { type: DataTypes.UUID, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "enrollments",
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
