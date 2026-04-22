import { FastifyInstance } from "fastify";
import { enrollmentSchema } from "../schemas/enrollment.schema";
import { Enrollment } from "../models/enrollment.model";
import { EnrollmentController } from "../controllers/enrollment.controller";
import { verifyToken } from "../utils/auth";
const Controller= new EnrollmentController()
type CreateEnrollmentBody = Partial<Enrollment>;

export default async function enrollmentRoutes(fastify: FastifyInstance) {
  fastify.post("/enrollment", { schema: enrollmentSchema,preHandler: verifyToken }, (req, reply) =>
    Controller.createEnrollment(req, reply)
  );

  fastify.get("/all-enrollment", { preHandler: verifyToken },(req, reply) =>
    Controller.getAllEnrollment(req, reply)
  );

  fastify.get("/enrollment/:id",{ preHandler: verifyToken }, (req, reply) =>
    Controller.getEnrollmentById(req, reply)
  );

  fastify.put("/enrollment/:id", { schema: enrollmentSchema,preHandler: verifyToken }, (req, reply) =>
    Controller.updateEnrollment(req, reply)
  );

  fastify.delete("/enrollment/:id",{ preHandler: verifyToken }, (req, reply) =>
    Controller.deleteEnrollment(req, reply)
  );
}