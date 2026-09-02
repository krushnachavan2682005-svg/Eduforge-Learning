import { Reviews } from "./reviews.model";
import { paginate } from "../../utils/pagination";

export class ReviewsRepository {
  async getAllReviews(
    page: number,
    limit: number,
    cursor?: string,
    filters?: Record<string, any>,
  ) {
    return paginate(Reviews, {
      page: Number(page),
      limit: Number(limit),
      cursor,
      useCursorPagination:true,
      cursorFields: ["created_at", "id"],
      filters,
      attributes: [
        "id",
        "user_id",
        "course_id",
        "rating",
        "comment",
        "created_at",
      ],
      order: [
        ["created_at", "DESC"],
        ["id", "DESC"],
      ],
    });
  }

  async getReviewById(id: string) {
    return Reviews.findOne({
      where: { id },
      attributes: [
        "id",
        "user_id",
        "course_id",
        "rating",
        "comment",
        "created_at",
      ],
    });
  }

  async findById(id: string) {
    return Reviews.findByPk(id);
  }

  async createReview(data: Partial<Reviews>) {
    return Reviews.create(data as any);
  }

  async updateReview(review: any, data: Partial<Reviews>) {
    return review.update(data);
  }

  async deleteReview(review: any) {
    await review.destroy();
    return review;
  }
}
