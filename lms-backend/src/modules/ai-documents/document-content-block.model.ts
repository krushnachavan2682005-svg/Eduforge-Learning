import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../../config/database";
import { AiDocument } from "./ai-document.model";

export interface DocumentContentBlockAttributes {
  id: string;
  organization_id: string;
  document_id: string;
  page_number: number;
  block_order: number;
  content_text?: string;
  readable_text?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface DocumentContentBlockCreationAttributes
  extends Optional<DocumentContentBlockAttributes, "id" | "created_at" | "updated_at"> {}

export class DocumentContentBlock
  extends Model<DocumentContentBlockAttributes, DocumentContentBlockCreationAttributes>
  implements DocumentContentBlockAttributes
{
  public id!: string;
  public organization_id!: string;
  public document_id!: string;
  public page_number!: number;
  public block_order!: number;
  public content_text?: string;
  public readable_text?: string;
  public created_at?: Date;
  public updated_at?: Date;
}

DocumentContentBlock.init(
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
    page_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    block_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    content_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    readable_text: {
      type: DataTypes.TEXT,
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
    tableName: "document_content_blocks",
    timestamps: false,
    indexes: [
      { name: "idx_doc_blocks_org_doc_page_ord", fields: ["organization_id", "document_id", "page_number", "block_order"] },
      { name: "idx_doc_blocks_doc_page_ord", fields: ["document_id", "page_number", "block_order"] },
    ],
    hooks: {
      beforeUpdate: (block) => {
        block.updated_at = new Date();
      },
    },
  },
);
