import { Reviews } from "../models/reviews.model";
import { paginate } from "../utils/pagination";

export class ReviewsRepository {
  findAll() {
      throw new Error("Method not implemented.");
  }
  findById(arg0: string) {
      throw new Error("Method not implemented.");
  }
  async getAllReviews(
    page: number,
    limit: number,
    filters?: Record<string, any>
  ) {
    return paginate(Reviews, {
      page: Number(page),
      limit: Number(limit),
      filters,
      attributes: ["id", "user_id", "course_id", "rating", "comment", "created_at"],
      order: [["created_at", "DESC"]],
    });
  }
  async getReviewById(id: string) {
    return Reviews.findOne({
      where: { id },
      attributes: ["id", "user_id", "course_id", "rating", "comment", "created_at"],
    });
  }

  async createReview(data: Partial<Reviews>) {
    return Reviews.create(data as any);
  }


  async updateReview(id: string, data: Partial<Reviews>) {
    const review = await Reviews.findByPk(id);
    if (!review) return null;
    return review.update(data);
  }

  async deleteReview(id: string) {
    const review = await Reviews.findByPk(id);
    if (!review) return null;
    await review.destroy();
    return review;
  }
}
