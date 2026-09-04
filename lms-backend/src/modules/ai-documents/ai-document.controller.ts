import { FastifyRequest, FastifyReply } from "fastify";
import { AiDocumentService } from "./ai-document.service";
import { StudentRepository } from "../students/student.repository";

export class AiDocumentController {
  private service: AiDocumentService;
  private studentRepository: StudentRepository;

  constructor() {
    this.service = new AiDocumentService();
    this.studentRepository = new StudentRepository();
  }

  private async getStudentId(request: FastifyRequest): Promise<string | null> {
    const user = request.user as any;
    if (!user || !user.sub || !user.organization_id) {
      return null;
    }
    const student = await this.studentRepository.findStudentByUserId(user.organization_id, user.sub);
    return student ? student.id : null;
  }

  createDocument = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const studentId = await this.getStudentId(request);

    if (!studentId) {
      return reply.status(403).send({ message: "Forbidden: Only students can access this feature." });
    }

    const { file_name, storage_bucket, storage_key, mime_type, file_size_bytes } = request.body as any;

    try {
      const document = await this.service.createDocument({
        organization_id: user.organization_id,
        student_id: studentId,
        owner_user_id: user.sub,
        file_name,
        storage_bucket,
        storage_key,
        mime_type,
        file_size_bytes,
      });

      return reply.status(201).send(document);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message || "Failed to create document metadata" });
    }
  };

  uploadDocument = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const studentId = await this.getStudentId(request);

    if (!studentId) {
      return reply.status(403).send({ message: "Forbidden: Only students can access this feature." });
    }

    try {
      const file = await (request as any).file();
      if (!file) {
        return reply.status(400).send({ message: "No file uploaded" });
      }

      const document = await this.service.uploadAndCreateDocument(
        request.server,
        file,
        user.organization_id,
        studentId,
        user.sub
      );

      return reply.status(201).send({
        id: document.id,
        file_name: document.file_name,
        mime_type: document.mime_type,
        file_size_bytes: document.file_size_bytes,
        processing_status: document.processing_status,
        processing_type: document.processing_type,
        created_at: document.created_at,
      });
    } catch (error: any) {
      // Differentiate between 415 and 400 manually if possible, or just send 400
      if (error.message.includes("Invalid file type") || error.message.includes("Invalid file extension")) {
        return reply.status(415).send({ message: error.message });
      }
      return reply.status(400).send({ message: error.message || "Failed to upload document" });
    }
  };

  listDocuments = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const studentId = await this.getStudentId(request);

    if (!studentId) {
      return reply.status(403).send({ message: "Forbidden: Only students can access this feature." });
    }

    const { page, limit } = request.query as any;

    const result = await this.service.listDocuments(
      user.organization_id,
      studentId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10
    );

    return reply.status(200).send(result);
  };

  getDocument = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const studentId = await this.getStudentId(request);

    if (!studentId) {
      return reply.status(403).send({ message: "Forbidden: Only students can access this feature." });
    }

    const { id } = request.params as any;

    const document = await this.service.getDocument(id, user.organization_id, studentId);

    if (!document) {
      return reply.status(404).send({ message: "Document not found" });
    }

    return reply.status(200).send(document);
  };

  deleteDocument = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const studentId = await this.getStudentId(request);

    if (!studentId) {
      return reply.status(403).send({ message: "Forbidden: Only students can access this feature." });
    }

    const { id } = request.params as any;

    const success = await this.service.deleteDocument(id, user.organization_id, studentId);

    if (!success) {
      return reply.status(404).send({ message: "Document not found or cannot be deleted" });
    }

    return reply.status(200).send({ message: "Document deleted successfully" });
  };
}
