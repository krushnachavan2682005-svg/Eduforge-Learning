import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";
import { DocumentChunk } from "./document-chunk.model";

export interface DocumentChunkEmbeddingAttributes {
  id: string;
  organization_id: string;
  document_id: string;
  chunk_id: number;
  chunk_index: number;
  content_fingerprint: string;
  embedding: any; // VECTOR(384)
  embedding_provider: string;
  embedding_model: string;
  embedding_dimension: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface DocumentChunkEmbeddingCreationAttributes
  extends Optional<DocumentChunkEmbeddingAttributes, "id" | "created_at" | "updated_at"> {}

export class DocumentChunkEmbedding
  extends Model<DocumentChunkEmbeddingAttributes, DocumentChunkEmbeddingCreationAttributes>
  implements DocumentChunkEmbeddingAttributes
{
  public id!: string;
  public organization_id!: string;
  public document_id!: string;
  public chunk_id!: number;
  public chunk_index!: number;
  public content_fingerprint!: string;
  public embedding!: any;
  public embedding_provider!: string;
  public embedding_model!: string;
  public embedding_dimension!: number;
  public created_at?: Date;
  public updated_at?: Date;
}

DocumentChunkEmbedding.init(
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
    document_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "ai_documents", key: "id" },
    },
    chunk_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: "document_chunks", key: "id" },
    },
    chunk_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    content_fingerprint: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    embedding: {
      type: "VECTOR(384)" as any, // Sequelize will pass this directly to postgres
      allowNull: false,
    },
    embedding_provider: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    embedding_model: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    embedding_dimension: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 384,
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
    tableName: "document_chunk_embeddings",
    timestamps: false,
    indexes: [
      { name: "idx_chunk_embed_org_doc", fields: ["organization_id", "document_id"] },
      { name: "idx_chunk_embed_org_doc_chk", fields: ["organization_id", "document_id", "chunk_id"] },
    ],
    hooks: {
      beforeUpdate: (embed) => {
        embed.updated_at = new Date();
      },
    },
  },
);
