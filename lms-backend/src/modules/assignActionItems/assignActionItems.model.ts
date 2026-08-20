import { Model, DataTypes } from "sequelize";
import { sequelize } from "../../config/database";

export class AssignedActionItemsModel extends Model {
  public id!: string;
  public action_item_id!: string[];
  public status!: "ASSIGNED" | "SUBMITTED" | "APPROVED" | "REJECTED";
  public class_id!: string | null;
  public user_id!: string[];
  public organization_id!: string;
  public attachment!: string[] | null;
  public comment!: string | null;
  public score!: number | null;
  public notes!: string | null;
}

AssignedActionItemsModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    action_item_id: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
    },

    class_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    user_id: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
    },

    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "ASSIGNED",
    },

    attachment: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true,
      defaultValue: [],
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "assigned_action_items",
    timestamps: false,
  },
);
