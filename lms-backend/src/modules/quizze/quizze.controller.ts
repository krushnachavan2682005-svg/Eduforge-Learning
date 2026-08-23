import { FastifyReply, FastifyRequest } from "fastify";
import { QuizzeService } from "./quizze.service";
import { Quiz } from "./quizze.model";
import { QuizzeInterface } from "./quizze.interface";
import { InternalServerError } from "../../utils/globalErrorHandlingFile";

const quizzeService = new QuizzeService();

export class QuizController {
  async getQuizById(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const { id } = req.params as { id: string };
      const quiz = await quizzeService.getQuizById(
        req.user.organization_id,
        id,
      );

      return reply
        .code(200)
        .send({ data: quiz, message: "Quiz fetched successfully" });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return reply.code(200).send({ message: "Quiz not found" });
      }
      req.log.error(error);
      throw new InternalServerError("Failed to fetch Quiz");
    }
  }

  async createQuiz(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const body = req.body as QuizzeInterface;
      const quiz = await quizzeService.createQuiz(
        req.user.organization_id,
        body,
      );

      return reply.code(201).send({
        data: {
          id: quiz?.id,
        },
        message: "Quiz created successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to create Quiz");
    }
  }

  async updateQuiz(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const { id } = req.params as { id: string };
      const body = req.body as Partial<Quiz>;

      const updated = await quizzeService.updateQuiz(
        req.user.organization_id,
        id,
        body,
      );

      return reply.send({
        data: updated?.id,
        message: "Quiz updated successfully",
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return reply.code(200).send({ message: "Quiz not found" });
      }
      req.log.error(error);
      throw new InternalServerError("Failed to update Quiz");
    }
  }

  async deleteQuiz(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const { id } = req.params as { id: string };

      await quizzeService.deleteQuiz(req.user.organization_id, id);

      return reply.send({ message: "Quiz deleted" });
    } catch (error: any) {
      if (error.statusCode === 404) {
        // Preserving the original behavior which threw a NotFoundError
        throw error;
      }
      req.log.error(error);
      throw new InternalServerError("Failed to delete Quiz");
    }
  }

  async getAllQuiz(req: FastifyRequest, reply: FastifyReply) {
    try {
      if (!req.user) return reply.code(401).send({ success: false });
      const { page, limit } = req.query as { page?: string; limit?: string };

      const quiz = await quizzeService.getQuiz(
        req.user.organization_id,
        Number(page),
        Number(limit),
      );

      return reply.status(200).send(quiz);
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch Quiz");
    }
  }
}
