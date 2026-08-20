import { FastifyInstance } from "fastify";
import { verifyToken } from "../../utils/auth";
import { levelSchema } from "./level.schema";
import { LevelController } from "./level.controller";

const Controller = new LevelController();

export default async function levelRoute(fastify: FastifyInstance) {
  fastify.post(
    "/level",
    { schema: levelSchema, preHandler: verifyToken },
    (req, reply) => Controller.createLevel(req, reply)
  );

  fastify.get(
    "/level",
    { preHandler: verifyToken },
    (req, reply) => Controller.getAllLevels(req, reply)
  );

  fastify.get(
    "/level/:id",
    { preHandler: verifyToken },
    (req, reply) => Controller.getLevelById(req, reply)
  );

  fastify.put(
    "/level/:id",
    { schema: levelSchema, preHandler: verifyToken },
    (req, reply) => Controller.updateLevel(req, reply)
  );

  fastify.delete(
    "/level/:id",
    { preHandler: verifyToken },
    (req, reply) => Controller.deleteLevel(req, reply)
  );
}
