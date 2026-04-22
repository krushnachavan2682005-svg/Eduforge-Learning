import { FastifyInstance } from "fastify";
import { lessonSchema } from "../schemas/lesson.schema";
import { lesson } from "../models/lesson.model";
import { lessonController } from "../controllers/lesson.controller";
import { verifyToken } from "../utils/auth";

const Controller= new lessonController()
type CreateLessonBody = Partial<lesson>;

export default async function courseRoutes(fastify: FastifyInstance) {
  fastify.post("/lesson", { schema: lessonSchema, preHandler: verifyToken}, (req, reply) =>
    Controller.createLesson(req, reply)
  );

  fastify.get("/all-lesson",{ preHandler: verifyToken } ,(req, reply) =>
    Controller.getAllLesson(req, reply)
  );

  fastify.get("/lesson/:id",{ preHandler: verifyToken }, (req, reply) =>
    Controller.getLessonById(req, reply)
  );

  fastify.put("/lesson/:id", { schema: lessonSchema }, (req, reply) =>
    Controller.updateLesson(req, reply)
  );

  fastify.delete("/lesson/:id",{ preHandler: verifyToken }, (req, reply) =>
    Controller.deleteLesson(req, reply)
  );
}