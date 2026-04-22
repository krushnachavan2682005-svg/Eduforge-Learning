import {
  Exam,
  Question,
  ExamSession,
  ExamUserMapping,
  ExamUserMappingPublic,
  ExamAssignment,
  ExamReview,
} from "../models/exam.model";
import { AssignedActionItemsTimelineModel } from "../models/assignedActionItemsTimeline.model";
import { sequelize } from "../config/database";
import { externalDB } from "../config/database";
import { paginate } from "../utils/pagination";
import {
  IExam,
  IQuestion,
  IExamUpdate,
  IExamSessionCreate,
  IAnswerSaveData,
  IExamSession,
  IExamUserMapping,
  IReviewExamRequest,
  IReviewerAnswer,
  IAnswerData,
  IFinalAnswer,
  IExamAssignment,
  Reviewer,
} from "../interfaces/exam.interface";
import { QueryTypes } from "sequelize";

export class ExamRepository {
  private getTimestamps() {
    const now = new Date();
    return { created_on: now, updated_on: now };
  }

  async createFullExam(data: IExam & { questions: IQuestion[] }) {
    const transaction = await sequelize.transaction();
    let isTransactionCommitted = false;

    try {
      const exam = await Exam.create(
        {
          reviewers: data.reviewers || [],
          title: data.title,
          subject: data.subject,
          total_marks: data.total_marks,
          passing_marks: data.passing_marks,
          duration_minutes: data.duration_minutes,
          exam_date: data.exam_date ? new Date(data.exam_date) : new Date(), // Keep existing logic for exam_date
          exam_start_time: new Date(data.exam_start_time!),
          client_id: data.client_id,
          created_by: data.created_by!,
          updated_by: data.updated_by!,
          is_completed: false,
          ...this.getTimestamps(),
        },
        { transaction },
      );

      const examId = exam.id;
      let createdQuestions: any[] = [];
      if (data.questions && data.questions.length > 0) {
        createdQuestions = await Question.bulkCreate(
          data.questions.map((q) => ({
            exam_id: examId,
            type: q.type,
            text: q.text,
            marks: q.marks,
            is_mandatory: q.is_mandatory,
            correct_answer: q.correct_answer,
            options: q.options,
            client_id: data.client_id,
            created_on: new Date(),
            updated_on: new Date(),
          })),
          {
            transaction,
            returning: true,
          },
        );
      }
      await transaction.commit();
      isTransactionCommitted = true;
      return {
        ...exam.toJSON(),
        questions: createdQuestions.map((q) => q.toJSON()),
      };
    } catch (error) {
      if (!isTransactionCommitted) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error("Failed to rollback transaction:", rollbackError);
        }
      }
      throw error;
    }
  }

  async getExamById(examId: string) {
    const exam = await Exam.findByPk(examId, {
      include: [
        {
          model: Question,
          as: "questions",
        },
      ],
    });
    if (!exam) throw new Error(`Exam with id ${examId} not found`);
    return exam;
  }

  async getAllExams(limit: number, skip: number, userId?: string) {
    const includeOptions = [{ model: Question, as: "questions" }];

    if (userId) {
      const assignments = await ExamAssignment.findAll({
        where: { user_id: userId },
        attributes: ["exam_id"],
      });

      if (assignments.length === 0) {
        return { exams: [], total: 0 };
      }

      const examIds = assignments.map((a) => a.exam_id);

      const { count, rows } = await Exam.findAndCountAll({
        where: { id: examIds },
        include: includeOptions,
        distinct: true,
        col: "id",
        limit,
        offset: skip,
        order: [["created_on", "DESC"]],
      });
      return { exams: rows, total: count };
    }

    const { count, rows } = await Exam.findAndCountAll({
      include: includeOptions,
      limit,
      distinct: true,
      offset: skip,
      col:"id",
      order: [["created_on", "DESC"]],
    });
    return { exams: rows, total: count };
  }

  async getExamsByCreator(userId: string, limit: number, skip: number) {
    const { count, rows } = await Exam.findAndCountAll({
      where: { created_by: userId },
      include: [
        {
          model: Question,
          as: "questions",
        },
      ],
      limit,
      offset: skip,
      order: [["created_on", "DESC"]],
    });
    return { exams: rows, total: count };
  }

  async updateExam(examId: string, data: IExamUpdate) {
    const transaction = await sequelize.transaction();
    try {
      const exam = await Exam.findByPk(examId, { transaction });
      if (!exam) {
        throw new Error(`Exam with id ${examId} not found`);
      }
      const examUpdateData: any = { updated_on: new Date() };
      if (data.title !== undefined) examUpdateData.title = data.title;
      if (data.subject !== undefined) examUpdateData.subject = data.subject;
      if (data.reviewers !== undefined)
        examUpdateData.reviewers = data.reviewers;
      if (data.total_marks !== undefined)
        examUpdateData.total_marks = data.total_marks;
      if (data.passing_marks !== undefined)
        examUpdateData.passing_marks = data.passing_marks;
      if (data.duration_minutes !== undefined)
        examUpdateData.duration_minutes = data.duration_minutes;
      if (data.exam_date !== undefined)
        examUpdateData.exam_date = data.exam_date;
      if (data.exam_start_time !== undefined)
        examUpdateData.exam_start_time = new Date(data.exam_start_time);
      // updated_by is now required on update
      if (data.updated_by !== undefined) {
        examUpdateData.updated_by = data.updated_by;
      }
      if (data.client_id !== undefined)
        examUpdateData.client_id = data.client_id;

      await exam.update(examUpdateData, { transaction });

      // If reviewers are updated, propagate the change to non-completed exam sessions.
      if (data.reviewers !== undefined) {
        await ExamSession.update(
          { reviewers: data.reviewers },
          { where: { exam_id: examId, is_completed: false }, transaction },
        );
      }

      if (data.questions && data.questions.length > 0) {
        // Identify incoming question IDs and existing question IDs
        const incomingQuestionIds = new Set(
          data.questions.map((q) => q.id).filter(Boolean),
        );
        const existingQuestions = await Question.findAll({
          where: { exam_id: examId },
          attributes: ["id"],
          transaction,
        });
        const existingQuestionIds = new Set(existingQuestions.map((q) => q.id));

        // Determine which questions to delete
        const questionsToDelete = [...existingQuestionIds].filter(
          (id) => !incomingQuestionIds.has(id),
        );

        if (questionsToDelete.length > 0) {
          await Question.destroy({
            where: { id: questionsToDelete },
            transaction,
          });
        }

        for (const questionData of data.questions) {
          if (questionData.id) {
            await Question.update(
              {
                type: questionData.type,
                text: questionData.text,
                marks: questionData.marks,
                is_mandatory: questionData.is_mandatory,
                correct_answer: questionData.correct_answer,
                options: questionData.options,
                client_id: data.client_id,
                updated_on: new Date(),
              },
              {
                where: { id: questionData.id, exam_id: examId },
                transaction,
              },
            );
          } else {
            await Question.create(
              {
                exam_id: examId,
                type: questionData.type!,
                text: questionData.text!,
                marks: questionData.marks!,
                is_mandatory: questionData.is_mandatory!,
                correct_answer: questionData.correct_answer,
                options: questionData.options,
                client_id: data.client_id,
                created_on: new Date(),
                updated_on: new Date(),
              },
              { transaction },
            );
          }
        }
      }

      await transaction.commit();
      return await this.getExamById(examId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteExam(examId: string) {
    const transaction = await sequelize.transaction();
    try {
      const exam = await Exam.findByPk(examId, { transaction });
      if (!exam) {
        return false;
      }

      await Question.destroy({ where: { exam_id: examId }, transaction });
      await exam.destroy({ transaction });

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

async assignExamToUsers(
  examIds: string[],
  userIds: string[],
  clientId: string,
  classInfo?: { id: string; name?: string }
): Promise<ExamAssignment[]> {
  const assignmentsToCreate: {
    exam_id: string;
    user_id: string;
    client_id: string;
    class_info: { id: string; name?: string } | null;
  }[] = [];

  for (const examId of examIds) {
    for (const userId of userIds) {
      assignmentsToCreate.push({
        exam_id: examId,
        user_id: userId,
        client_id: clientId,
        class_info: classInfo || null,
      });
    }
  }

  const assignments = await ExamAssignment.bulkCreate(assignmentsToCreate, {
    ignoreDuplicates: true,
    returning: true,
  });

  for (const assignment of assignments) {
    if (!assignment.id) continue;

    try {
      await this.logExamPublishEvent({
        assigned_id: assignment.id,
        assignment_id: assignment.exam_id,
        user_id: assignment.user_id,
        publish: false,
      });
    } catch (err) {
      console.warn("Failed to log publish event for assignment", err);
    }
  }

  return assignments;
}

  async getUsersByClassId(
    class_id: string,
    client_id: string,
  ): Promise<string[]> {
    const sql = `
    SELECT user_id
    FROM addmissions
    WHERE class = :classId
      AND client_id = :clientId
  `;

    const results: any[] = await externalDB.query(sql, {
      replacements: { classId: class_id, clientId: client_id },
      type: QueryTypes.SELECT,
    });

    return results.map((row: any) => row.user_id);
  }

  async getClassDetailsById(
    class_id: string,
    client_id: string,
  ): Promise<{ id: string; name: string } | null> {
    const sql = `
      SELECT id, class_name AS name
      FROM classes
      WHERE id = :classId AND client_id = :clientId
      LIMIT 1;
    `;
    const result: any[] = await externalDB.query(sql, {
      replacements: { classId: class_id, clientId: client_id },
      type: QueryTypes.SELECT,
    });
    return result.length > 0 ? result[0] : null;
  }

  async assignExamToUser(data: IExamAssignment): Promise<IExamAssignment> {
    const created = (
      await ExamAssignment.create(data as any)
    ).toJSON() as IExamAssignment;

    if (created?.id) {
      try {
        await this.logExamPublishEvent({
          assigned_id: created?.id,
          assignment_id: created?.exam_id,
          user_id: created?.user_id,
          publish: false,
        });
      } catch (err) {
        console.warn("Failed to log publish event for single assignment", err);
      }
    }

    return created;
  }

  async gradeMcqExam(
    examId: string,
    userAnswers: Array<{ question_id: string; user_answer: any }>,
  ) {
    const exam = await Exam.findByPk(examId, {
      include: [{ model: Question, as: "questions" }],
    });
    if (!exam) throw new Error(`Exam with id ${examId} not found`);

    const questions: any[] = (exam as any).questions || [];
    if (questions.length === 0)
      throw new Error("Exam has no questions to grade");

    if (!questions.every((q) => q.type === "mcq")) {
      throw new Error(
        "Only exams composed entirely of MCQ questions can be graded immediately",
      );
    }

    let total = questions.length;
    let correct = 0;
    const feedback: any[] = [];

    questions.forEach((q) => {
      const ans = userAnswers.find((a) => a.question_id === q.id);
      const isCorrect = ans && ans.user_answer == q.correct_answer;
      if (isCorrect) correct++;
      feedback.push({
        question_id: q.id,
        user_answer: ans ? ans.user_answer : null,
        correct_answer: q.correct_answer || null,
        is_correct: !!isCorrect,
        marks_obtained: isCorrect ? q.marks : 0,
      });
    });

    const percentage = total > 0 ? (correct / total) * 100 : 0;
    const passed = percentage >= exam.passing_marks;

    return {
      exam: exam.toJSON(),
      total_questions: total,
      total_correct: correct,
      percentage,
      passed,
      feedback,
    };
  }

  async getAssignedExamsForUser(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ items: IExam[]; pagination: any }> {
    const assignments = await ExamAssignment.findAll({
      where: { user_id: userId },
      attributes: ["id", "exam_id"],
    });

    if (assignments.length === 0) {
      return {
        items: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const examIds = assignments.map((a) => a?.exam_id);
    const assignmentMap = new Map<string, string>();
    assignments.forEach((a) => {
      if (a?.exam_id && a?.id) {
        assignmentMap.set(a?.exam_id, a?.id);
      }
    });

    const { items: exams, pagination } = await paginate(Exam, {
      page,
      limit,
      filters: { id: examIds },
      include: [{ model: Question, as: "questions" }],
      order: [["created_on", "DESC"]],
    });

    const mappings = await ExamUserMapping.findAll({
      where: { user_id: userId, exam_id: examIds, is_completed: true },
      attributes: ["exam_id", "is_completed", "review_status"],
    });

    const completedExamIds = new Set(mappings.map((m) => m?.exam_id));
    const reviewStatusMap = new Map<string, string>();
    mappings.forEach((m) => {
      if (m?.exam_id && m?.review_status) {
        reviewStatusMap.set(m?.exam_id, m?.review_status);
      }
    });

    const assignmentIds = assignments.map((a) => a.id);
    const timelineRecords = await AssignedActionItemsTimelineModel.findAll({
      where: { assigned_id: assignmentIds },
      attributes: ["assigned_id", "publish", "created_at"],
      order: [["created_at", "DESC"]],
    });

    const publishMap = new Map<string, boolean>();
    timelineRecords.forEach((r: any) => {
      const aid = r.assigned_id as string;
      if (!publishMap.has(aid)) {
        publishMap.set(aid, !!r.publish);
      }
    });

    const processed = exams.map((exam) => {
      const examJson = exam.toJSON() as IExam;
      const questions = (examJson.questions || []).map((q) => {
        const { correct_answer, ...rest } = q as any;
        return rest as any;
      });
      const is_completed = examJson?.id
        ? completedExamIds.has(examJson?.id)
        : false;
      const review_status = examJson?.id
        ? reviewStatusMap.get(examJson?.id) || "Pending Review"
        : "Pending Review";
      let is_published = false;
      let test_id: string | null = null;
      if (examJson.id) {
        const aid = assignmentMap.get(examJson?.id);
        if (aid) {
          is_published = publishMap.get(aid) ?? false;
          test_id = aid;
        }
      }

      const base: any = { ...examJson };
      delete base.is_completed;
      delete base.questions;

      return {
        ...base,
        test_id,
        is_published,
        is_completed,
        review_status,
        questions,
      };
    });

    return { items: processed, pagination };
  }

  async startExamSession(data: IExamSessionCreate): Promise<IExamSession> {
    const transaction = await sequelize.transaction();
    try {
      const existingSession = await ExamSession.findOne({
        where: {
          exam_id: data.exam_id,
          user_id: data.user_id,
          is_completed: false,
        },
        transaction,
      });

      if (existingSession) {
        throw new Error("Exam already running in another tab");
      }

      // Read reviewers from exam and pass to session
      const exam = await Exam.findByPk(data.exam_id, { transaction });
      if (!exam) throw new Error(`Exam with id ${data.exam_id} not found`);

      const session = await ExamSession.create(
        {
          exam_id: data?.exam_id,
          user_id: data?.user_id,
          current_question_index: data?.current_question_index || 0,
          client_id: data?.client_id,
          answers_data: data?.answers_data || [],
          started_at: new Date(),
          is_completed: false,
          reviewers: exam.reviewers || [],
          ...this.getTimestamps(),
        } as any,
        { transaction },
      );

      await transaction.commit();
      return session.toJSON() as IExamSession;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
async createPublicExamSession(data: {
  exam_id: string;
  session_id:string;
  started_at: Date;
  is_completed: boolean;
  name:string|null;
  email:string
}) {
  return await ExamUserMappingPublic.create(data);
}
async resumePublicExamSession(session_id:string){
  const session=await ExamUserMappingPublic.findOne({where:{session_id}})
  return ({
      success: true,
      data: {
        session_id,
        exam:session?.exam_id,
        answers: session?.final_answers || [], 
        is_completed: session?.is_completed,
      },
    });
  }
  async getPublicExamSessionBySessionId(session_id: string) {
    return await ExamUserMappingPublic.findOne({
      where: { session_id },
    });
  }
  async updatePublicExamSession(session_id: string, data: any) {
    return await ExamUserMappingPublic.update(data, {
      where: { session_id },
    });
  }
  async getPublicExamResult(page: number, limit: number) {
    const result = paginate(ExamUserMappingPublic, {
      page: page,
      limit: limit,
      attributes:["name","exam_id","submitted_at"],
      
       order: [ ["submitted_at", "DESC"],["id", "DESC"]],
    });
    

    return result;
  }
  async saveAnswer(
    data: IAnswerSaveData,
  ): Promise<{ session: IExamSession; isExamComplete: boolean }> {
    const transaction = await sequelize.transaction();
    try {
      const session = await ExamSession.findByPk(data.session_id, {
        transaction,
        lock: true,
      });

      if (!session)
        throw new Error(`Session with id ${data.session_id} not found`);
      if (session.is_completed)
        throw new Error("Exam session already completed");

      const exam = await Exam.findByPk(session.exam_id, {
        include: [
          {
            model: Question,
            as: "questions",
            attributes: ["id"],
            order: [["created_on", "ASC"]],
          },
        ],
        transaction,
      });

      if (!exam || !exam.questions || exam.questions.length === 0) {
        throw new Error("Exam or questions not found");
      }

      const totalQuestions = exam.questions.length;
      if (data.question_index < 0 || data.question_index >= totalQuestions) {
        throw new Error(
          `Invalid question index: ${data.question_index}. Total questions: ${totalQuestions}`,
        );
      }

      const questionExists = exam.questions.some(
        (q) => q.id === data.question_id,
      );
      if (!questionExists)
        throw new Error(
          `Question with id ${data.question_id} not found in this exam`,
        );

      const isExamComplete = data.question_index === totalQuestions - 1;
      const answersData: IAnswerData[] = Array.isArray(session.answers_data)
        ? session.answers_data
        : [];

      const filteredAnswers = answersData.filter(
        (answer) => answer.question_id !== data.question_id,
      );

      const newAnswer: IAnswerData = {
        question_id: data.question_id,
        user_answer: data.user_answer,
        answered_at: new Date(),
        question_index: data.question_index,
      };

      const updatedAnswers = [...filteredAnswers, newAnswer];

      const updateData: any = {
        answers_data: updatedAnswers,
        updated_on: new Date(),
      };
      updateData.current_question_index = data.question_index + 1;

      await session.update(updateData, { transaction });
      await transaction.commit();

      const updatedSession = await ExamSession.findByPk(data.session_id);
      if (!updatedSession)
        throw new Error("Failed to retrieve updated session");

      return {
        session: updatedSession.toJSON() as IExamSession,
        isExamComplete,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getExamSession(
    sessionId: string,
    userId: string,
  ): Promise<IExamSession> {
    const session = await ExamSession.findOne({
      where: { id: sessionId, user_id: userId },
      include: [
        {
          model: Exam,
          as: "exam",
          include: [{ model: Question, as: "questions" }],
        },
      ],
    });

    if (!session)
      throw new Error(
        `Session with id ${sessionId} not found for user ${userId}`,
      );
    return session.toJSON() as IExamSession;
  }

  async submitExam(sessionId: string, userId: string): Promise<any> {
    const transaction = await sequelize.transaction();
    try {
      const session = await ExamSession.findByPk(sessionId, {
        transaction,
        include: [
          {
            model: Exam,
            as: "exam",
            include: [{ model: Question, as: "questions" }],
          },
        ],
      });

      if (!session) throw new Error(`Session with id ${sessionId} not found`);
      if (session.user_id !== userId)
        throw new Error("User not authorized to submit this exam");

      const existingMapping = await ExamUserMapping.findOne({
        where: { session_id: sessionId, user_id: userId },
      });
      if (existingMapping)
        throw new Error("Exam was already submitted successfully");

      const exam = session.exam;
      if (!exam) throw new Error("Exam not found for this session");
      if (!exam.questions)
        throw new Error("Questions not found for this exam.");

      const answersData: IAnswerData[] = Array.isArray(session.answers_data)
        ? session.answers_data
        : [];
      const results = this.calculateExamResults(
        exam.questions,
        answersData,
        exam.passing_marks,
      );

      const timeTakenMinutes = session.started_at
        ? Math.round(
            (new Date().getTime() - session.started_at.getTime()) / 60000,
          )
        : 0;

      await session.update(
        {
          is_completed: true,
          completed_at: new Date(),
          updated_on: new Date(),
        },
        { transaction },
      );

      const hasManualReviewQuestions = exam.questions.some((q) =>
        ["short", "long", "practical"].includes(q.type),
      );

      const mapping = await ExamUserMapping.create(
        {
          exam_id: exam.id,
          user_id: userId,
          session_id: sessionId,
          total_marks_obtained: results.totalMarksObtained,
          total_possible_marks: results.totalPossibleMarks,
          percentage: results.percentage,
          passed: results.passed,
          started_at: session.started_at,
          submitted_at: new Date(),
          time_taken_minutes: timeTakenMinutes,
          final_answers: results.finalAnswers,
          is_completed: true,
          review_status: hasManualReviewQuestions
            ? "pending_review"
            : "completed",
          client_id: session.client_id,
          reviewers: exam.reviewers || [],
          created_on: new Date(),
        } as any,
        { transaction },
      );

      await transaction.commit();

      const fullMapping = await ExamUserMapping.findByPk(mapping.id, {
        include: [
          {
            model: Exam,
            as: "exam",
            include: [{ model: Question, as: "questions" }],
          },
          { model: ExamSession, as: "session" },
        ],
      });

      return {
        mapping: fullMapping,
        results: results.finalAnswers,
        summary: {
          totalMarksObtained: results.totalMarksObtained,
          totalPossibleMarks: results.totalPossibleMarks,
          percentage: results.percentage,
          passed: results.passed,
          timeTakenMinutes: timeTakenMinutes,
        },
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async reviewExam(reviewData: IReviewExamRequest): Promise<any> {
    const transaction = await sequelize.transaction();
    try {
      const mapping = await ExamUserMapping.findOne({
        where: { session_id: reviewData.session_id },
        include: [
          {
            model: Exam,
            as: "exam",
            include: [{ model: Question, as: "questions" }],
          },
        ],
        transaction,
      });

      if (!mapping)
        throw new Error(
          `Exam results not found for session ${reviewData.session_id}`,
        );

      const exam = (mapping as any).exam;
      if (!exam || !exam.questions)
        throw new Error("Exam or questions not found for this mapping.");

      // Map original final answers
      const originalFinalAnswers: IFinalAnswer[] = mapping.final_answers || [];
      const reviewedAnswersMap = new Map<string, IReviewerAnswer>(
        (reviewData.reviewed_answers || []).map((a) => [a.question_id, a]),
      );
      let totalMarksObtained = mapping.total_marks_obtained;

      const updatedFinalAnswers = originalFinalAnswers.map((originalAnswer) => {
        const reviewedAnswer = reviewedAnswersMap.get(
          originalAnswer.question_id,
        );
        if (reviewedAnswer) {
          totalMarksObtained =
            totalMarksObtained -
            originalAnswer.marks_obtained +
            reviewedAnswer.marks_obtained;
          return {
            ...originalAnswer,
            marks_obtained: reviewedAnswer.marks_obtained,
            is_correct: reviewedAnswer.is_correct,
            reviewer_comment: reviewedAnswer.reviewer_comment,
          };
        }
        return originalAnswer;
      });

      const totalPossibleMarks = mapping.total_possible_marks;
      const percentage =
        totalPossibleMarks > 0
          ? (totalMarksObtained / totalPossibleMarks) * 100
          : 0;
      const passed =
        totalPossibleMarks > 0
          ? percentage >= (exam.passing_marks / totalPossibleMarks) * 100
          : false;
      const manualQuestionIds = new Set<string>(
        exam.questions
          .filter((q: IQuestion) =>
            ["short", "long", "practical"].includes(q.type),
          )
          .map((q: IQuestion) => q.id),
      );

      const isReviewComplete = Array.from(manualQuestionIds).every((qid) =>
        reviewedAnswersMap.has(qid),
      );

      // reviewers info can come from request (preferred) or from mapping
      const reviewersForRecord: Reviewer[] =
        (reviewData as any).reviewers || mapping.reviewers || [];

      // Upsert review record
      const [reviewRecord, created] = await ExamReview.findOrCreate({
        where: { exam_user_mapping_id: mapping.id },
        defaults: {
          exam_id: exam.id,
          exam_user_mapping_id: mapping.id,
          reviewers: reviewersForRecord,
          reviewed_at: new Date(),
          reviewed_answers: updatedFinalAnswers,
          total_marks_obtained: totalMarksObtained,
          percentage: Math.round(percentage * 100) / 100,
          passed,
          client_id: mapping.client_id,
        },
        transaction,
      });

      if (!created) {
        await reviewRecord.update(
          {
            reviewers: reviewersForRecord,
            reviewed_at: new Date(),
            reviewed_answers: updatedFinalAnswers,
            total_marks_obtained: totalMarksObtained,
            percentage: Math.round(percentage * 100) / 100,
            passed,
          },
          { transaction },
        );
      }

      // Update mapping (allow null for reviewed_by)
      await mapping.update(
        {
          total_marks_obtained: totalMarksObtained,
          percentage: Math.round(percentage * 100) / 100,
          passed,
          final_answers: updatedFinalAnswers,
          review_status: isReviewComplete ? "completed" : "pending_review",
          reviewed_by:
            (reviewersForRecord[0] && reviewersForRecord[0].id) || null,
          reviewed_at: new Date(),
        } as any,
        { transaction },
      );

      await transaction.commit();
      return { mapping: mapping.toJSON(), review: reviewRecord.toJSON() };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getExamResults(
    sessionId: string,
    userId: string,
  ): Promise<{
    mapping: IExamUserMapping;
    exam: IExam;
    session: IExamSession;
  }> {
    const mapping = await ExamUserMapping.findOne({
      where: { session_id: sessionId, user_id: userId },
      include: [
        { model: ExamSession, as: "session" },
        {
          model: Exam,
          as: "exam",
          include: [{ model: Question, as: "questions" }],
        },
      ],
    });

    if (!mapping)
      throw new Error(`Exam results not found for session ${sessionId}`);

    return {
      mapping: mapping.toJSON() as IExamUserMapping,
      exam: (mapping as any).exam?.toJSON() as IExam,
      session: (mapping as any).session?.toJSON() as IExamSession,
    };
  }

  validateAnswer(
    question: IQuestion,
    userAnswer: string,
  ): { isCorrect: boolean; marksObtained: number } {
    if (question.type !== "mcq" || !question.correct_answer) {
      return { isCorrect: false, marksObtained: 0 };
    }

    const isCorrect =
      question.correct_answer.trim().toLowerCase() ===
      userAnswer.trim().toLowerCase();
    return { isCorrect, marksObtained: isCorrect ? question.marks : 0 };
  }

  calculateExamResults(
    questions: IQuestion[],
    answers: IAnswerData[],
    examPassingMarks: number,
  ) {
    const finalAnswers: IFinalAnswer[] = [];
    let totalMarksObtained = 0;
    const totalPossibleMarks = questions.reduce((sum, q) => sum + q.marks, 0);

    questions.forEach((question) => {
      const userAnswer = answers.find((a) => a.question_id === question.id);
      const validation = userAnswer
        ? this.validateAnswer(question, userAnswer.user_answer)
        : { isCorrect: false, marksObtained: 0 };

      const finalAnswer: IFinalAnswer = {
        question_id: question.id!,
        question_type: question.type,
        user_answer: userAnswer?.user_answer || "",
        is_correct: validation.isCorrect,
        marks_obtained: validation.marksObtained,
        correct_answer: question.correct_answer,
        question_marks: question.marks,
        reviewer_comment: "",
      };

      finalAnswers.push(finalAnswer);
      totalMarksObtained += validation.marksObtained;
    });

    const percentage =
      totalPossibleMarks > 0
        ? (totalMarksObtained / totalPossibleMarks) * 100
        : 0;
    const passed = totalMarksObtained >= examPassingMarks;

    return {
      finalAnswers,
      totalMarksObtained,
      totalPossibleMarks,
      percentage: Math.round(percentage * 100) / 100,
      passed,
    };
  }

  async getExamQuestions(examId: string): Promise<IQuestion[]> {
    const exam = await Exam.findByPk(examId, {
      include: [{ model: Question, as: "questions" }],
    });
    return (exam?.questions?.map((q) => q.toJSON()) as IQuestion[]) || [];
  }

  async getReviewerDashboardExams(reviewerId: string): Promise<any[]> {
    const query = `
      SELECT
          eum.id AS submission_id,
          eum.user_id,
          eum.session_id,
          eum.submitted_at,
          eum.total_marks_obtained,
          eum.passed,
          eum.is_completed,
          eum.review_status,
          eum.reviewed_at,
          eum.client_id,
          e.id AS exam_id,
          e.title,
          e.subject,
          e.total_marks,
          e.passing_marks,
          e.duration_minutes,
          e.exam_date,
          e.exam_start_time,
          e.created_by,
          e.updated_by,
          e.created_on,
          e.updated_on
      FROM
          exam_user_mappings AS eum
      JOIN
          exams AS e ON eum.exam_id = e.id
      WHERE
          eum.is_completed = TRUE
          AND EXISTS (
             SELECT 1 FROM jsonb_array_elements(eum.reviewers) elem
            WHERE elem->>'id' = :reviewerId
          )
      ORDER BY COALESCE(eum.reviewed_at, eum.submitted_at) DESC;
    `;
    try {
      const results: any[] = await sequelize.query(query, {
        replacements: { reviewerId },
        type: QueryTypes.SELECT,
      });

      if (results.length === 0) return [];
      const userClientPairs = results.map((r) => ({
        user_id: r?.user_id,
        client_id: r?.client_id,
      }));
      const userIds = [...new Set(userClientPairs.map((p) => p?.user_id))];
      const studentNamesQuery = `
        SELECT user_id, first_name, middle_name, last_name, client_id
        FROM addmissions
        WHERE user_id IN (:userIds)
      `;

      const nameResults: any[] = await externalDB.query(studentNamesQuery, {
        replacements: { userIds },
        type: QueryTypes.SELECT,
      });

      const nameMap = new Map();
      nameResults.forEach((r) => {
        const fullName = [r?.first_name, r?.middle_name, r?.last_name]
          .filter(Boolean)
          .join(" ");
        nameMap.set(`${r?.user_id}_${r?.client_id}`, fullName);
      });

      return results.map((r) => ({
        ...r,
        student_name: nameMap.get(`${r?.user_id}_${r?.client_id}`),
      }));
    } catch (error) {
      console.error("Error fetching reviewer dashboard exams:", error);
      throw error;
    }
  }

  async getReviewerSubmissionDetails(
    sessionId: string,
    userId: string,
  ): Promise<any> {
    const mapping = await ExamUserMapping.findOne({
      where: { session_id: sessionId, user_id: userId },
    });
    if (!mapping)
      throw new Error(
        `Submission not found for session ${sessionId} and user ${userId}`,
      );

    // Fetch student name from external DB
    const studentNameQuery = `
      SELECT first_name, middle_name, last_name
      FROM addmissions
      WHERE user_id = :userId AND client_id = :clientId
      LIMIT 1;
    `;
    const studentNameResult: any[] = await externalDB.query(studentNameQuery, {
      replacements: { userId: mapping.user_id, clientId: mapping.client_id },
      type: QueryTypes.SELECT,
    });

    if (studentNameResult.length === 0) {
      throw new Error(
        `Data integrity error: The user with ID '${mapping.user_id}' is not associated with the client ID '${mapping.client_id}' in the admissions records.`,
      );
    }

    let studentName = "";
    if (studentNameResult.length > 0) {
      const { first_name, middle_name, last_name } = studentNameResult[0];
      studentName = [first_name, middle_name, last_name]
        .filter(Boolean)
        .join(" ");
    }

    const exam = await Exam.findByPk(mapping.exam_id, {
      attributes: ["title", "total_marks"],
    });

    if (!exam) {
      throw new Error(
        `Exam with id ${mapping.exam_id} not found for submission`,
      );
    }
    const questionInstances = await Question.findAll({
      where: { exam_id: mapping.exam_id },
      order: [["created_on", "ASC"]],
    });
    const questions: IQuestion[] = questionInstances.map((q) => q.toJSON());
    const finalAnswersMap = new Map<string, IFinalAnswer>(
      mapping.final_answers.map((ans: IFinalAnswer) => [ans.question_id, ans]),
    );
    const submissionDetails = questions.map((question) => {
      const answer: IFinalAnswer | undefined = finalAnswersMap.get(
        question.id!,
      );
      return {
        question_id: question?.id,
        question_text: question?.text,
        question_type: question?.type,
        question_marks: question?.marks,
        options: question?.options,
        is_mandatory: question?.is_mandatory,
        user_answer: answer ? answer?.user_answer : null,
        is_correct: answer ? answer?.is_correct : null,
        marks_obtained: answer ? answer.marks_obtained : null,
        correct_answer: question?.correct_answer,
        reviewer_comment: answer ? answer?.reviewer_comment : null,
      };
    });
    //reviewer checking
    const reviewerId = mapping?.reviewed_by;
    const reviewerObj = mapping?.reviewers?.find((r) => r.id === reviewerId);
    const reviewerName = reviewerObj?.name || null;
    return {
      submission_id: mapping.id,
      exam_id: mapping.exam_id,
      user_id: mapping.user_id,
      student_name: studentName,
      reviewed_by: reviewerName,
      test_name: exam.title,
      total_marks: exam.total_marks,
      submission_details: submissionDetails,
    };
  }

  async getStudentExamReview(
    exam_id: string,
    user_id: string,
    client_id: string,
  ): Promise<any> {
    const mapping = await ExamUserMapping.findOne({
      where: { exam_id: exam_id, user_id: user_id, client_id: client_id },
    });

    if (!mapping) {
      throw new Error(
        `Exam submission not found for exam ${exam_id} and user ${user_id}`,
      );
    }

    if (mapping?.review_status !== "completed") {
      throw new Error(
        `Exam review not yet available. Current status: ${mapping?.review_status}`,
      );
    }

    // Fetch student name from external DB
    const studentNameQuery = `
      SELECT first_name, middle_name, last_name
      FROM addmissions
      WHERE user_id = :userId AND client_id = :clientId
      LIMIT 1;
    `;
    const studentNameResult: any[] = await externalDB.query(studentNameQuery, {
      replacements: { userId: mapping?.user_id, clientId: mapping?.client_id },
      type: QueryTypes.SELECT,
    });

    let studentName = "";
    if (studentNameResult.length > 0) {
      const { first_name, middle_name, last_name } = studentNameResult[0];
      studentName = [first_name, middle_name, last_name]
        .filter(Boolean)
        .join(" ");
    }

    // Get exam details
    const exam = await Exam.findByPk(mapping.exam_id, {
      attributes: ["title", "total_marks", "passing_marks", "duration_minutes"],
    });

    if (!exam) {
      throw new Error(`Exam with id ${mapping.exam_id} not found`);
    }

    // Get all questions for this exam
    const questionInstances = await Question.findAll({
      where: { exam_id: mapping.exam_id },
      order: [["created_on", "ASC"]],
    });
    const questions: IQuestion[] = questionInstances.map((q) => q.toJSON());

    // Get final answers from the mapping
    const finalAnswersMap = new Map<string, IFinalAnswer>(
      mapping.final_answers.map((ans: IFinalAnswer) => [ans.question_id, ans]),
    );

    // Create review details with all information
    const reviewDetails = questions.map((question) => {
      const answer: IFinalAnswer | undefined = finalAnswersMap.get(
        question.id!,
      );
      return {
        question_id: question.id,
        question_text: question.text,
        question_type: question.type,
        question_marks: question.marks,
        options: question.options,
        is_mandatory: question.is_mandatory,
        user_answer: answer ? answer.user_answer : null,
        is_correct: answer ? answer.is_correct : false,
        marks_obtained: answer ? answer.marks_obtained : 0,
        correct_answer: question.correct_answer,
        reviewer_comment: answer ? answer.reviewer_comment : null,
      };
    });

    // Calculate summary stats
    const totalQuestions = questions?.length;
    const correctAnswers = reviewDetails?.filter((q) => q?.is_correct).length;
    const totalMarksObtained = reviewDetails?.reduce(
      (sum, q) => sum + (q?.marks_obtained || 0),
      0,
    );
    const totalPossibleMarks = questions?.reduce(
      (sum, q) => sum + (q?.marks || 0),
      0,
    );
    const percentage =
      totalPossibleMarks > 0
        ? (totalMarksObtained / totalPossibleMarks) * 100
        : 0;
    const passed = totalMarksObtained >= (exam?.passing_marks || 0);
    let reviewerName = "";
    if (mapping?.reviewed_by) {
      try {
        const reviewerQuery = `
          SELECT first_name, middle_name, last_name
          FROM addmissions
          WHERE user_id = :userId AND client_id = :clientId
          LIMIT 1;
        `;
        let reviewerResult: any[] = await externalDB.query(reviewerQuery, {
          replacements: {
            userId: mapping?.reviewed_by,
            clientId: mapping?.client_id,
          },
          type: QueryTypes.SELECT,
        });

        if (reviewerResult.length === 0) {
          const usersQuery = `
            SELECT first_name, middle_name, last_name
            FROM users
            WHERE id = :userId
            LIMIT 1;
          `;
          reviewerResult = await externalDB.query(usersQuery, {
            replacements: { userId: mapping?.reviewed_by },
            type: QueryTypes.SELECT,
          });
        }

        if (reviewerResult.length > 0) {
          const { first_name, middle_name, last_name } = reviewerResult[0];
          reviewerName = [first_name, middle_name, last_name]
            .filter(Boolean)
            .join(" ");
        }
      } catch (e) {
        console.warn("Could not fetch reviewer name:", e);
      }
    }

    return {
      submission_id: mapping?.id,
      exam_id: mapping?.exam_id,
      user_id: mapping?.user_id,
      student_name: studentName,
      reviewer_name: reviewerName,
      test_name: exam?.title,
      total_marks: exam?.total_marks,
      passing_marks: exam?.passing_marks,
      duration_minutes: exam?.duration_minutes,
      submitted_at: mapping?.submitted_at,
      review_status: mapping?.review_status,
      summary: {
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        wrong_answers: totalQuestions - correctAnswers,
        achieved_marks: totalMarksObtained,
        total_marks: totalPossibleMarks,
        percentage: Math.round(percentage * 100) / 100,
        passed: passed,
        grade: passed ? "Pass" : "Fail",
      },
      review_details: reviewDetails,
    };
  }

  // --- exam publish timeline support ---
  async logExamPublishEvent(data: {
    assigned_id: string;
    assignment_id: string;
    user_id: string;
    publish: boolean;
  }) {
    const [record, created] =
      await AssignedActionItemsTimelineModel.findOrCreate({
        where: {
          assigned_id: data.assigned_id,
          assignment_id: data.assignment_id,
          user_id: data.user_id,
        },
        defaults: { publish: data.publish },
      });

    if (!created) {
      if (record.publish !== data?.publish) {
        record.publish = data?.publish;
        record.created_at = new Date();
        await record.save();
      }
    }

    return record;
  }

  async getExamPublishTimelineByUser(
    user_id?: string,
    publishOnly: boolean = false,
  ) {
    let sql = `
      SELECT
        tat.id,
        tat.assigned_id AS assigned_exam_id,
        tat.assignment_id AS exam_id,
        tat.user_id,
        tat.publish,
        tat.created_at,
          e.title,
        e.subject,
        e.total_marks,
        (
          SELECT eum.total_marks_obtained
          FROM exam_user_mappings eum
          WHERE eum.exam_id = e.id
            AND eum.user_id = tat.user_id
            AND eum.is_completed = true
          ORDER BY eum.submitted_at DESC
          LIMIT 1
        ) AS achieved_marks,        ---- assignment_status column removed; exam_assignments has no status field
        ea.class_info,
        ea.created_on AS assigned_at
      FROM publish_timeline tat
      LEFT JOIN exams e ON e.id = tat.assignment_id
      LEFT JOIN exam_assignments ea ON ea.id = tat.assigned_id
    `;

    const replacements: any = {};
    const conditions: string[] = [];

    if (user_id) {
      conditions.push(`tat.user_id = :user_id`);
      replacements.user_id = user_id;
    }

    if (publishOnly) {
      conditions.push(`tat.publish = true`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    // ordering by creation timestamp; update logic will reset created_at on state change
    sql += ` ORDER BY tat.created_at DESC`;

    const results: any[] = await sequelize.query(sql, {
      replacements,
      type: QueryTypes.SELECT,
    });
    return results;
  }
}
