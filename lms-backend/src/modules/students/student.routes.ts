import { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/rbac.middleware";
import { StudentController } from "./student.controller";

const controller = new StudentController();

export default async function studentRoutes(fastify: FastifyInstance) {
  fastify.post("/students", { preHandler: requirePermission("STUDENT_CREATE") }, (req, reply) =>
    controller.createStudent(req, reply),
  );
  fastify.get("/students", { preHandler: requirePermission("STUDENT_VIEW") }, (req, reply) =>
    controller.listStudents(req, reply),
  );
  fastify.get("/students/:id", { preHandler: requirePermission("STUDENT_VIEW") }, (req, reply) =>
    controller.getStudent(req, reply),
  );

  fastify.post("/classes", { preHandler: requirePermission("CLASS_CREATE") }, (req, reply) =>
    controller.createClass(req, reply),
  );
  fastify.get("/classes", { preHandler: requirePermission("STUDENT_VIEW") }, (req, reply) =>
    controller.listClasses(req, reply),
  );
  fastify.post(
    "/classes/:class_id/students/:student_id",
    { preHandler: requirePermission("CLASS_CREATE") },
    (req, reply) => controller.addStudentToClass(req, reply),
  );

  fastify.post("/enrollments", { preHandler: requirePermission("ENROLLMENT_CREATE") }, (req, reply) =>
    controller.createEnrollment(req, reply),
  );
  fastify.get(
    "/enrollments/student/:student_id",
    { preHandler: requirePermission("STUDENT_VIEW") },
    (req, reply) => controller.getStudentEnrollments(req, reply),
  );
}
