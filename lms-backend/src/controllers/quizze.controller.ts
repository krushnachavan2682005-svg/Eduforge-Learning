import { FastifyReply, FastifyRequest } from "fastify";
import { QuizRepsitory } from "../repositories/quizze.repositorie";
import { Quiz } from "../models/quizze.model";
import { QuizzeInterface } from "../interfaces/quizze.interface";
const QuizRepo = new QuizRepsitory();
// type CreateQuizBody = Partial<Quiz>;

export class QuizController {
  async getQuizById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, id } = req.params as { id: string; client_id: string };
      const quiz = await QuizRepo.getQuizById(client_id, id);

      if (!quiz) {
        return reply.code(200).send({ message: "Quiz not found" });
      }
      return reply
        .code(200)
        .send({ data: quiz, message: "Quiz fetched successfully" });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to fetch Quiz",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async createQuiz(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const body = req.body as QuizzeInterface;
      const data = { ...body, client_id };
      const quiz = await QuizRepo.createQuiz(data);
      return reply.code(201).send({
        data: {
          id: quiz?.id,
        },
        message: "Quiz created successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to create Quiz",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async updateQuiz(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<Quiz>;

      const updated = await QuizRepo.updateQuiz(id, body);

      if (!updated) {
        return reply.code(200).send({ message: "Quiz not found" });
      }

      return reply.send({
        data: updated?.id,
        message: "Quiz updated successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to update Quiz",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async deleteQuiz(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await QuizRepo.deleteQuiz(id);

      if (!deleted) {
        return reply.code(404).send({ message: "Quiz not found" });
      }

      return reply.send({ message: "Quiz deleted" });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to delete Quiz",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getAllQuiz(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const { page, limit } = req.query as { page?: string; limit?: string };

      const quiz = await QuizRepo.getQuiz(
        Number(page),
        Number(limit),
        { client_id }
      );

      return reply.status(200).send(quiz);
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to fetch Quiz",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
