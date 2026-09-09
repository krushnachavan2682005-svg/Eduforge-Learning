import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";

export type AiDocumentStatus = "UPLOADED" | "PROCESSING" | "FAILED" | "COMPLETED";

export interface AiDocumentAttributes {
  id: string;
  organization_id: string;
  student_id: string;
  owner_user_id: string;
  file_name: string;
  storage_bucket: string;
  storage_key: string;
  mime_type: string;
  file_size_bytes: number;
  processing_status: AiDocumentStatus;
  processing_type?: string;
  processing_started_at?: Date | null;
  current_processing_job_id?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface AiDocumentCreationAttributes
  extends Optional<
    AiDocumentAttributes,
    "id" | "processing_status" | "processing_type" | "processing_started_at" | "current_processing_job_id" | "created_at" | "updated_at"
  > {}

export class AiDocument
  extends Model<AiDocumentAttributes, AiDocumentCreationAttributes>
  implements AiDocumentAttributes
{
  public id!: string;
  public organization_id!: string;
  public student_id!: string;
  public owner_user_id!: string;
  public file_name!: string;
  public storage_bucket!: string;
  public storage_key!: string;
  public mime_type!: string;
  public file_size_bytes!: number;
  public processing_status!: AiDocumentStatus;
  public processing_type?: string;
  public processing_started_at?: Date | null;
  public current_processing_job_id?: string | null;
  public created_at?: Date;
  public updated_at?: Date;
}

AiDocument.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "organizations", key: "id" },
    },
    student_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "students", key: "id" },
    },
    owner_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    file_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    storage_bucket: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    storage_key: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    mime_type: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    file_size_bytes: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    processing_status: {
      type: DataTypes.ENUM("UPLOADED", "PROCESSING", "FAILED", "COMPLETED"),
      allowNull: false,
      defaultValue: "UPLOADED",
    },
    processing_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    processing_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    current_processing_job_id: {
      type: DataTypes.UUID,
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
    tableName: "ai_documents",
    timestamps: false,
    indexes: [
      { name: "idx_ai_docs_org_student", fields: ["organization_id", "student_id"] },
      { name: "idx_ai_docs_org_student_id", fields: ["organization_id", "student_id", "id"] },
    ],
    hooks: {
      beforeUpdate: (doc) => {
        doc.updated_at = new Date();
      },
    },
  },
);
