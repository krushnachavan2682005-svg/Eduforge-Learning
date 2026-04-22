import { FastifyInstance } from "fastify";
import { verifyToken } from "../utils/auth";
import { resumeSchema } from "../schemas/resumes.schema";
import { ResumeController } from "../controllers/resumes.contrroller";

const resumeController = new ResumeController();

export default async function resumeRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/resume",
    { schema: resumeSchema, preHandler: verifyToken },
    (req, reply) => resumeController.createResume(req, reply)
  );

  fastify.put(
    "/resume/user/:userId",
    { preHandler: verifyToken },
    (req, reply) => resumeController.updateResume(req, reply)
  );

  fastify.get(
    "/resume/user/:userId",
    // { preHandler: verifyToken },
    (req, reply) => resumeController.getResumeByUserId(req, reply)
  );

}
