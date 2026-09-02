import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalServerError,
  ServiceUnavailableError,
} from "../../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { ReviewsService } from "./reviews.service";
import { ReviewsInterface } from "./reviews.interface";
import { Reviews } from "./reviews.model";

const reviewsService = new ReviewsService();

export class ReviewsController {
  async getReview(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const review = await reviewsService.getReviewById(id);
      return reply
        .code(200)
        .send({ data: review, message: "Review fetched successfully" });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch review");
    }
  }

  async createReview(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as ReviewsInterface;
      const organization_id = req.user?.organization_id as string;
      const review = await reviewsService.createReview(body, organization_id);
      return reply.code(201).send({
        data: { id: review?.id },
        message: "Review created successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to create review");
    }
  }

  async updateReview(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as Partial<ReviewsInterface>;

      const updated = await reviewsService.updateReview(id, body);

      if (!updated) {
        return reply.code(200).send({ message: "Review not found" });
      }

      return reply.send({
        data: updated?.id,
        message: "Review updated successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to update review");
    }
  }

  async deleteReview(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await reviewsService.deleteReview(id);

      if (!deleted) {
        throw new NotFoundError("Review not found");
      }

      return reply.send({ message: "Review deleted" });
    } catch (error) {
      req.log.error(error);
      if (error instanceof NotFoundError) throw error;
      throw new InternalServerError("Failed to delete review");
    }
  }

  async getAllReviews(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { page, limit, cursor } = req.query as { 
        page?: string; 
        limit?: string;
        cursor?: string;
      };
      const organization_id = req.user?.organization_id as string;

      const reviews = await reviewsService.getAllReviews(
        Number(page),
        Number(limit),
        organization_id,
        cursor
      );

      return reply.status(200).send(reviews);
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch reviews");
    }
  }
}
