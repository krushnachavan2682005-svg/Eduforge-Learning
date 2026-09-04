// models/index.ts
import { Course } from "../modules/course/course.model";
import { lesson } from "../modules/lesson/lesson.model";
import { AiDocument } from "../modules/ai-documents/ai-document.model";
import { DocumentContentBlock } from "../modules/ai-documents/document-content-block.model";
import { DocumentChunk } from "../modules/ai-documents/document-chunk.model";
import { DocumentChunkEmbedding } from "../modules/ai-documents/document-chunk-embedding.model";
import { Organization } from "../modules/organizations/organization.model";
import { Student } from "../modules/students/student.model";
import { User } from "../modules/users/user.model";

Course.hasMany(lesson, { foreignKey: "course_id", as: "lessons" });
lesson.belongsTo(Course, { foreignKey: "course_id", as: "course" });

// AI Documents Associations
Organization.hasMany(AiDocument, { foreignKey: "organization_id", as: "ai_documents" });
AiDocument.belongsTo(Organization, { foreignKey: "organization_id", as: "organization" });

Student.hasMany(AiDocument, { foreignKey: "student_id", as: "ai_documents" });
AiDocument.belongsTo(Student, { foreignKey: "student_id", as: "student" });

User.hasMany(AiDocument, { foreignKey: "owner_user_id", as: "ai_documents" });
AiDocument.belongsTo(User, { foreignKey: "owner_user_id", as: "owner" });

AiDocument.hasMany(DocumentContentBlock, { foreignKey: "document_id", as: "content_blocks" });
DocumentContentBlock.belongsTo(AiDocument, { foreignKey: "document_id", as: "document" });

AiDocument.hasMany(DocumentChunk, { foreignKey: "document_id", as: "chunks" });
DocumentChunk.belongsTo(AiDocument, { foreignKey: "document_id", as: "document" });

DocumentChunk.hasMany(DocumentChunkEmbedding, { foreignKey: "chunk_id", as: "embeddings" });
DocumentChunkEmbedding.belongsTo(DocumentChunk, { foreignKey: "chunk_id", as: "chunk" });

export {
  Course,
  lesson,
  AiDocument,
  DocumentContentBlock,
  DocumentChunk,
  DocumentChunkEmbedding,
};