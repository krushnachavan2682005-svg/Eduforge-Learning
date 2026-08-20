import uploadController from "./upload.controller";
import { FastifyInstance } from "fastify";
import { verifyToken } from "../../utils/auth";
import { uploadFileSchema } from "./upload.schema";

export default async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post("/upload", { preHandler: verifyToken }, (req, reply) =>
    uploadController.uploadFile(req, reply)
  );
  fastify.post("/presigned-url", { preHandler: verifyToken }, (req, reply) =>
    uploadController.generatePresignedUrl(req, reply)
  );
}
