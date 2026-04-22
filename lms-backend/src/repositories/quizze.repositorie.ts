import { Quiz } from "../models/quizze.model";
import { paginate } from "../utils/pagination";


export class QuizRepsitory {
  async getQuiz(
    page: number,
    limit: number,
    filters: Record<string, any>
  ) {
    const data = await paginate(Quiz, {
      page: Number(page),
      limit: Number(limit),
      filters,
      attributes: ["id",  "lesson_id", "question","options", "created_at"],
      order: [["created_at", "DESC"]],
    });
    return data;
  }

  async getQuizById(client_id: string, id: string) {
    return Quiz.findOne({
      where: { id, client_id },
      attributes: ["id",  "lesson_id", "question","options", "created_at"],
    });
  }

  async createQuiz(data: Partial<Quiz>) {
    return Quiz.create(data as any);
  }

  async updateQuiz(id: string, data: Partial<Quiz>) {
    const result = await Quiz.findByPk(id);
    if (!result) return null;
    return result.update(data);
  }

  async deleteQuiz(id: string) {
    const data = await Quiz.findByPk(id);
    if (!data) return null;
    await data.destroy();
    return data;
  }
}
