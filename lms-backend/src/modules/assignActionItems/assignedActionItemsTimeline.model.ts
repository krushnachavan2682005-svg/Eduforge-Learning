import { Model, DataTypes } from "sequelize";
import { sequelize } from "../../config/database";

export class AssignedActionItemsTimelineModel extends Model {
  public id!: string;
  public assigned_id!: string;
  public assignment_id!: string;
  public user_id!: string;
  public publish!: boolean;
  public created_at!: Date;
}

AssignedActionItemsTimelineModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    assigned_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "assigned_id",
    },
    assignment_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "assignment_id",
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    publish: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    // explicitly use the custom table name the database already has
    tableName: "publish_timeline",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: [
          "assigned_id",
          "assignment_id",
          "user_id",
        ],
      },
    ],
  },
);
