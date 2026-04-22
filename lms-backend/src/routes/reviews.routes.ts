import { FastifyInstance } from "fastify";
import { ReviewSchema } from "../schemas/reviews.schema"; // Import combined schema
import { ReviewsController } from "../controllers/reviews.controller";

const reviewsController = new ReviewsController();

export default async function reviewRoutes(fastify: FastifyInstance) {
  fastify.post("/api/reviews", ReviewSchema, (req, reply) =>
    reviewsController.createReview(req, reply)
  );

  fastify.get("/api/reviews", (req, reply) =>
    reviewsController.getAllReviews(req, reply)
  );

  fastify.get("/api/reviews/:id", (req, reply) =>
    reviewsController.getReview(req, reply)
  );

  fastify.put("/api/reviews/:id", ReviewSchema, (req, reply) =>
    reviewsController.updateReview(req, reply)
  );

  fastify.delete("/api/reviews/:id", (req, reply) =>
    reviewsController.deleteReview(req, reply)
  );
}
