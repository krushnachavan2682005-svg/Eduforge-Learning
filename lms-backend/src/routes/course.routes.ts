import { FastifyInstance } from "fastify";
import { CourseController } from "../controllers/course.controller";
import { CourseRepository } from "../repositories/course.repository";
import {
  createCourseSchema,
  updateCourseSchema,
} from "../schemas/course.schema";
import { Course } from "../models/course.model";
import { verifyToken } from "../utils/auth";

const courseController = new CourseController();
type ClientParams = { client_id: string };
type ClientIdParams = { client_id: string; id: string };
type CreateCourseBody = Partial<Course>;

export default async function courseRoutes(fastify: FastifyInstance) {
  // CourseRepository.initialize(fastify);
  fastify.post(
    "/course",
    { schema: createCourseSchema, preHandler: verifyToken },
    (req, reply) => courseController.createCourse(req, reply)
  );

  fastify.get("/all-courses", { preHandler: verifyToken }, (req, reply) =>
    courseController.getAllCourses(req, reply)
  );

  fastify.get("/course/:id", { preHandler: verifyToken }, (req, reply) =>
    courseController.getCourse(req, reply)
  );

  fastify.put(
    "/course/:id",
    { schema: updateCourseSchema, preHandler: verifyToken },
    (req, reply) => courseController.updateCourse(req, reply)
  );

  fastify.delete("/courses/:id", { preHandler: verifyToken }, (req, reply) =>
    courseController.deleteCourse(req, reply)
  );

  fastify.post("/courses/:id", (req, reply) =>
    courseController.courceImageUpload(req, reply)
  );
}
