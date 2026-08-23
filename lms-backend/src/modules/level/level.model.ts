import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";
import { beforeSave } from "../../db/hooks/time_format_hook";

export interface LevelInterface {
  id?: string;
  organization_id: string;
  level_name: string;
  start_date: Date;
  end_date: Date;
  created_at?: Date;
  updated_at?: Date;
}

interface LevelCreationAttributes extends Optional<
  LevelInterface,
  "id" | "created_at" | "updated_at"
> {}

export class Level
  extends Model<LevelInterface, LevelCreationAttributes>
  implements LevelInterface
{
  public id?: string;
  public organization_id!: string;
  public level_name!: string;
  public start_date!: Date;
  public end_date!: Date;
  public created_at?: Date;
  public updated_at?: Date;
}

Level.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    level_name: { type: DataTypes.STRING, allowNull: false },
    start_date: { type: DataTypes.DATE, allowNull: true },
    end_date: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "levels",
    timestamps: false,
    indexes: [{ unique: true, fields: ["organization_id", "level_name"] }],
    hooks: {
      beforeSave: (instance) => {
        beforeSave(instance);
      },
    },
  },
);
