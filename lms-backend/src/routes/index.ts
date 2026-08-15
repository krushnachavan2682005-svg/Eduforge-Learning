import { FastifyInstance, FastifyPluginOptions } from "fastify";
import courseRoutes from "./course.routes";
import sectionRoutes from "./section.routes";
import lessonRoutes from "./lesson.routes";
import enrollmentRoutes from "./enrollment.routes";
import quizRoutes from "./quizze.routes";
import reviewsRoutes from "./reviews.routes";
import assignCourseRoutes from "./assignCourse.route";
import completedAssignCourseRoutes from "./completedAssignCourse.routes";
import resumeRoutes from "./resumes.route";
import examRoutes from "./exam.routes";
import actionItemsRoute from "./actionItems.route";
import assignActionItemsRoutes from "./assignActionItems.route";
import uploadRoutes from "./upload.routes";
// import creditRoutes from "./credit.route";
import levelRoute from "./level.route";
import studentResultsRoutes from "./studentResults.route";
import dashboardRoutes from "./dashboard.routes";

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
