import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { QuizRepsitory } from "./quizze.repository";
import { Quiz } from "./quizze.model";
import { QuizzeInterface } from "./quizze.interface";
const QuizRepo = new QuizRepsitory();
// type CreateQuizBody = Partial<Quiz>;

export class QuizController {
  async getQuizById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { organization_id, id } = req.params as { id: string; organization_id: string };
      const quiz = await QuizRepo.getQuizById(req.user?.organization_id as string, id);

      if (!quiz) {
        return reply.code(200).send({ message: "Quiz not found" });
      }
      return reply
        .code(200)
        .send({ data: quiz, message: "Quiz fetched successfully" });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch Quiz");
    }
  }

  async createQuiz(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as QuizzeInterface;
      const data = { ...body, organization_id: req.user?.organization_id as string };
      const quiz = await QuizRepo.createQuiz(data);
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
      throw new InternalServerError("Failed to update Quiz");
    }
  }

  async deleteQuiz(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await QuizRepo.deleteQuiz(id);

      if (!deleted) {
        throw new NotFoundError("Quiz not found");
      }

      return reply.send({ message: "Quiz deleted" });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to delete Quiz");
    }
  }

  async getAllQuiz(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { page, limit } = req.query as { page?: string; limit?: string };

      const quiz = await QuizRepo.getQuiz(
        Number(page),
        Number(limit),
        { organization_id: req.user?.organization_id as string }
      );

      return reply.status(200).send(quiz);
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch Quiz");
    }
  }
}
