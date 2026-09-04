import { FastifyInstance } from "fastify";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import { AiDocumentRepository } from "./ai-document.repository";

export class AiDocumentService {
  private repository: AiDocumentRepository;

  constructor() {
    this.repository = new AiDocumentRepository();
  }

  async createDocument(data: {
    organization_id: string;
    student_id: string;
    owner_user_id: string;
    file_name: string;
    storage_bucket: string;
    storage_key: string;
    mime_type: string;
    file_size_bytes: number;
  }) {
    if (!data.file_name || !data.storage_bucket || !data.storage_key || !data.mime_type || data.file_size_bytes == null) {
      throw new Error("Missing required document metadata");
    }

    return this.repository.createDocument(data);
  }

  async uploadAndCreateDocument(
    fastify: FastifyInstance,
    file: any,
    organization_id: string,
    student_id: string,
    owner_user_id: string
  ) {
    if (!file) throw new Error("No file provided");

    // Validate MIME type
    if (file.mimetype !== "application/pdf") {
      throw new Error("Invalid file type. Only application/pdf is allowed.");
    }

    const originalName = file.filename || "document.pdf";
    // Basic sanitization
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const ext = sanitizedName.split(".").pop()?.toLowerCase();
    
    // Validate Extension
    if (ext !== "pdf") {
      throw new Error("Invalid file extension. Only .pdf is allowed.");
    }

    const uuid = randomUUID();
    const key = `lms/ai-documents/${organization_id}/${student_id}/${uuid}.pdf`;

    // Read stream to buffer (limits enforced by @fastify/multipart)
    const chunks: Buffer[] = [];
    let fileSize = 0;
    for await (const chunk of file.file as Readable) {
      chunks.push(chunk);
      fileSize += chunk.length;
    }
    const fileBuffer = Buffer.concat(chunks);

    // 1. Storage Upload
    await fastify.s3UploadBuffer(fileBuffer, key, { ContentType: "application/pdf" });

    // 2. Database Insert
    try {
      const document = await this.repository.createDocument({
        organization_id,
        student_id,
        owner_user_id,
        file_name: sanitizedName,
        storage_bucket: process.env.AWS_BUCKET_NAME || "eduforge-bucket",
        storage_key: key,
        mime_type: "application/pdf",
        file_size_bytes: fileSize,
      });

      return document;
    } catch (error) {
      // 3. Compensation: Delete from S3 if DB fails
      console.error("Database insert failed, cleaning up S3 object:", key, error);
      try {
        await fastify.s3Delete(key);
      } catch (s3Error) {
        console.error("Failed to clean up S3 object after DB failure:", key, s3Error);
      }
      throw new Error("Failed to store document metadata. Upload reverted.");
    }
  }

  async listDocuments(
    organization_id: string,
    student_id: string,
    page: number = 1,
    limit: number = 10
  ) {
    return this.repository.listDocuments({
      organization_id,
      student_id,
      page,
      limit,
    });
  }

  async getDocument(id: string, organization_id: string, student_id: string) {
    const document = await this.repository.getDocumentById(id, organization_id, student_id);
    if (!document) {
      return null;
    }
    return document;
  }

  async deleteDocument(id: string, organization_id: string, student_id: string) {
    const document = await this.getDocument(id, organization_id, student_id);
    if (!document) {
      return false; // Document doesn't exist or isn't owned by this student
    }

    const deletedCount = await this.repository.deleteDocument(id, organization_id, student_id);
    return deletedCount > 0;
  }
}
