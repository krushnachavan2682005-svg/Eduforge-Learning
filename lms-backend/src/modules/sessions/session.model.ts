import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";
import { User } from "../users/user.model";

export interface SessionAttributes {
  id: string;
  user_id: string;
  refresh_token: string;
  expires_at: Date;
  user_agent?: string | null;
  ip_address?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface SessionCreationAttributes
  extends Optional<SessionAttributes, "id" | "user_agent" | "ip_address" | "created_at" | "updated_at"> {}

export class Session
  extends Model<SessionAttributes, SessionCreationAttributes>
  implements SessionAttributes
{
  public id!: string;
  public user_id!: string;
  public refresh_token!: string;
  public expires_at!: Date;
  public user_agent?: string | null;
  public ip_address?: string | null;
  public created_at?: Date;
  public updated_at?: Date;
}

Session.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    refresh_token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(64),
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
    tableName: "sessions",
    timestamps: false,
    indexes: [{ fields: ["user_id"] }, { unique: true, fields: ["refresh_token"] }],
    hooks: {
      beforeUpdate: (session) => {
        session.updated_at = new Date();
      },
    },
  },
);

User.hasMany(Session, { foreignKey: "user_id", as: "sessions" });
Session.belongsTo(User, { foreignKey: "user_id", as: "user" });
