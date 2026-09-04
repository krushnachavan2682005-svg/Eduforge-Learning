import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";
import { AiDocument } from "./ai-document.model";

export interface DocumentChunkAttributes {
  id?: number;
  organization_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  embedding_status: string;
  content_fingerprint: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface DocumentChunkCreationAttributes
  extends Optional<DocumentChunkAttributes, "id" | "embedding_status" | "created_at" | "updated_at"> {}

export class DocumentChunk
  extends Model<DocumentChunkAttributes, DocumentChunkCreationAttributes>
  implements DocumentChunkAttributes
{
  public id?: number;
  public organization_id!: string;
  public document_id!: string;
  public chunk_index!: number;
  public content!: string;
  public token_count!: number;
  public embedding_status!: string;
  public content_fingerprint!: string;
  public created_at?: Date;
  public updated_at?: Date;
}

DocumentChunk.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "organizations", key: "id" },
    },
    document_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "ai_documents", key: "id" },
    },
    chunk_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    token_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    embedding_status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "PENDING",
    },
    content_fingerprint: {
      type: DataTypes.STRING(64),
      allowNull: false,
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
    tableName: "document_chunks",
    timestamps: false,
    indexes: [
      {
        name: "uq_doc_chunks_idx",
        unique: true,
        fields: ["organization_id", "document_id", "chunk_index"],
      },
    ],
    hooks: {
      beforeUpdate: (chunk) => {
        chunk.updated_at = new Date();
      },
    },
  },
);
