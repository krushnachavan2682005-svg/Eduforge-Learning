import { FastifyInstance } from "fastify";
import { CourseController } from "../controllers/course.controller";
import { CourseRepository } from "../repositories/course.repository";
import {
  createCourseSchema,
  updateCourseSchema,
} from "../schemas/course.schema";
import { Course } from "../models/course.model";
import { verifyToken } from "../utils/auth";
import { requirePermission } from "../middleware/rbac.middleware";

const courseController = new CourseController();

type CreateCourseBody = Partial<Course>;

export default async function courseRoutes(fastify: FastifyInstance) {
  // CourseRepository.initialize(fastify);
  fastify.post(
    "/course",
    { schema: createCourseSchema, preHandler: requirePermission("COURSE_CREATE") },
    (req, reply) => courseController.createCourse(req, reply)
  );

  fastify.get("/all-courses", 
    { preHandler: verifyToken },
     (req, reply) =>
    courseController.getAllCourses(req, reply)
  );

  fastify.get("/course/:id", { preHandler: verifyToken }, (req, reply) =>
    courseController.getCourse(req, reply)
  );

  fastify.put(
    "/course/:id",
    { schema: updateCourseSchema, preHandler: requirePermission("COURSE_UPDATE") },
    (req, reply) => courseController.updateCourse(req, reply)
  );

  fastify.delete("/courses/:id", { preHandler: requirePermission("COURSE_DELETE") }, (req, reply) =>
    courseController.deleteCourse(req, reply)
  );

  fastify.post("/courses/:id", (req, reply) =>
    courseController.courceImageUpload(req, reply)
  );
}
