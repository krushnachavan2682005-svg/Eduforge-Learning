import { Quiz } from "./quizze.model";
import { QuizRepsitory } from "./quizze.repository";
import { NotFoundError } from "../../utils/globalErrorHandlingFile";

export class QuizzeService {
  private quizRepo = new QuizRepsitory();

  async getQuiz(organizationId: string, page: number, limit: number, cursor?: string) {
    return await this.quizRepo.getQuiz(organizationId, page, limit, cursor);
  }

  async getQuizById(organizationId: string, id: string) {
    const quiz = await this.quizRepo.getQuizById(organizationId, id);
    if (!quiz) {
      throw new NotFoundError("Quiz not found");
    }
    return quiz;
  }

  async createQuiz(organizationId: string, data: Partial<Quiz>) {
    const payload = { ...data, organization_id: organizationId };
    return await this.quizRepo.createQuiz(payload);
  }

  async updateQuiz(organizationId: string, id: string, data: Partial<Quiz>) {
    const quizInstance = await this.quizRepo.findById(organizationId, id);
    if (!quizInstance) {
      throw new NotFoundError("Quiz not found");
    }
    return await this.quizRepo.updateQuiz(quizInstance, data);
  }

  async deleteQuiz(organizationId: string, id: string) {
    const quizInstance = await this.quizRepo.findById(organizationId, id);
    if (!quizInstance) {
      throw new NotFoundError("Quiz not found");
    }
    return await this.quizRepo.deleteQuiz(quizInstance);
  }
}
