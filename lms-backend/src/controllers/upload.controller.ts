import { FastifyReply, FastifyRequest } from "fastify";
import UploadService from "../repositories/upload.repository";

class UploadController {
  async uploadFile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const file = await (request as any).file();
      if (!file) {
        return reply.code(400).send({ message: "No file uploaded" });
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
      reply.code(500).send({
        message: "File upload failed",
        error: error.message || error,
      });
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
      reply.code(500).send({
        message: "Failed to generate presigned URL",
        error: error.message || error,
      });
    }
  }
}

export default new UploadController();
