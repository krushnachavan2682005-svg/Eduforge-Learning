import { FastifyInstance, FastifyPluginOptions } from "fastify";
import courseRoutes from "../modules/course/course.routes";
import sectionRoutes from "../modules/section/section.routes";
import lessonRoutes from "../modules/lesson/lesson.routes";
import enrollmentRoutes from "../modules/enrollment/enrollment.routes";
import quizRoutes from "../modules/quizze/quizze.routes";
import reviewsRoutes from "../modules/reviews/reviews.routes";
import assignCourseRoutes from "../modules/assignCourse/assignCourse.routes";
import completedAssignCourseRoutes from "../modules/completedAssignCourse/completedAssignCourse.routes";
import resumeRoutes from "../modules/resumes/resumes.routes";
import examRoutes from "../modules/exam/exam.routes";
import actionItemsRoute from "../modules/actionItems/actionItems.routes";
import assignActionItemsRoutes from "../modules/assignActionItems/assignActionItems.routes";
import uploadRoutes from "../modules/upload/upload.routes";
// import creditRoutes from "./credit.route";
import levelRoute from "../modules/level/level.routes";
import studentResultsRoutes from "../modules/studentResults/studentResults.routes";
import { dashboardRoutes } from "../modules/dashboard/dashboard.routes";

export default async function routes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
) {
  fastify.get("/health", async (request, reply) => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });
  fastify.addHook("onRoute", (routeOptions) => { });
  fastify.register(uploadRoutes);
  fastify.register(courseRoutes);
  fastify.register(lessonRoutes);
  fastify.register(sectionRoutes);
  fastify.register(assignCourseRoutes);
  fastify.register(completedAssignCourseRoutes);
  fastify.register(resumeRoutes);
  fastify.register(examRoutes);
  fastify.register(actionItemsRoute);
  fastify.register(assignActionItemsRoutes);
  fastify.register(levelRoute);
  fastify.register(studentResultsRoutes);
  fastify.register(dashboardRoutes);
}
