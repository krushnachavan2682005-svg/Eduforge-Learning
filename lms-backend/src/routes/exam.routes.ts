import { FastifyInstance } from "fastify";
import { ExamController } from "../controllers/examcontroller";
import {
  createFullExamSchema,
  updateFullExamSchema,
  saveAnswerSchema,
  submitExamSchema,
  reviewExamSchema,
  assignExamSchema,
  getSubmissionForReviewSchema,
  publicExamStartSchema,
  publicExamSubmitSchema,
  startExamSchema,
} from "../schemas/exam.schema";
import { verifyToken } from "../utils/auth";
import { requirePermission } from "../middleware/rbac.middleware";

const Controller = new ExamController();

export default async function examRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/exams",
    { schema: createFullExamSchema, preHandler: requirePermission("EXAM_CREATE") },
    (req, reply) => Controller.createExam(req, reply),
  );

  fastify.get(
    "/all-exams",
    // { preHandler: verifyToken },
    (req, reply) => Controller.getExams(req, reply),
  );

  fastify.get("/exam/:id", { preHandler: verifyToken }, (req, reply) =>
    Controller.getExamById(req, reply),
  );

  // Get all exams created by a specific user
  fastify.get(
    "/exams/created-by/:userId",
    // { preHandler: verifyToken },
    (req, reply) => Controller.getExamsByCreator(req, reply),
  );

  fastify.put(
    "/exam/:id",
    { schema: updateFullExamSchema, preHandler: requirePermission("EXAM_UPDATE") },
    (req, reply) => Controller.updateExam(req, reply),
  );

  fastify.delete("/exam/:id", { preHandler: requirePermission("EXAM_DELETE") }, (req, reply) =>
    Controller.deleteExam(req, reply),
  );

  // Start a new exam session for an assigned user
  fastify.get(
    "/exams/:exam_id/start/:user_id",
    // { schema: startExamSchema },
    // { preHandler: verifyToken },
    (req, reply) => Controller.startExam(req, reply),
  );

  // Save answer and get next question
  fastify.post(
    "/exam/:user_id/save-answer",
    { schema: saveAnswerSchema, preHandler: verifyToken },
    (req, reply) => Controller.saveAnswer(req, reply),
  );

  // Get exam progress
  // fastify.get(
  //   "/exam/progress/:user_id",
  //   { schema: examProgressSchema, preHandler: verifyToken },
  //   (req, reply) => Controller.getExamProgress(req, reply)
  // );

  // Submit exam and get results
  fastify.post(
    "/exam/submit/:user_id",
    { schema: submitExamSchema, preHandler: verifyToken },
    (req, reply) => Controller.submitExam(req, reply),
  );

  // Get student's exam review by exam_id
  fastify.get(
    "/exam/:exam_id/review_student_id/:user_id",
    { 
      preHandler: verifyToken
    },
    (req, reply) => Controller.getStudentExamReview(req, reply)
  );

  // Get exam results
  fastify.get(
    "/exam/results/:user_id",
    { preHandler: verifyToken },
    (req, reply) => Controller.getExamResults(req, reply),
  );

  // Review an exam (for practical questions)
  fastify.put(
    "/exam/review/:session_id",
    { schema: reviewExamSchema, preHandler: verifyToken },
    (req, reply) => Controller.reviewExam(req, reply),
  );

  // Assign an exam to a user
  fastify.post(
    "/exams/assign",
    { schema: assignExamSchema, preHandler: requirePermission("EXAM_ASSIGN") },
    (req, reply) => Controller.assignExam(req, reply),
  );

  // Get all exams assigned to a specific user
  fastify.get(
    "/assigned-exams/:user_id",
    // { preHandler: verifyToken },
    (req, reply) => Controller.getAssignedExams(req, reply),
  );

  // Get all exams for a reviewer's dashboard that are fully submitted
  fastify.get(
    "/reviewer-dashboard/:reviewer_id",
    { preHandler: verifyToken },
    (req, reply) => Controller.getReviewerDashboard(req, reply),
  );

  // Get a user's submission for review
  fastify.get(
    "/submission/user/:user_id/session/:session_id",
    { schema: getSubmissionForReviewSchema, preHandler: verifyToken },
    (req, reply) => Controller.getSubmissionForReview(req, reply),
  );

}
