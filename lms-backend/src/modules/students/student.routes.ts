import { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/rbac.middleware";
import { StudentController } from "./student.controller";

const controller = new StudentController();

export default async function studentRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/students",
    { preHandler: requirePermission("STUDENT_CREATE") },
    (req, reply) => controller.createStudent(req, reply),
  );
  fastify.get(
    "/students",
    { preHandler: requirePermission("STUDENT_VIEW") },
    (req, reply) => controller.listStudents(req, reply),
  );
  fastify.get(
    "/students/:id",
    { preHandler: requirePermission("STUDENT_VIEW") },
    (req, reply) => controller.getStudent(req, reply),
  );

  fastify.post(
    "/classes",
    { preHandler: requirePermission("CLASS_CREATE") },
    (req, reply) => controller.createClass(req, reply),
  );
  fastify.get(
    "/classes",
    { preHandler: requirePermission("STUDENT_VIEW") },
    (req, reply) => controller.listClasses(req, reply),
  );
  fastify.get(
    "/classes/:id",
    { preHandler: requirePermission("STUDENT_VIEW") },
    (req, reply) => controller.getClass(req, reply),
  );
  fastify.get(
    "/classes/:id/students",
    { preHandler: requirePermission("STUDENT_VIEW") },
    (req, reply) => controller.getClassStudents(req, reply),
  );
  fastify.post(
    "/classes/:class_id/students/:student_id",
    { preHandler: requirePermission("CLASS_CREATE") },
    (req, reply) => controller.addStudentToClass(req, reply),
  );
  fastify.delete(
    "/classes/:class_id/students/:student_id",
    { preHandler: requirePermission("CLASS_UPDATE") },
    (req, reply) => controller.removeStudentFromClass(req, reply),
  );

  fastify.post(
    "/enrollments",
    { preHandler: requirePermission("ENROLLMENT_CREATE") },
    (req, reply) => controller.createEnrollment(req, reply),
  );
  fastify.get(
    "/enrollments",
    { preHandler: requirePermission("STUDENT_VIEW") },
    (req, reply) => controller.listEnrollments(req, reply),
  );
  fastify.get(
    "/enrollments/student/:student_id",
    { preHandler: requirePermission("STUDENT_VIEW") },
    (req, reply) => controller.getStudentEnrollments(req, reply),
  );
  fastify.get(
    "/enrollments/:id",
    { preHandler: requirePermission("STUDENT_VIEW") },
    (req, reply) => controller.getEnrollment(req, reply),
  );
  fastify.patch(
    "/enrollments/:id/status",
    { preHandler: requirePermission("ENROLLMENT_UPDATE") },
    (req, reply) => controller.updateEnrollmentStatus(req, reply),
  );
}
