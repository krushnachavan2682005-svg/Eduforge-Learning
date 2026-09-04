import { AiDocument } from "./ai-document.model";

type ListDocumentsFilters = {
  organization_id: string;
  student_id: string;
  page: number;
  limit: number;
};

export class AiDocumentRepository {
  async createDocument(data: {
    organization_id: string;
    student_id: string;
    owner_user_id: string;
    file_name: string;
    storage_bucket: string;
    storage_key: string;
    mime_type: string;
    file_size_bytes: number;
    processing_status?: "UPLOADED";
  }) {
    return AiDocument.create({ ...data, processing_status: "UPLOADED" });
  }

  async listDocuments(filters: ListDocumentsFilters) {
    const offset = (filters.page - 1) * filters.limit;

    const { rows, count } = await AiDocument.findAndCountAll({
      where: {
        organization_id: filters.organization_id,
        student_id: filters.student_id,
      },
      attributes: [
        "id",
        "file_name",
        "mime_type",
        "file_size_bytes",
        "processing_status",
        "processing_type",
        "created_at",
        "updated_at",
      ],
      order: [["created_at", "DESC"]],
      limit: filters.limit,
      offset,
    });

    return { data: rows, count };
  }

  async getDocumentById(id: string, organization_id: string, student_id: string) {
    return AiDocument.findOne({
      where: {
        id,
        organization_id,
        student_id,
      },
      attributes: [
        "id",
        "file_name",
        "mime_type",
        "file_size_bytes",
        "processing_status",
        "processing_type",
        "created_at",
        "updated_at",
      ],
    });
  }

  async deleteDocument(id: string, organization_id: string, student_id: string) {
    return AiDocument.destroy({
      where: {
        id,
        organization_id,
        student_id,
      },
    });
  }
}
