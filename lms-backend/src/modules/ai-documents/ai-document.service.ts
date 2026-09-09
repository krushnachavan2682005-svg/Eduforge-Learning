import { FastifyInstance } from "fastify";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import { AiDocumentRepository } from "./ai-document.repository";
import { DocumentIntelligenceClient } from "../../integrations/document-intelligence/DocumentIntelligenceClient";

export class AiDocumentService {
  private repository: AiDocumentRepository;
  private documentIntelligenceClient: DocumentIntelligenceClient;

  constructor() {
    this.repository = new AiDocumentRepository();
    this.documentIntelligenceClient = new DocumentIntelligenceClient();
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

      // Background processing trigger
      this.triggerDocumentProcessing(document).catch(console.error);

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

  async triggerDocumentProcessing(document: any) {
    const STALE_TIMEOUT_MS = parseInt(process.env.DOCUMENT_PROCESSING_STALE_TIMEOUT_MS || "300000", 10);
    const staleThreshold = new Date(Date.now() - STALE_TIMEOUT_MS);
    const jobId = randomUUID();
    let leaseAcquired = false;

    try {
      // 1. Safe transition to PROCESSING (acquire lease)
      const affected = await this.repository.acquireProcessingLease(
        document.id,
        document.organization_id,
        document.student_id,
        jobId,
        staleThreshold
      );

      if (affected === 0) {
        console.warn(`[AiDocumentService] Document ${document.id} cannot be processed (already actively processing or in an invalid state)`);
        throw new Error("Document is already processing or in an invalid state");
      }
      
      leaseAcquired = true;

      const response = await this.documentIntelligenceClient.processDocument({
        job_id: jobId,
        document_id: document.id,
        organization_id: document.organization_id,
        owner_user_id: document.owner_user_id,
        storage_bucket: document.storage_bucket,
        storage_key: document.storage_key,
        mime_type: document.mime_type,
        file_size_bytes: document.file_size_bytes,
        processing_type: "PREPROCESS_PDF"
      });

      if (response.success) {
        const releasedCount = await this.repository.releaseProcessingLease(
          document.id, 
          document.organization_id, 
          document.student_id, 
          "COMPLETED",
          jobId
        );
        if (releasedCount === 0) {
          console.warn(`[AiDocumentService] Job ${jobId} finished for doc ${document.id} but lease was no longer current (stale recovery occurred). Status update ignored.`);
        }
      } else {
        const releasedCount = await this.repository.releaseProcessingLease(
          document.id, 
          document.organization_id, 
          document.student_id, 
          "FAILED",
          jobId
        );
        if (releasedCount === 0) {
          console.warn(`[AiDocumentService] Job ${jobId} failed for doc ${document.id} but lease was no longer current. Status update ignored.`);
        }
      }
    } catch (error) {
      console.error(`Failed to process document ${document.id}:`, error);
      if (leaseAcquired) {
        const releasedCount = await this.repository.releaseProcessingLease(
          document.id, 
          document.organization_id, 
          document.student_id, 
          "FAILED",
          jobId
        );
        if (releasedCount === 0) {
          console.warn(`[AiDocumentService] Failed job ${jobId} error caught for doc ${document.id} but lease was no longer current. Status update ignored.`);
        }
      }
    }
  }

  async retryProcessing(id: string, organization_id: string, student_id: string) {
    const document = await this.getDocument(id, organization_id, student_id);
    if (!document) {
      throw new Error("Document not found");
    }
    
    // Check if it's eligible for retry (FAILED, UPLOADED, or stuck PROCESSING)
    if (document.processing_status === "COMPLETED") {
      throw new Error("Document is already fully processed");
    }

    // Trigger asynchronously so we don't block the HTTP request
    this.triggerDocumentProcessing(document).catch(console.error);
    return true;
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
