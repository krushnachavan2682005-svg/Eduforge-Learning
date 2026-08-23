import { FastifyInstance } from "fastify";
import { verifyToken } from "../../utils/auth";
import { resumeSchema } from "./resumes.schema";
import { ResumeController } from "./resumes.controller";

const resumeController = new ResumeController();

export default async function resumeRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/resume",
    { schema: resumeSchema, preHandler: verifyToken },
    (req, reply) => resumeController.createResume(req, reply),
  );

  fastify.put(
    "/resume/user/:userId",
    { preHandler: verifyToken },
    (req, reply) => resumeController.updateResume(req, reply),
  );

  fastify.get(
    "/resume/user/:userId",
    // { preHandler: verifyToken },
    (req, reply) => resumeController.getResumeByUserId(req, reply),
  );
}
