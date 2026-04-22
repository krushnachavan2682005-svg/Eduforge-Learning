import { FastifyInstance } from "fastify";
import { ExamController } from "../controllers/examcontroller";
const Controller = new ExamController();
export default async function publicExamRoutes(fastify: FastifyInstance) {
  // Public exam access (no user id required) – fetch questions directly
  fastify.post(
    "/exams/:exam_id/public",
    // { schema: publicExamStartSchema },
    (req, reply) => Controller.startPublicExam(req, reply),
  );

  // Public submission endpoint that grades MCQ exams immediately
  fastify.post(
    "/exams/:exam_id/public/:session_id/submit",
    // { schema: publicExamSubmitSchema },
    (req, reply) => Controller.submitPublicExam(req, reply),
  );
  //resume the public exam
  fastify.get("/exams/:session_id/resume/public", (req, reply) =>
    Controller.resumePublicExamSession(req, reply),
  );
  //save answer on each click
  fastify.put("/exams/:exam_id/public/:session_id/answer", (req, reply) =>
    Controller.savePublicExamAnswer(req, reply),
  );
  // Get Public submission Exam
  fastify.get("/public/results", (req, reply) =>
    Controller.getPublicExamResult(req, reply),
  );
}
