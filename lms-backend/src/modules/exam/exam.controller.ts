import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalServerError,
  ServiceUnavailableError,
} from "../../utils/globalErrorHandlingFile";
import { FastifyReply, FastifyRequest } from "fastify";
import { v4 as uuid } from "uuid";
import { QueryTypes, UUID } from "sequelize";
import {
  IExamCreateRequest,
  IExamUpdate,
  ISaveAnswerRequest,
  ISubmitExamRequest,
  IReviewExamRequest,
  IReviewExamResponse,
  IPublicExamSubmitRequest,
} from "./exam.interface";
import {
  ExamAssignment,
  ExamUserMapping,
  ExamSession,
  ExamUserMappingPublic,
  Question,
} from "./exam.model";

import { ExamService } from "./exam.service";

const examService = new ExamService();

export class ExamController {
  async createExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as IExamCreateRequest & {
        created_by: string;
        updated_by: string;
        exam_start_time: string;
      };
      const organizationId = req.user?.organization_id as string;
      const userId = req.user?.sub as string;

      if (!organizationId) {
        return reply.code(403).send({
          success: false,
          message: "Cross-organization access is forbidden",
        });
      }

      const createdExam = await examService.createExam(
        organizationId,
        userId,
        body,
      );

      return reply.code(201).send({
        success: true,
        data: createdExam,
        message: "Exam and questions created successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async getExams(req: FastifyRequest, reply: FastifyReply) {
    try {
      const {
        page = 1,
        limit = 10,
        user_id,
      } = req.query as {
        page: number;
        limit: number;
        user_id?: string;
      };
      const organizationId = req.user?.organization_id as string;

      const { exams, total } = await examService.getExams(
        organizationId,
        Number(page) || 1,
        Number(limit) || 10,
        user_id,
      );

      return reply.send({
        success: true,
        data: exams,
        total,
        message: "Exams fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async getExamById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organization_id as string;

      const exam = await examService.getExamById(organizationId, id);
      return reply.send({
        success: true,
        data: exam,
        message: "Exam details fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async getExamsByCreator(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = req.params as { userId: string };
      const { page = 1, limit = 10 } = req.query as {
        page: number;
        limit: number;
      };
      const organizationId = req.user?.organization_id as string;

      const { exams, total } = await examService.getExamsByCreator(
        organizationId,
        userId,
        Number(page) || 1,
        Number(limit) || 10,
      );

      return reply.send({
        success: true,
        data: exams,
        total,
        message: "Exams created by user fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async updateExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organization_id as string;
      const userId = req.user?.sub as string;

      if (!organizationId) {
        return reply.code(403).send({
          success: false,
          message: "Cross-organization access is forbidden",
        });
      }

      const body = req.body as IExamUpdate & {
        updated_by: string;
        exam_start_time?: string;
      };

      const updated = await examService.updateExam(
        organizationId,
        id,
        userId,
        body,
      );

      return reply.send({
        success: true,
        data: updated,
        message: "Exam updated successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async deleteExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organization_id as string;

      await examService.deleteExam(organizationId, id);

      return reply.send({
        success: true,
        message: "Exam deleted successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async startExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id, exam_id } = req.params as {
        user_id: string;
        exam_id: string;
      };
      const organizationId = req.user?.organization_id as string;
      if (!req.user) {
        return reply
          .code(401)
          .send({ success: false, message: "Authentication required" });
      }
      if (!organizationId) {
        return reply
          .code(403)
          .send({
            success: false,
            message: "Cross-organization access is forbidden",
          });
      }
      if (req.user.sub !== user_id) {
        return reply
          .code(403)
          .send({
            success: false,
            message: "Students can only start their own assigned tests.",
          });
      }
      if (!user_id || !exam_id) {
        throw new ValidationError(
          "User ID and Exam ID are required in route parameters",
        );
      }

      const response = await examService.startExam(
        organizationId,
        user_id,
        exam_id,
      );

      return reply.send({
        success: true,
        data: response,
        message: "Exam started/resumed successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code((error as any).statusCode || 500).send({
        success: false,
        error_code: (error as any).error_code || "TEST_START_FAILED",
        message: (error as any).message || "Failed to start exam",
      });
    }
  }

  async startPublicExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { exam_id } = req.params as { exam_id: string };
      const { first_name, last_name, email } = req.body as {
        first_name: string;
        last_name: string;
        email: string;
      };

      if (!exam_id) {
        throw new ValidationError("Exam ID is required");
      }

      const data = await examService.startPublicExam(exam_id, {
        first_name,
        last_name,
        email,
      });

      return reply.send({
        success: true,
        data,
        message: "Exam fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof Error && error.message.includes("not found")) {
        throw new NotFoundError(error.message);
      }
      throw error;
    }
  }

  async savePublicExamAnswer(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { exam_id, session_id } = req.params as {
        exam_id: string;
        session_id: string;
      };

      if (!exam_id || !session_id) {
        throw new ValidationError("Exam ID and Session ID are required");
      }

      const body = req.body as IPublicExamSubmitRequest;
      if (!body.answers || !Array.isArray(body.answers)) {
        throw new ValidationError("Answers array is required");
      }

      const mergedAnswers = await examService.savePublicExamAnswer(
        exam_id,
        session_id,
        body.answers as any,
      );

      return reply.code(200).send({
        success: true,
        message: "Answer saved successfully",
        data: mergedAnswers,
      });
    } catch (err) {
      req.log.error(err);
      throw err;
    }
  }

  async resumePublicExamSession(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { session_id } = req.params as { session_id: string };
      const data = await examService.resumePublicExamSession(session_id);

      return reply.status(200).send({
        success: true,
        data,
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async submitPublicExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { exam_id, session_id } = req.params as {
        exam_id: string;
        session_id: string;
      };

      if (!exam_id || !session_id) {
        throw new ValidationError(
          "Exam ID is required & Session Id Is Required",
        );
      }

      const body = req.body as IPublicExamSubmitRequest;
      if (!body.answers || !Array.isArray(body.answers)) {
        throw new ValidationError("Answers array is required");
      }

      const data = await examService.submitPublicExam(
        exam_id,
        session_id,
        body.answers as any,
      );

      return reply.send({
        success: true,
        data,
        message: "Exam submitted successfully",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof Error && error.message.includes("not found")) {
        throw new NotFoundError(error.message);
      }
      throw error;
    }
  }

  async getPublicExamResult(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { page = "1", limit = "10" } = req.query as {
        page?: string;
        limit?: string;
      };
      const data = await examService.getPublicExamResult(
        Number(page),
        Number(limit),
      );

      return reply.send({
        success: true,
        data,
      });
    } catch (error) {
      console.error("error:", error);
      throw error;
    }
  }
  async saveAnswer(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as ISaveAnswerRequest;
      const params = req.params as { user_id: string };
      const user_id = params.user_id;

      const organizationId = req.user?.organization_id as string;
      if (!req.user)
        return reply
          .code(401)
          .send({ success: false, message: "Authentication required" });
      if (req.user.sub !== user_id) {
        return reply.code(403).send({
          success: false,
          message: "Students can only save answers for their own tests.",
        });
      }

      if (!user_id)
        throw new ValidationError("User ID is required in route parameters");

      if (
        !body.session_id ||
        !body.question_id ||
        body.user_answer === undefined ||
        body.user_answer === null ||
        body.current_question_index === undefined ||
        body.current_question_index < 0
      ) {
        throw new ValidationError(
          "Session ID, Question ID, user answer, and valid current question index are required",
        );
      }

      const response = await examService.saveAnswer(
        organizationId,
        user_id,
        body.session_id,
        body.question_id,
        body.user_answer,
        body.current_question_index,
      );

      const responseData = {
        success: true,
        current_question_index: response.session.current_question_index,
        is_exam_complete: response.isExamComplete,
        session_id: body.session_id,
        user_answer: body.user_answer,
        question_id: body.question_id,
        saved_answers: response.session.answers_data?.answers || [],
      };

      return reply.send({
        success: true,
        data: responseData,
        message: "Answer saved successfully",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof Error) {
        const lowerCaseMessage = error.message.toLowerCase();
        if (lowerCaseMessage.includes("not found"))
          throw new NotFoundError(error.message);
        if (
          lowerCaseMessage.includes("already completed") ||
          lowerCaseMessage.includes("invalid question index")
        )
          throw new ValidationError(error.message);
      }
      throw error;
    }
  }

  async submitExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as ISubmitExamRequest;
      const params = req.params as { user_id: string };
      const user_id = params.user_id;

      const organizationId = req.user?.organization_id as string;
      if (!req.user)
        return reply
          .code(401)
          .send({ success: false, message: "Authentication required" });
      if (req.user.sub !== user_id) {
        return reply.code(403).send({
          success: false,
          message: "Students can only submit their own tests.",
        });
      }

      if (!body.session_id) throw new ValidationError("Session ID is required");

      const submissionResult = await examService.submitExam(
        organizationId,
        user_id,
        body.session_id,
      );

      if (submissionResult.alreadyCompleted) {
        return reply.code(200).send({
          success: true,
          message: "Exam was already submitted successfully",
        });
      }

      let message = "Exam submitted successfully.";
      if (submissionResult.mapping?.review_status === "pending_review")
        message = "Exam submitted successfully, pending review.";
      else if (submissionResult.mapping?.review_status === "completed")
        message = "Exam submitted and graded successfully.";

      return reply.code(201).send({
        success: true,
        data: {
          review_status: submissionResult.mapping?.review_status,
          summary: submissionResult.summary,
        },
        message,
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async getExamResults(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { session_id } = req.query as { session_id: string };
      const params = req.params as { user_id: string };
      const user_id = params.user_id;
      const organizationId = req.user?.organization_id as string;

      if (!session_id) throw new ValidationError("Session ID is required");

      const results = await examService.getExamResults(
        organizationId,
        user_id,
        session_id,
      );
      return reply.send({
        success: true,
        data: results,
        message: "Exam results fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async reviewExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { session_id } = req.params as { session_id: string };
      const body = req.body as Omit<IReviewExamRequest, "session_id">;
      const organizationId = req.user?.organization_id as string;

      if (!session_id)
        throw new ValidationError(
          "Session ID is required in route parameters.",
        );

      const reviewData: IReviewExamRequest = {
        session_id,
        reviewed_answers: body.reviewed_answers,
        ...((body as any).reviewers
          ? { reviewers: (body as any).reviewers }
          : {}),
      };

      const reviewResult = await examService.reviewExam(
        organizationId,
        session_id,
        reviewData,
      );
      return reply.code(200).send({
        success: true,
        data: reviewResult,
        message: "Exam reviewed and results updated successfully.",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof Error) {
        if (error.message.includes("not found"))
          throw new NotFoundError(error.message);
        if (error.message.includes("not authorized"))
          throw new ForbiddenError(error.message);
      }
      throw error;
    }
  }

  async assignExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const organizationId = req.user?.organization_id as string;
      if (!organizationId) {
        return reply.code(403).send({
          success: false,
          message: "Cross-organization access is forbidden",
        });
      }

      const { exam_id, user_id, class_id } = req.body as {
        exam_id: string[];
        user_id?: string[];
        class_id?: string | string[];
      };

      const classIds = class_id
        ? Array.isArray(class_id)
          ? class_id
          : [class_id]
        : [];

      const assignments = await examService.assignExam(
        organizationId,
        exam_id,
        user_id || [],
        classIds,
      );

      return reply.code(201).send({
        success: true,
        message: `${assignments.length} assignment(s) created successfully.`,
        data: assignments,
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async getAssignedExams(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id } = req.params as { user_id: string };
      const { page = "1", limit = "10" } = req.query as {
        page?: string;
        limit?: string;
      };

      if (!req.user)
        return reply
          .code(401)
          .send({ success: false, message: "Authentication required" });
      if (req.user.sub !== user_id) {
        return reply.code(403).send({
          success: false,
          message: "Students can only view their own assigned tests.",
        });
      }

      const pageNum = Number(page) > 0 ? Number(page) : 1;
      const limitNum = Number(limit) > 0 ? Number(limit) : 10;
      const organizationId = req.user?.organization_id as string;

      const { items: exams, pagination } = await examService.getAssignedExams(
        organizationId,
        user_id,
        pageNum,
        limitNum,
      );

      return reply.code(200).send({
        success: true,
        data: exams,
        pagination,
        message: "Assigned exams fetched successfully.",
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async publishAssignedExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { assigned_id, assignment_id, user_id, publish } = req.body as {
        assigned_id: string;
        assignment_id: string;
        user_id: string;
        publish: boolean;
      };

      if (!assigned_id || !assignment_id || !user_id) {
        throw new ValidationError(
          "assigned_id, assignment_id and user_id are required",
        );
      }

      await examService.publishAssignedExam(
        assigned_id,
        assignment_id,
        user_id,
        publish,
      );

      return reply.code(201).send({
        message: "Publish status recorded",
        data: { assigned_id, assignment_id, publish },
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async getAssignedExamPublishTimeline(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { user_id } = req.params as { user_id?: string };
      const organizationId = req.user?.organization_id as string;
      const timeline = await examService.getAssignedExamPublishTimeline(
        organizationId,
        user_id,
      );

      return reply.code(200).send({
        data: timeline,
        message: "Publish timeline fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async getReviewerDashboard(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { reviewer_id } = req.params as { reviewer_id: string };
      const exams = await examService.getReviewerDashboard(reviewer_id);

      return reply.code(200).send({
        success: true,
        data: exams,
        message: "Reviewer dashboard exams fetched successfully.",
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async getSubmissionForReview(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id, session_id } = req.params as {
        user_id: string;
        session_id: string;
      };
      if (!user_id || !session_id)
        throw new ValidationError("User ID and Session ID are required.");

      const organizationId = req.user?.organization_id as string;
      const submission = await examService.getSubmissionForReview(
        organizationId,
        user_id,
        session_id,
      );
      return reply.code(200).send({
        success: true,
        data: submission,
        message: "Submission details fetched successfully for review.",
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }

  async getStudentExamReview(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id, exam_id } = req.params as {
        user_id: string;
        exam_id: string;
      };

      const organization_id = req.user?.organization_id as string;
      if (!user_id || !exam_id || !organization_id)
        throw new ValidationError(
          "User ID, Exam ID, and Client ID are required.",
        );
      if (!req.user)
        return reply
          .code(401)
          .send({ success: false, message: "Authentication required" });
      if (req.user.sub !== user_id) {
        return reply.code(403).send({
          success: false,
          message: "Students can only view their own test review.",
        });
      }

      const review = await examService.getStudentExamReview(
        organization_id,
        user_id,
        exam_id,
      );

      return reply.code(200).send({
        success: true,
        data: review,
        message: "Student exam review fetched successfully.",
      });
    } catch (error) {
      req.log.error(error);
      throw error;
    }
  }
}
