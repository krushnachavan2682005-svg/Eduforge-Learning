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

  async updateProcessingStatus(
    id: string,
    organization_id: string,
    student_id: string,
    status: "UPLOADED" | "PROCESSING" | "FAILED" | "COMPLETED",
    expectedStatuses?: string[]
  ) {
    const whereClause: any = {
      id,
      organization_id,
      student_id,
    };

    if (expectedStatuses && expectedStatuses.length > 0) {
      const { Op } = require("sequelize");
      whereClause.processing_status = {
        [Op.in]: expectedStatuses,
      };
    }

    const [affectedCount] = await AiDocument.update(
      { processing_status: status },
      { where: whereClause }
    );
    
    return affectedCount;
  }

  async acquireProcessingLease(
    id: string,
    organization_id: string,
    student_id: string,
    newJobId: string,
    staleTimeoutThreshold: Date
  ) {
    const { Op } = require("sequelize");

    const whereClause = {
      id,
      organization_id,
      student_id,
      [Op.or]: [
        { processing_status: { [Op.in]: ["UPLOADED", "FAILED"] } },
        {
          processing_status: "PROCESSING",
          processing_started_at: { [Op.lt]: staleTimeoutThreshold },
        },
      ],
    };

    const [affectedCount] = await AiDocument.update(
      {
        processing_status: "PROCESSING",
        processing_started_at: new Date(),
        current_processing_job_id: newJobId,
      },
      { where: whereClause }
    );

    return affectedCount;
  }

  async releaseProcessingLease(
    id: string,
    organization_id: string,
    student_id: string,
    status: "COMPLETED" | "FAILED",
    jobId: string
  ) {
    const whereClause = {
      id,
      organization_id,
      student_id,
      current_processing_job_id: jobId,
    };

    const [affectedCount] = await AiDocument.update(
      {
        processing_status: status,
        processing_started_at: null,
        current_processing_job_id: null,
      },
      { where: whereClause }
    );

    return affectedCount;
  }
}
