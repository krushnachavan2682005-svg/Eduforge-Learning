import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import UploadService from "./upload.service";

class UploadController {
  async uploadFile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const file = await (request as any).file();
      if (!file) {
        throw new ValidationError("No file uploaded");
      }

      const folder =
        (request.query as any)?.folder || (request.body as any)?.folder || null;

      const result = await UploadService.uploadFile(
        request.server,
        file,
        folder
      );

      reply.code(201).send(result);
    } catch (error: any) {
      console.error("Upload Error:", error);
      throw new InternalServerError("File upload failed");
    }
  }

  async generatePresignedUrl(request: FastifyRequest, reply: FastifyReply) {
    try {
      const key =
        (request.query as any)?.key || (request.body as any)?.key || null;

      const result = await UploadService.generatePresignedUrl(
        request.server,
        key
      );

      reply.code(200).send({
        message: "File url generated successfully",
        data: result,
      });
    } catch (error: any) {
      console.error("Upload Error:", error);
      throw new InternalServerError("Failed to generate presigned URL");
    }
  }
}

export default new UploadController();
