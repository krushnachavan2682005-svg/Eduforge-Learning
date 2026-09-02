import { Quiz } from "./quizze.model";
import { paginate } from "../../utils/pagination";

export class QuizRepsitory {
  async getQuiz(organizationId: string, page: number, limit: number, cursor?: string) {
    const data = await paginate(Quiz, {
      page: Number(page),
      limit: Number(limit),
      cursor,
      useCursorPagination:true,
      cursorFields: ["created_at", "id"],
      filters: { organization_id: organizationId },
      attributes: ["id", "lesson_id", "question", "options", "created_at"],
      order: [
        ["created_at", "DESC"],
        ["id", "DESC"],
      ],
    });
    return data;
  }

  async getQuizById(organizationId: string, id: string) {
    return Quiz.findOne({
      where: { id, organization_id: organizationId },
      attributes: ["id", "lesson_id", "question", "options", "created_at"],
    });
  }

  async findById(organizationId: string, id: string) {
    return Quiz.findOne({
      where: { id, organization_id: organizationId },
    });
  }

  async createQuiz(data: Partial<Quiz>) {
    return Quiz.create(data as any);
  }

  async updateQuiz(quizInstance: any, data: Partial<Quiz>) {
    return quizInstance.update(data);
  }

  async deleteQuiz(quizInstance: any) {
    await quizInstance.destroy();
    return quizInstance;
  }
}
