import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config/database";

export class ResumeModel extends Model {
  public id!: string;
  public user_id!: string;
  public location!: any;
  public education!: any;
  public skills!: any;
  public work!: any;
  public projects!: any;
}

ResumeModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    summary: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    education: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    skills: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    work: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    projects: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "resumes",
    timestamps: false,
  }
);
