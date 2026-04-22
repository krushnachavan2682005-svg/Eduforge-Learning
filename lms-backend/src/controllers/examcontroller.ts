import { FastifyReply, FastifyRequest } from "fastify";
import { v4 as uuid } from "uuid";
import { ExamRepository } from "../repositories/exam.repository";
import { QueryTypes, UUID } from "sequelize";
import { externalDB } from "../config/database";
import {
  IExamCreateRequest,
  IExamUpdate,
  ISaveAnswerRequest,
  ISubmitExamRequest,
  IReviewExamRequest,
  IReviewExamResponse,
  IPublicExamSubmitRequest,
} from "../interfaces/exam.interface";
import {
  ExamAssignment,
  ExamSession,
  ExamUserMappingPublic,
  Question,
} from "../models/exam.model";

const repository = new ExamRepository();

export class ExamController {
  async createExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as IExamCreateRequest & {
        created_by: string;
        updated_by: string;
        exam_start_time: string;
      };
      const { client_id } = req.params as { client_id: string };

      const examData = { ...body, client_id } as IExamCreateRequest & {
        client_id: string;
        created_by: string;
        updated_by: string;
      };

      const createdExam = await repository.createFullExam(examData);

      return reply.code(201).send({
        success: true,
        data: createdExam,
        message: "Exam and questions created successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to create exam",
        error: error instanceof Error ? error.message : String(error),
      });
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
      const skip = (page - 1) * limit;
      const { exams, total } = await repository.getAllExams(
        limit,
        skip,
        user_id,
      );

      return reply.send({
        success: true,
        data: exams,
        total,
        message: "Exams fetched successfully",
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        message: "Failed to fetch exams",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getExamById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const exam = await repository.getExamById(id);
      if (!exam)
        return reply
          .code(404)
          .send({ success: false, message: "Exam not found" });
      return reply.send({
        success: true,
        data: exam,
        message: "Exam details fetched successfully",
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        message: "Failed to fetch exam details",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getExamsByCreator(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = req.params as { userId: string };
      const { page = 1, limit = 10 } = req.query as {
        page: number;
        limit: number;
      };
      const skip = (page - 1) * limit;

      const { exams, total } = await repository.getExamsByCreator(
        userId,
        limit,
        skip,
      );

      return reply.send({
        success: true,
        data: exams,
        total,
        message: "Exams created by user fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to fetch exams",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async updateExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, id } = req.params as { client_id: string; id: string };
      const body = req.body as IExamUpdate & {
        updated_by: string;
        exam_start_time?: string;
      };
      const updated = await repository.updateExam(id, { ...body, client_id });
      return reply.send({
        success: true,
        data: updated,
        message: "Exam updated successfully",
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        message: "Failed to update exam",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async deleteExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };

      const success = await repository.deleteExam(id);
      if (!success)
        return reply
          .code(404)
          .send({ success: false, message: "Exam not found" });
      return reply.send({
        success: true,
        message: "Exam deleted successfully",
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        message: "Failed to delete exam",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async startExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id, user_id, exam_id } = req.params as {
        client_id: string;
        user_id: string;
        exam_id: string;
      };
      if (!user_id || !exam_id)
        return reply.code(400).send({
          success: false,
          message: "User ID and Exam ID are required in route parameters",
        });

      // Verify that the exam is assigned to the user
      const assignment = await ExamAssignment.findOne({
        where: {
          exam_id: exam_id,
          user_id: user_id,
        },
      });
      if (!assignment)
        return reply.code(403).send({
          success: false,
          message: "Access denied. This exam is not assigned to the user.",
        });

      const exam = await repository.getExamById(exam_id);
      const questions = (exam as any).questions || [];
      if (questions.length === 0)
        return reply
          .code(400)
          .send({ success: false, message: "Exam has no questions" });

      const session = await repository.startExamSession({
        exam_id,
        user_id,
        client_id,
        current_question_index: 0,
        reviewers: (exam as any).reviewers || [],
      });
      const currentQuestion = questions[session.current_question_index];

      const response = {
        session_id: session.id!,
        current_question_index: session.current_question_index,
        total_questions: questions.length,
        current_question: currentQuestion,
        exam_details: exam,
        saved_answers: session?.answers_data || [],
      };

      return reply.send({
        success: true,
        data: response,
        message: "Exam started successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to start exam",
        error: error instanceof Error ? error.message : String(error),
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
        return reply.code(400).send({
          success: false,
          message: "Exam ID is required",
        });
      }

      // 🔹 Fetch exam
      const exam = await repository.getExamById(exam_id);
      const questions = (exam as any).questions || [];
      const examQuestionCheck = await Question.findAll({ where: { exam_id } });

      const hasNonMcq = examQuestionCheck.some((q) => q.type !== "mcq");
      if (hasNonMcq) {
        return reply.status(400).send({
          success: false,
          message: "For Public Exam only MCQ is allowed",
        });
      }

      //  Generate session_id correctly
      const session_id = uuid();

      //  Create session in DB
      const name =
        [first_name, last_name].filter((v) => v && v.trim() !== "").join(" ") ||
        null;
      await repository.createPublicExamSession({
        exam_id,
        session_id,
        started_at: new Date(),
        is_completed: false,
        name,
        email,
      });

      return reply.send({
        success: true,
        data: {
          exam_details: exam,
          session_id,
        },
        message: "Exam fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof Error && error.message.includes("not found")) {
        return reply.code(404).send({ success: false, message: error.message });
      }
      return reply.code(500).send({
        success: false,
        message: "Failed to fetch public exam",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
async savePublicExamAnswer(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { exam_id, session_id } = req.params as {
        exam_id: string;
        session_id: string;
      };

      if (!exam_id || !session_id) {
        return reply.code(400).send({
          success: false,
          message: "Exam ID and Session ID are required",
        });
      }

      const session = await ExamUserMappingPublic.findOne({
        where: { exam_id, session_id },
      });

      if (!session) {
        return reply.status(400).send({
          success: false,
          message: "Exam_id or Session_id not match",
        });
      }

      const body = req.body as IPublicExamSubmitRequest;

      if (!body.answers || !Array.isArray(body.answers)) {
        return reply.code(400).send({
          success: false,
          message: "Answers array is required",
        });
      }

      const existingAnswers = session.final_answers || [];
      const mergedAnswers = [...existingAnswers];

      for (const newAnswer of body.answers) {
        const index = mergedAnswers.findIndex(
          (ans: any) => ans.question_id === newAnswer.question_id,
        );

        if (index !== -1) {
          mergedAnswers[index] = newAnswer;
        } else {
          mergedAnswers.push(newAnswer);
        }
      }

      await repository.updatePublicExamSession(session_id, {
        final_answers: mergedAnswers,
      });

      return reply.code(200).send({
        success: true,
        message: "Answer saved successfully",
        data: mergedAnswers,
      });
    } catch (err) {
      return reply.code(500).send({
        success: false,
        message: "Failed to save answer",
      });
    }
  }
  async resumePublicExamSession(req: FastifyRequest, reply: FastifyReply) {
    const { session_id } = req.params as { session_id: string };
    const session = await repository.resumePublicExamSession(session_id);
    const istrue = await ExamUserMappingPublic.findOne({
      where: { session_id },
    });
    if (!istrue) {
      return reply.status(404).send({ message: "Session Id not found" });
    }
    return reply.status(200).send(session);
  }

  async submitPublicExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { exam_id, session_id } = req.params as {
        exam_id: string;
        session_id: string;
      };
      console.log(exam_id, session_id);

      if (!exam_id || !session_id) {
        return reply.code(400).send({
          success: false,
          message: "Exam ID is required & Session Id Is Required",
        });
      }
      const istrue = await ExamUserMappingPublic.findOne({
        where: { exam_id, session_id },
      });
      if (!istrue) {
        return reply
          .status(400)
          .send({ success: false, message: "Exam_id or Session_id Not Match" });
      }

      const body = req.body as IPublicExamSubmitRequest;

      // 🔹 Validate answers
      if (!body.answers || !Array.isArray(body.answers)) {
        return reply.code(400).send({
          success: false,
          message: "Answers array is required",
        });
      }

      // 🔹 Check session
      const session = await repository.getPublicExamSessionBySessionId(session_id);

      if (!session) {
        return reply.code(404).send({
          success: false,
          message: "Session not found",
        });
      }

      if (session.is_completed) {
        return reply.code(400).send({
          success: false,
          message: "Exam already submitted",
        });
      }
      const student = await ExamUserMappingPublic.findOne({
        where: { session_id },
      });
      const name = student?.name;

      // 🔹 Get exam
      const exam = await repository.getExamById(exam_id);

      if (!exam) {
        return reply.code(404).send({
          success: false,
          message: "Exam not found",
        });
      }

      const questions = (exam as any).questions || [];

      //  FIXED GRADING LOGIC
      let total_correct = 0;
      let obtainedMarks = 0;

      questions.forEach((q: any) => {
        const userAnswerObj = body.answers.find(
          (a) => a.question_id === q.id, // ✅ IMPORTANT MATCH
        );

        if (!userAnswerObj) return;

        const userAnswer = userAnswerObj.user_answer;
        const correctAnswer = q.correct_answer;

        //  Normalize (fix hidden bugs)
        if (
          userAnswer?.trim().toLowerCase() ===
          correctAnswer?.trim().toLowerCase()
        ) {
          total_correct++;
          obtainedMarks += Number(q.marks) || 0; // ✅ marks per question
        }
      });

      const total_questions = questions.length;
      const totalMarks = Number((exam as any).total_marks) || 0;

      const percentage =
        totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;

      const passed = obtainedMarks >= Number((exam as any).passing_marks || 0);

      //  SAVE RESULT
      await repository.updatePublicExamSession(session_id, {
        total_marks_obtained: obtainedMarks,
        total_possible_marks: totalMarks,
        percentage,
        passed,
        final_answers: body.answers,
        submitted_at: new Date(),
        is_completed: true,
      });
      questions.forEach((q: any) => {
        const userAnswerObj = body.answers.find((a) => a.question_id === q.id);

        console.log("MATCH CHECK:", {
          questionId: q.id,
          incomingAnswers: body.answers,
          foundAnswer: userAnswerObj,
        });

        if (!userAnswerObj) return;

        const userAnswer = userAnswerObj.user_answer;
        const correctAnswer = q.correct_answer;
      });

      //  RESPONSE
      return reply.send({
        success: true,
        data: {
          name,
          total_questions,
          total_correct,
          percentage,
          passed,
          score: obtainedMarks,
          session_id: session_id,
        },
        message: "Exam submitted successfully",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof Error && error.message.includes("not found")) {
        return reply.code(404).send({
          success: false,
          message: error.message,
        });
      }

      return reply.code(500).send({
        success: false,
        message: "Failed to submit exam",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
async getPublicExamResult(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { page = 1, limit = 10 } = req.query as {
      page?: string;
      limit?: string;
    };

    const result = await repository.getPublicExamResult(
      Number(page),
      Number(limit)
    );

    return reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
     console.error("error:", error);
    return reply.code(500).send({
      success: false,
      message: "Failed to fetch result",
    });
  }
}
  async saveAnswer(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as ISaveAnswerRequest;
      const params = req.params as { user_id: string };
      const user_id = params.user_id;

      if (!user_id)
        return reply.code(400).send({
          success: false,
          message: "User ID is required in route parameters",
        });

      if (
        !body.session_id ||
        !body.question_id ||
        body.user_answer === undefined ||
        body.user_answer === null ||
        body.current_question_index === undefined ||
        body.current_question_index < 0
      ) {
        return reply.code(400).send({
          success: false,
          message:
            "Session ID, Question ID, user answer, and valid current question index are required",
        });
      }

      const session = await repository.getExamSession(body.session_id, user_id);
      if (!session)
        return reply.code(404).send({
          success: false,
          message: "Exam session not found or access denied",
        });

      if (session.is_completed)
        return reply.code(400).send({
          success: false,
          message: "Exam session is already completed",
        });

      const { session: updatedSession, isExamComplete } =
        await repository.saveAnswer({
          session_id: body.session_id,
          question_id: body.question_id,
          user_answer: body.user_answer,
          question_index: body.current_question_index,
        });

      const response = {
        success: true,
        current_question_index: updatedSession.current_question_index,
        is_exam_complete: isExamComplete,
        session_id: body?.session_id,
        user_answer: body?.user_answer,
        question_id: body?.question_id,
        saved_answers: updatedSession?.answers_data || [],
      };

      return reply.send({
        success: true,
        data: response,
        message: "Answer saved successfully",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof Error) {
        const lowerCaseMessage = error.message.toLowerCase();
        if (lowerCaseMessage.includes("not found"))
          return reply
            .code(404)
            .send({ success: false, message: error.message });
        if (
          lowerCaseMessage.includes("already completed") ||
          lowerCaseMessage.includes("invalid question index")
        )
          return reply
            .code(400)
            .send({ success: false, message: error.message });
      }
      return reply.code(500).send({
        success: false,
        message: "Failed to save answer",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async submitExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as ISubmitExamRequest;
      const params = req.params as { user_id: string };
      const user_id = params.user_id;

      if (!body.session_id)
        return reply
          .code(400)
          .send({ success: false, message: "Session ID is required" });

      const session = await ExamSession.findOne({
        where: { id: body.session_id, user_id: user_id },
      });
      if (!session)
        return reply.code(404).send({
          success: false,
          message: "Exam session not found or access denied.",
        });

      if (session.is_completed)
        return reply.code(200).send({
          success: true,
          message: "Exam was already submitted successfully",
        });

      const submissionResult = await repository.submitExam(session.id, user_id);

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
      return reply.code(500).send({
        success: false,
        message: "Failed to submit exam",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getExamResults(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { session_id } = req.query as { session_id: string };
      const params = req.params as { user_id: string };
      const user_id = params.user_id;

      if (!session_id)
        return reply
          .code(400)
          .send({ success: false, message: "Session ID is required" });

      const results = await repository.getExamResults(session_id, user_id);
      return reply.send({
        success: true,
        data: results,
        message: "Exam results fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to fetch exam results",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async reviewExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { session_id } = req.params as { session_id: string };
      const body = req.body as Omit<IReviewExamRequest, "session_id">;

      if (!session_id)
        return reply.code(400).send({
          success: false,
          message: "Session ID is required in route parameters.",
        });

      const reviewData: IReviewExamRequest = {
        session_id,
        reviewed_answers: body.reviewed_answers,
        ...((body as any).reviewers
          ? { reviewers: (body as any).reviewers }
          : {}),
      };

      const reviewResult: IReviewExamResponse =
        await repository.reviewExam(reviewData);
      return reply.code(200).send({
        success: true,
        data: reviewResult,
        message: "Exam reviewed and results updated successfully.",
      });
    } catch (error) {
      req.log.error(error);
      if (error instanceof Error) {
        if (error.message.includes("not found"))
          return reply
            .code(404)
            .send({ success: false, message: error.message });
        if (error.message.includes("not authorized"))
          return reply
            .code(403)
            .send({ success: false, message: error.message });
      }
      return reply.code(500).send({
        success: false,
        message: "Failed to review exam.",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async assignExam(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { client_id } = req.params as { client_id: string };

      const { exam_id, user_id, class_id } = req.body as {
        exam_id: string[];
        user_id?: string[];
        class_id?: string;
      };

      const validExamIds: string[] = [];

      for (const examId of exam_id) {
        const exam = await repository.getExamById(examId);

        if (!exam) {
          return reply.code(404).send({
            success: false,
            message: `Exam with ID '${examId}' not found.`,
          });
        }

        validExamIds.push(examId);
      }

      let finalUserIds: string[] = [];
      let classInfo: { id: string; name: string } | undefined;

      if (user_id?.length) {
        finalUserIds.push(...user_id);
      }

      if (class_id) {
        const classUserIds = await repository.getUsersByClassId(
          class_id,
          client_id,
        );
        const classDetails = await repository.getClassDetailsById(
          class_id,
          client_id,
        );

        finalUserIds.push(...classUserIds);

        if (classDetails) {
          classInfo = {
            id: classDetails.id,
            name: classDetails.name,
          };
        }
      }

      finalUserIds = [...new Set(finalUserIds)];

      if (!finalUserIds.length) {
        return reply.code(400).send({
          success: false,
          message: "No users found to assign.",
        });
      }

      const assignments = await repository.assignExamToUsers(
        validExamIds,
        finalUserIds,
        client_id,
        classInfo,
      );

      return reply.code(201).send({
        success: true,
        message: `${assignments.length} assignment(s) created successfully.`,
        data: assignments,
      });
    } catch (error) {
      req.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Failed to assign exam.",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getAssignedExams(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id } = req.params as { user_id: string };
      const { page = "1", limit = "10" } = req.query as {
        page?: string;
        limit?: string;
      };

      const pageNum = Number(page) > 0 ? Number(page) : 1;
      const limitNum = Number(limit) > 0 ? Number(limit) : 10;

      const { items: exams, pagination } =
        await repository.getAssignedExamsForUser(user_id, pageNum, limitNum);

      return reply.code(200).send({
        success: true,
        data: exams,
        pagination,
        message: "Assigned exams fetched successfully.",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to fetch assigned exams.",
        error: error instanceof Error ? error.message : String(error),
      });
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
        return reply.code(400).send({
          message: "assigned_id, assignment_id and user_id are required",
        });
      }

      const assignment = await ExamAssignment.findOne({
        where: { id: assigned_id, user_id },
      });
      if (!assignment) {
        return reply.code(404).send({ message: "Assigned exam not found" });
      }

      await repository.logExamPublishEvent({
        assigned_id,
        assignment_id,
        user_id,
        publish,
      });

      return reply.code(201).send({
        message: "Publish status recorded",
        data: { assigned_id, assignment_id, publish },
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to record publish status",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getAssignedExamPublishTimeline(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { user_id } = req.params as { user_id?: string };
      const publishOnly = !user_id;
      const raw = await repository.getExamPublishTimelineByUser(
        user_id,
        publishOnly,
      );

      const studentNameMap = new Map<string, string>();
      if (raw.length) {
        const uniqueUserIds = [...new Set(raw.map((r: any) => r.user_id))];
        try {
          const studentQuery = `
            SELECT user_id, first_name, middle_name, last_name
            FROM addmissions
            WHERE user_id IN (:user_ids)
          `;
          const students: any[] = await externalDB.query(studentQuery, {
            replacements: { user_ids: uniqueUserIds },
            type: QueryTypes.SELECT,
          });
          students.forEach((s: any) => {
            const name = [s.first_name, s.middle_name, s.last_name]
              .filter(Boolean)
              .join(" ");
            studentNameMap.set(s.user_id, name);
          });
        } catch (e: any) {
          req.log.warn("could not fetch student names: ", e);
        }
      }

      const timeline = raw.map((item: any) => {
        const achievedExam = item.achieved_marks || "";
        return {
          studentName: studentNameMap.get(item.user_id) || "",
          type: "Exam",
          title: item.title || "",
          description: item.subject || "",
          date: item.created_at
            ? item.created_at.toISOString().split("T")[0]
            : null,
          achieved_marks: achievedExam || "",
          total_marks: item.total_marks || "",

          raw: item,
        };
      });

      return reply.code(200).send({
        data: timeline,
        message: "Publish timeline fetched successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        message: "Failed to fetch publish timeline",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getReviewerDashboard(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { reviewer_id } = req.params as { reviewer_id: string };
      const exams = await repository.getReviewerDashboardExams(reviewer_id);

      if (!exams || exams.length === 0) {
        return reply.code(404).send({
          success: true,
          data: [],
          message: "No submitted tests found for review.",
        });
      }

      return reply.code(200).send({
        success: true,
        data: exams,
        message: "Reviewer dashboard exams fetched successfully.",
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to fetch reviewer dashboard exams",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getSubmissionForReview(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id, session_id } = req.params as {
        user_id: string;
        session_id: string;
      };
      if (!user_id || !session_id)
        return reply.code(400).send({
          success: false,
          message: "User ID and Session ID are required.",
        });

      const submission = await repository.getReviewerSubmissionDetails(
        session_id,
        user_id,
      );
      return reply.code(200).send({
        success: true,
        data: submission,
        message: "Submission details fetched successfully for review.",
      });
    } catch (error) {
      req.log.error(error);
      const message =
        error instanceof Error ? error.message : "An unknown error occurred";
      const statusCode = message.includes("not found") ? 404 : 500;
      return reply.code(statusCode).send({ success: false, message });
    }
  }

  async getStudentExamReview(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { user_id, exam_id, client_id } = req.params as {
        user_id: string;
        exam_id: string;
        client_id: string;
      };

      if (!user_id || !exam_id || !client_id)
        return reply.code(400).send({
          success: false,
          message: "User ID, Exam ID, and Client ID are required.",
        });

      const review = await repository.getStudentExamReview(
        exam_id,
        user_id,
        client_id,
      );

      return reply.code(200).send({
        success: true,
        data: review,
        message: "Student exam review fetched successfully.",
      });
    } catch (error) {
      req.log.error(error);
      const message =
        error instanceof Error ? error.message : "An unknown error occurred";
      const statusCode = message.includes("not found") ? 404 : 500;
      return reply.code(statusCode).send({ success: false, message });
    }
  }
}
