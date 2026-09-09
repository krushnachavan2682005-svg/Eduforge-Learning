import { FastifyInstance } from "fastify";
import { AiDocumentController } from "./ai-document.controller";
import { requirePermission } from "../../middleware/rbac.middleware";

export default async function aiDocumentRoutes(fastify: FastifyInstance) {
  const controller = new AiDocumentController();

  fastify.post(
    "/",
    {
      preHandler: [requirePermission("AI_DOCUMENT_CREATE")],
    },
    controller.createDocument
  );

  fastify.post(
    "/upload",
    {
      preHandler: [requirePermission("AI_DOCUMENT_CREATE")],
    },
    controller.uploadDocument
  );

  fastify.get(
    "/",
    {
      preHandler: [requirePermission("AI_DOCUMENT_VIEW")],
    },
    controller.listDocuments
  );

  fastify.get(
    "/:id",
    {
      preHandler: [requirePermission("AI_DOCUMENT_VIEW")],
    },
    controller.getDocument
  );

  fastify.delete(
    "/:id",
    {
      preHandler: [requirePermission("AI_DOCUMENT_DELETE")],
    },
    controller.deleteDocument
  );

  fastify.post(
    "/:id/process",
    {
      preHandler: [requirePermission("AI_DOCUMENT_CREATE")],
    },
    controller.processDocument
  );
}
