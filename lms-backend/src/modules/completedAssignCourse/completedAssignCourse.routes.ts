import { FastifyInstance } from 'fastify';
import { CompletedAssignCourseController } from './completedAssignCourse.controller';
import { completedAssignCourseSchema } from './completedAssignCourse.schema';
import { verifyToken } from '../../utils/auth';

const assignCourseController = new CompletedAssignCourseController();

async function completedAssignCourseRoutes(fastify: FastifyInstance) {
 fastify.post(
  "/completed-assign-course",
  { schema: completedAssignCourseSchema, preHandler: verifyToken },
  (req, reply) => assignCourseController.addCompletedAssignCourse(req, reply)
);

  fastify.get(
    "/user/:user_id/course/:course_id",
    { preHandler: verifyToken },
    (req, reply) => assignCourseController.getCompletedAssignCourse(req, reply)
  );
}

export default completedAssignCourseRoutes;
