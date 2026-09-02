import { FastifyInstance } from "fastify";
import { ReviewSchema } from "./reviews.schema"; // Import combined schema
import { ReviewsController } from "./reviews.controller";
import { verifyToken } from "../../utils/auth";

const reviewsController = new ReviewsController();

export default async function reviewRoutes(fastify: FastifyInstance) {
  fastify.post("/reviews", { ...ReviewSchema, preHandler: verifyToken }, (req, reply) =>
    reviewsController.createReview(req, reply),
  );

  fastify.get("/reviews", { preHandler: verifyToken }, (req, reply) =>
    reviewsController.getAllReviews(req, reply),
  );

  fastify.get("/reviews/:id", { preHandler: verifyToken }, (req, reply) =>
    reviewsController.getReview(req, reply),
  );

  fastify.put("/reviews/:id", { ...ReviewSchema, preHandler: verifyToken }, (req, reply) =>
    reviewsController.updateReview(req, reply),
  );

  fastify.delete("/reviews/:id", { preHandler: verifyToken }, (req, reply) =>
    reviewsController.deleteReview(req, reply),
  );
}
