import { FastifyInstance } from 'fastify';
import { CompletedAssignCourseController } from '../controllers/completedAssignCourse.controller';
import { completedAssignCourseSchema } from '../schemas/completedAssignCourse.schema';
const assignCourseController = new CompletedAssignCourseController();

async function completedAssignCourseRoutes(fastify: FastifyInstance) {


 fastify.post(
  "/completed-assign-course",
  { schema: completedAssignCourseSchema },
  (req, reply) => assignCourseController.addCompletedAssignCourse(req, reply)
);

  fastify.get(
    "/user/:user_id/course/:course_id",
    (req, reply) => assignCourseController.getCompletedAssignCourse(req, reply)
  );
}

export default completedAssignCourseRoutes;
