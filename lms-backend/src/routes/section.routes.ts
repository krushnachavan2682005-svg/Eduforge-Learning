import { FastifyInstance } from "fastify";
import { sectionController } from "../controllers/section.controller";
import { Section } from "../models/section.models";
import { sectionSchema } from "../schemas/section.schema";
import { verifyToken } from "../utils/auth";

const controller= new sectionController()
type CreateSectionBody = Partial<Section>;

export default async function sectionRoutes(fastify: FastifyInstance) {
  fastify.post("/section", { schema: sectionSchema ,preHandler: verifyToken }, (req, reply) =>
    controller.createSection(req, reply)
  );

  fastify.get("/all-section",{ preHandler: verifyToken }, (req, reply) =>
    controller.getAllSection(req, reply)
  );

  fastify.get("/section/:id",{ preHandler: verifyToken }, (req, reply) =>
    controller.getSectionById(req, reply)
  );

  fastify.put("/section/:id", { schema: sectionSchema ,preHandler: verifyToken}, (req, reply) =>
    controller.updateSection(req, reply)
  );

  fastify.delete("/section/:id",{ preHandler: verifyToken }, (req, reply) =>
    controller.deleteSection(req, reply)
  );
}