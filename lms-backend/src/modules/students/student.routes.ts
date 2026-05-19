import { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/auth.middleware";
import { StudentController } from "./student.controller";

const controller = new StudentController();

export default async function studentRoutes(fastify: FastifyInstance) {
  fastify.post("/students", { preHandler: authenticate }, (req, reply) =>
    controller.createStudent(req, reply),
  );
  fastify.get("/students", { preHandler: authenticate }, (req, reply) =>
    controller.listStudents(req, reply),
  );
  fastify.get("/students/:id", { preHandler: authenticate }, (req, reply) =>
    controller.getStudent(req, reply),
  );

  fastify.post("/classes", { preHandler: authenticate }, (req, reply) =>
    controller.createClass(req, reply),
  );
  fastify.get("/classes", { preHandler: authenticate }, (req, reply) =>
    controller.listClasses(req, reply),
  );
  fastify.post(
    "/classes/:class_id/students/:student_id",
    { preHandler: authenticate },
    (req, reply) => controller.addStudentToClass(req, reply),
  );

  fastify.post("/enrollments", { preHandler: authenticate }, (req, reply) =>
    controller.createEnrollment(req, reply),
  );
  fastify.get(
    "/enrollments/student/:student_id",
    { preHandler: authenticate },
    (req, reply) => controller.getStudentEnrollments(req, reply),
  );
}
