import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";
import { convertEmptyStringsToNull } from "../../db/hooks/convert_empty_strings_to_null";
import { beforeSave } from "../../db/hooks/time_format_hook";
import {
  ActionItemsInterface,
  ReviewerObject,
} from "./actionItems.interface";
interface ActionItemsCreationAttributes
  extends Optional<ActionItemsInterface, "id" | "created_at" | "updated_at"> {}
export class ActionItems
  extends Model<ActionItemsInterface, ActionItemsCreationAttributes>
  implements ActionItemsInterface
{
  public id?: string;
  public organization_id!: string;
  public task_name?: string;
  public total_score?: string;
  public description?: string;
  public level?: string;
  public reviewer?: ReviewerObject[];
  public created_at?: Date;
  public updated_at?: Date;
  public pdf_attachment?: string;
}

ActionItems.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    organization_id: { type: DataTypes.UUID, allowNull: false,
    },
    task_name: { type: DataTypes.STRING, allowNull: false },
    total_score: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    level: { type: DataTypes.STRING },
    pdf_attachment: { type: DataTypes.STRING },
    reviewer: { type: DataTypes.JSON, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },

  {
    sequelize,
    tableName: "action_items",
    timestamps: false,
    indexes: [{ unique: true, fields: ["task_name", "organization_id"] }],
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
