import { FastifyInstance } from "fastify";
import { quizSchema } from "../schemas/quizze.schema";
import { Quiz } from "../models/quizze.model";
import { QuizController } from "../controllers/quizze.controller";
import { verifyToken } from "../utils/auth";

const Controller= new QuizController()
type CreateQuizBody = Partial<Quiz>;

export default async function quizRoutes(fastify: FastifyInstance) {
  fastify.post("/quiz", { schema: quizSchema,preHandler: verifyToken }, (req, reply) =>
    Controller.createQuiz(req, reply)
  );

  fastify.get("/all-quiz",{ preHandler: verifyToken }, (req, reply) =>
    Controller.getAllQuiz(req, reply)
  );

  fastify.get("/quiz/:id",{ preHandler: verifyToken }, (req, reply) =>
    Controller.getQuizById(req, reply)
  );

  fastify.put("/quiz/:id", { schema: quizSchema,preHandler: verifyToken }, (req, reply) =>
    Controller.updateQuiz(req, reply) 
  );

  fastify.delete("/quiz/:id",{ preHandler: verifyToken }, (req, reply) =>
    Controller.deleteQuiz(req, reply)
  );
}