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
      return reply.status(500).send({
        message: "Failed to fetch review",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async createReview(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as ReviewsInterface;
      const { client_id } = req.params as { client_id: string };
      const data = { ...body, client_id };
      const review = await reviewRepo.createReview(data);
      return reply.code(201).send({
        data: { id: review?.id },
        message: "Review created successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to create review",
        error: error instanceof Error ? error.message : String(error),
      });
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
      return reply.status(500).send({
        message: "Failed to update review",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async deleteReview(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const deleted = await reviewRepo.deleteReview(id);

      if (!deleted) {
        return reply.code(404).send({ message: "Review not found" });
      }

      return reply.send({ message: "Review deleted" });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to delete review",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }


  async getAllReviews(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };
      const { page, limit } = req.query as { page?: string; limit?: string };

      const reviews = await reviewRepo.getAllReviews(
        Number(page),
        Number(limit),
        { client_id }
      );

      return reply.status(200).send(reviews);
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        message: "Failed to fetch reviews",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
