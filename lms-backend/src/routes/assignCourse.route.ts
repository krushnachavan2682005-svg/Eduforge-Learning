import { FastifyInstance } from "fastify";
import { AssiginCourseController } from "../controllers/assignCourse.controller";
// import { AssiginCourseController } from "@src/controllers/assignCourse.controller";
import { assignCourse } from "../schemas/assignCourse.schema";
import { AssignedCourseModel } from "../models/assignCourse.model";
import { verifyToken } from "../utils/auth";

const assignCourseController = new AssiginCourseController();
type ClientParams = { client_id: string };
type ClientIdParams = { client_id: string; id: string };
type CreateCourseBody = Partial<AssignedCourseModel>;

export default async function assignCourseRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/assign-course",
    { schema: assignCourse, preHandler: verifyToken },
    (req, reply) => assignCourseController.createAssiginCourse(req, reply)
  );

  fastify.get(
    "/get-assigned-course-byuser/:user_id",
    { preHandler: verifyToken },
    (req, reply) => assignCourseController.getCourseByUserId(req, reply)
  );

  fastify.get(
    "/get-course-by-id/:course_id",
    { preHandler: verifyToken },
    (req, reply) => assignCourseController.getCourse(req, reply)
  );
}
