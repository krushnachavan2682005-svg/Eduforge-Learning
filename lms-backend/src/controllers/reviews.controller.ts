import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, ServiceUnavailableError } from "../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { ReviewsRepository } from "../repositories/reviews.repository";
import { ReviewsInterface } from "../interfaces/reviews.interface";
import { Reviews } from "../models/reviews.model";
const reviewRepo = new ReviewsRepository();

export class ReviewsController {
  async getReview(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const review = await reviewRepo.getReviewById(id);
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
      const data = { ...body, organization_id: req.user?.organization_id as string };
      const review = await reviewRepo.createReview(data);
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

      const updated = await reviewRepo.updateReview(id, body);

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
      const deleted = await reviewRepo.deleteReview(id);

      if (!deleted) {
        throw new NotFoundError("Review not found");
      }

      return reply.send({ message: "Review deleted" });
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to delete review");
    }
  }


  async getAllReviews(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { page, limit } = req.query as { page?: string; limit?: string };

      const reviews = await reviewRepo.getAllReviews(
        Number(page),
        Number(limit),
        { organization_id: req.user?.organization_id as string }
      );

      return reply.status(200).send(reviews);
    } catch (error) {
      req.log.error(error);
      throw new InternalServerError("Failed to fetch reviews");
    }
  }
}
