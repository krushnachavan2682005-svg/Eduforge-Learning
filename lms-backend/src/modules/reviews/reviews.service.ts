import { ReviewsRepository } from "./reviews.repository";
import { ReviewsInterface } from "./reviews.interface";
import { NotFoundError } from "../../utils/globalErrorHandlingFile";

export class ReviewsService {
  private repository: ReviewsRepository;

  constructor() {
    this.repository = new ReviewsRepository();
  }

  async getReviewById(id: string) {
    return await this.repository.getReviewById(id);
  }

  async createReview(data: ReviewsInterface, organizationId: string) {
    const payload = { ...data, organization_id: organizationId };
    return await this.repository.createReview(payload);
  }

  async updateReview(id: string, data: Partial<ReviewsInterface>) {
    const review = await this.repository.findById(id);
    if (!review) return null; // Preserving the null return behavior for the 200 OK edge case

    return await this.repository.updateReview(review, data);
  }

  async deleteReview(id: string) {
    const review = await this.repository.findById(id);
    if (!review) return null; // We'll map this to NotFoundError in controller, or throw it here. Let's throw here since delete naturally throws 404 in controller.

    await this.repository.deleteReview(review);
    return true;
  }

  async getAllReviews(
    page: number, 
    limit: number, 
    organizationId: string,
    cursor?: string
  ) {
    return await this.repository.getAllReviews(page, limit, cursor, {
      organization_id: organizationId,
    });
  }
}
