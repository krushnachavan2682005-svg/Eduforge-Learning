import {
  Exam,
  Question,
  ExamSession,
  ExamUserMapping,
  ExamUserMappingPublic,
  ExamAssignment,
  ExamReview,
} from "./exam.model";
import { AssignedActionItemsTimelineModel } from "../assignActionItems/assignedActionItemsTimeline.model";
import { OrganizationUser } from "../roles/role.model";
import { sequelize } from "../../config/database";
import { paginate } from "../../utils/pagination";
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
} from "./exam.interface";
import { QueryTypes } from "sequelize";
import { asyncLocalStorage as cls } from "../../constants/request-context";

export class ExamRepository {
  private getTimestamps() {
    const now = new Date();
    return { created_on: now, updated_on: now };
  }

  getSessionContainer(raw: any) {
    if (raw && !Array.isArray(raw) && typeof raw === "object") {
      return {
        answers: Array.isArray(raw.answers) ? raw.answers : [],
        exam_snapshot: raw.exam_snapshot || null,
      };
    }

    return {
      answers: Array.isArray(raw) ? raw : [],
      exam_snapshot: null,
    };
  }

  public getSessionAnswers(session: any): IAnswerData[] {
    return this.getSessionContainer(session?.answers_data).answers;
  }

  public getSessionSnapshot(session: any) {
    const container = this.getSessionContainer(session?.answers_data);
    return container.exam_snapshot || null;
  }

  public toStudentExamSnapshot(snapshot: any) {
    if (!snapshot) return {};
    return {
      ...snapshot,
      questions: (snapshot.questions || []).map((question: any) => {
        const {
          correct_answer,
          correct_option,
          expected_answer,
          rubric,
          ...safeQuestion
        } = question;
        return safeQuestion;
      }),
    };
  }

  public buildExamSnapshot(examInstance: any) {
    const exam = examInstance?.toJSON ? examInstance.toJSON() : examInstance;
    const startTime = exam?.exam_start_time
      ? new Date(exam.exam_start_time)
      : null;
    const endTime =
      startTime && !isNaN(startTime.getTime())
        ? new Date(
            startTime.getTime() +
              (Number(exam?.duration_minutes) || 0) * 60 * 1000,
          )
        : null;

    return {
      exam_id: exam?.id,
      title: exam?.title,
      subject: exam?.subject,
      duration_minutes: Number(exam?.duration_minutes) || 0,
      start_time: startTime ? startTime.toISOString() : null,
      end_time: endTime ? endTime.toISOString() : null,
      exam_date: exam?.exam_date,
      exam_start_time: exam?.exam_start_time,
      total_marks: Number(exam?.total_marks) || 0,
      passing_marks: Number(exam?.passing_marks) || 0,
      reviewer_type: "teacher",
      reviewers: exam?.reviewers || [],
      organization_id: exam?.organization_id,
      questions: (exam?.questions || []).map((question: any) => {
        const q = question?.toJSON ? question.toJSON() : question;
        return {
          question_id: q?.id,
          id: q?.id,
          question_text: q?.text,
          text: q?.text,
          question_type: q?.type,
          type: q?.type,
          options: q?.options || null,
          correct_option: q?.correct_answer || null,
          correct_answer: q?.correct_answer || null,
          expected_answer: q?.correct_answer || null,
          rubric: q?.rubric || null,
          marks: Number(q?.marks) || 0,
          is_mandatory: q?.is_mandatory !== false,
        };
      }),
    };
  }

  async findAssignment(organizationId: string, userId: string, examId: string) {
    return ExamAssignment.findOne({
      where: {
        exam_id: examId,
        user_id: userId,
        organization_id: organizationId,
      },
    });
  }

  async findCompletedMapping(
    organizationId: string,
    userId: string,
    examId: string,
  ) {
    return ExamUserMapping.findOne({
      where: {
        exam_id: examId,
        user_id: userId,
        organization_id: organizationId,
        is_completed: true,
      },
    });
  }

  async findActiveSession(
    organizationId: string,
    userId: string,
    examId: string,
  ) {
    return ExamSession.findOne({
      where: {
        exam_id: examId,
        user_id: userId,
        organization_id: organizationId,
        is_completed: false,
      },
    });
  }

  async createFullExam(
    organizationId: string,
    data: IExam & { questions: IQuestion[] },
  ) {
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
          organization_id: organizationId || data.organization_id,
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
            organization_id: organizationId || data.organization_id,
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

  async getExamById(organizationId: string, examId: string) {
    const exam = await Exam.findOne({
      where: organizationId
        ? { id: examId, organization_id: organizationId }
        : { id: examId },
      include: [
        {
          model: Question,
          as: "questions",
        },
      ],
    });
    return exam;
  }

  async getExamsByIds(organizationId: string, examIds: string[]) {
    const { Op } = require("sequelize");
    const exams = await Exam.findAll({
      where: organizationId
        ? { id: { [Op.in]: examIds }, organization_id: organizationId }
        : { id: { [Op.in]: examIds } },
    });
    return exams;
  }

  async getAllExams(organizationId: string, limit: number, skip: number) {

    const { count, rows } = await Exam.findAndCountAll({
      where: organizationId ? { organization_id: organizationId } : undefined,
      attributes: [
        "id",
        "title",
        "subject",
        "total_marks",
        "passing_marks",
        "exam_date",
        "exam_start_time",
      ],
      include: [
        {
          model: Question,
          as: "questions",
          attributes: [
            "id",
            "exam_id",
            "type",
            "text",
            "marks",
            "is_mandatory",
            "options",
          ],
          separate: true,
        },
      ],
      limit,
      offset: skip,
      order: [["created_on", "DESC"]],
    });
    return { exams: rows, total: count };
  }

  async getAssignedExamsForUserFilter(
    organizationId: string,
    limit: number,
    skip: number,
    userId: string,
  ) {
    const includeOptions = [
      { model: Question, as: "questions", separate: true },
    ];

    const assignments = await ExamAssignment.findAll({
      where: organizationId
        ? { user_id: userId, organization_id: organizationId }
        : { user_id: userId },
      attributes: ["exam_id"],
    });

    if (assignments.length === 0) {
      return { exams: [], total: 0 };
    }

    const examIds = assignments.map((a) => a.exam_id);

    const { count, rows } = await Exam.findAndCountAll({
      where: organizationId
        ? { id: examIds, organization_id: organizationId }
        : { id: examIds },
      include: includeOptions,
      limit,
      offset: skip,
      order: [["created_on", "DESC"]],
    });
    return { exams: rows, total: count };
  }

  async getExamsByCreator(
    organizationId: string,
    userId: string,
    limit: number,
    skip: number,
  ) {
    const { count, rows } = await Exam.findAndCountAll({
      where: organizationId
        ? { created_by: userId, organization_id: organizationId }
        : { created_by: userId },
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

  async updateExam(organizationId: string, examId: string, data: IExamUpdate) {
    const transaction = await sequelize.transaction();
    try {
      const exam = await Exam.findOne({
        where: organizationId
          ? { id: examId, organization_id: organizationId }
          : { id: examId },
        transaction,
      });
      if (!exam) {
        return null;
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
      if (data.organization_id !== undefined)
        examUpdateData.organization_id = data.organization_id;

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

        const questionsToCreate: any[] = [];
        const questionsToUpdate: any[] = [];

        for (const questionData of data.questions) {
          if (questionData.id) {
            questionsToUpdate.push({
              id: questionData.id,
              exam_id: examId,
              type: questionData.type,
              text: questionData.text,
              marks: questionData.marks,
              is_mandatory: questionData.is_mandatory,
              correct_answer: questionData.correct_answer,
              options: questionData.options,
              organization_id: organizationId || data.organization_id,
              updated_on: new Date(),
            });
          } else {
            questionsToCreate.push({
              exam_id: examId,
              type: questionData.type!,
              text: questionData.text!,
              marks: questionData.marks!,
              is_mandatory: questionData.is_mandatory!,
              correct_answer: questionData.correct_answer,
              options: questionData.options,
              organization_id: organizationId || data.organization_id,
              created_on: new Date(),
              updated_on: new Date(),
            });
          }
        }

        if (questionsToCreate.length > 0) {
          await Question.bulkCreate(questionsToCreate, { transaction });
        }

        if (questionsToUpdate.length > 0) {
          await Question.bulkCreate(questionsToUpdate, {
            transaction,
            updateOnDuplicate: [
              "type",
              "text",
              "marks",
              "is_mandatory",
              "correct_answer",
              "options",
              "organization_id",
              "updated_on",
            ],
          });
        }
      }

      await transaction.commit();
      return await this.getExamById(organizationId, examId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteExam(organizationId: string, examId: string) {
    const transaction = await sequelize.transaction();
    try {
      const exam = await Exam.findOne({
        where: organizationId
          ? { id: examId, organization_id: organizationId }
          : { id: examId },
        transaction,
      });
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

  async getAssignmentsByUserId(userId: string) {
    return ExamAssignment.findAll({
      where: { user_id: userId },
      attributes: ["id", "exam_id"],
    });
  }

  async paginateExams(page: number, limit: number, examIds: string[]) {
    return paginate(Exam, {
      attributes: [
        "id",
        "title",
        "subject",
        "total_marks",
        "passing_marks",
        "duration_minutes",
        "exam_date",
        "exam_start_time",
      ],
      page,
      limit,
      filters: { id: examIds },
      include: [
        {
          model: Question,
          as: "questions",
          attributes: [
            "id",
            "exam_id",
            "type",
            "text",
            "marks",
            "is_mandatory",
            "options",
          ],
          separate: true,
        },
      ],
      order: [["created_on", "DESC"]],
    });
  }

  async getExamUserMappingsForExams(
    userId: string,
    examIds: string[],
    isCompleted: boolean,
  ) {
    return ExamUserMapping.findAll({
      where: { user_id: userId, exam_id: examIds, is_completed: isCompleted },
      attributes: ["exam_id", "is_completed", "review_status", "submitted_at"],
    });
  }

  async getPublishTimelinesForAssignments(assignmentIds: string[]) {
    return AssignedActionItemsTimelineModel.findAll({
      where: { assigned_id: assignmentIds },
      attributes: ["assigned_id", "publish", "created_at"],
      order: [["created_at", "DESC"]],
    });
  }

  async countValidOrganizationUsers(organizationId: string, userIds: string[]) {
    return OrganizationUser.count({
      where: {
        organization_id: organizationId,
        user_id: userIds,
        is_active: true,
      },
    });
  }

  async bulkCreateExamAssignments(assignments: any[]) {
    return ExamAssignment.bulkCreate(assignments, {
      ignoreDuplicates: true,
      returning: true,
    });
  }

  // Removed getAssignedExamsForUser and gradeMcqExam since formatting/grading moved to service

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
        return existingSession.toJSON() as IExamSession;
      }

      const store = cls.getStore();
      const organizationId = store?.organizationId;

      const exam = await Exam.findOne({
        where: organizationId
          ? { id: data.exam_id, organization_id: organizationId }
          : { id: data.exam_id },
        include: [{ model: Question, as: "questions" }],
        transaction,
      });
      if (!exam) throw new Error(`Exam with id ${data.exam_id} not found`);
      const snapshot = this.buildExamSnapshot(exam);

      const session = await ExamSession.create(
        {
          exam_id: data?.exam_id,
          user_id: data?.user_id,
          current_question_index: data?.current_question_index || 0,
          organization_id: data?.organization_id,
          answers_data: {
            answers: data?.answers_data || [],
            exam_snapshot: snapshot,
          },
          started_at: new Date(),
          is_completed: false,
          reviewers: snapshot.reviewers || [],
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
    session_id: string;
    started_at: Date;
    is_completed: boolean;
    name: string | null;
    email: string;
  }) {
    return await ExamUserMappingPublic.create(data);
  }
  async resumePublicExamSession(session_id: string) {
    const session = await ExamUserMappingPublic.findOne({
      where: { session_id },
    });
    return {
      success: true,
      data: {
        session_id,
        exam: session?.exam_id,
        answers: session?.final_answers || [],
        is_completed: session?.is_completed,
      },
    };
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
      attributes: ["name", "exam_id", "submitted_at"],

      order: [
        ["submitted_at", "DESC"],
        ["id", "DESC"],
      ],
    });

    return result;
  }
  async atomicSaveAnswer(
    sessionId: string,
    questionId: string,
    userAnswer: string,
    questionIndex: number,
    snapshot: any,
  ): Promise<any> {
    const transaction = await sequelize.transaction();
    try {
      const session = await ExamSession.findByPk(sessionId, {
        transaction,
        lock: true,
      });
      if (!session) throw new Error("Session not found");
      if (session.is_completed)
        throw new Error("Exam session already completed");

      const container = this.getSessionContainer(session.answers_data);
      const answersData = container.answers;
      const filteredAnswers = answersData.filter(
        (answer: any) => answer.question_id !== questionId,
      );

      const newAnswer = {
        question_id: questionId,
        user_answer: userAnswer,
        answered_at: new Date(),
        question_index: questionIndex,
      };

      const updateData: any = {
        answers_data: {
          answers: [...filteredAnswers, newAnswer],
          exam_snapshot: container.exam_snapshot || snapshot,
        },
        current_question_index: questionIndex + 1,
        updated_on: new Date(),
      };

      await session.update(updateData, { transaction });
      await transaction.commit();

      return (await ExamSession.findByPk(sessionId))?.toJSON();
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

  async beginTransaction() {
    return sequelize.transaction();
  }

  async findCompletedMappingBySession(sessionId: string, userId: string) {
    return ExamUserMapping.findOne({
      where: { session_id: sessionId, user_id: userId },
    });
  }

  async updateSessionStatus(
    sessionId: string,
    isCompleted: boolean,
    transaction: any,
  ) {
    return ExamSession.update(
      {
        is_completed: isCompleted,
        completed_at: new Date(),
        updated_on: new Date(),
      },
      { where: { id: sessionId }, transaction },
    );
  }

  async createExamMapping(data: any, transaction: any) {
    return ExamUserMapping.create(data, { transaction });
  }

  async getFullMapping(mappingId: string) {
    const fullMapping = await ExamUserMapping.findByPk(mappingId, {
      include: [
        {
          model: Exam,
          as: "exam",
          include: [{ model: Question, as: "questions" }],
        },
        { model: ExamSession, as: "session" },
      ],
    });
    return fullMapping?.toJSON();
  }

  async getMappingForUpdate(sessionId: string, transaction: any) {
    return ExamUserMapping.findOne({
      where: { session_id: sessionId },
      include: [
        {
          model: Exam,
          as: "exam",
          include: [{ model: Question, as: "questions" }],
        },
      ],
      transaction,
    });
  }

  async upsertReviewRecord(mappingId: string, data: any, transaction: any) {
    const [reviewRecord, created] = await ExamReview.findOrCreate({
      where: { exam_user_mapping_id: mappingId },
      defaults: data,
      transaction,
    });

    if (!created) {
      await reviewRecord.update(data, { transaction });
    }
    return reviewRecord;
  }

  async updateMapping(mappingId: string, data: any, transaction: any) {
    return ExamUserMapping.update(data, {
      where: { id: mappingId },
      transaction,
    });
  }

  async getExamResults(sessionId: string, userId: string) {
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
      mapping: mapping.toJSON(),
      exam: (mapping as any).exam?.toJSON(),
      session: (mapping as any).session?.toJSON(),
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
          eum.organization_id,
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

      return results;
    } catch (error) {
      console.error("Error fetching reviewer dashboard exams:", error);
      throw error;
    }
  }

  async getExamUserMappingWithExam(sessionId: string, userId: string) {
    const mapping = await ExamUserMapping.findOne({
      where: { session_id: sessionId, user_id: userId },
    });
    if (!mapping) return null;
    const exam = await Exam.findByPk(mapping.exam_id, {
      attributes: ["title", "total_marks", "passing_marks", "duration_minutes"],
    });
    return { mapping, exam };
  }

  async getExamUserMappingByExamId(
    examId: string,
    userId: string,
    organizationId: string,
  ) {
    const mapping = await ExamUserMapping.findOne({
      where: {
        exam_id: examId,
        user_id: userId,
        organization_id: organizationId,
      },
    });
    if (!mapping) return null;
    const exam = await Exam.findByPk(mapping.exam_id, {
      attributes: ["title", "total_marks", "passing_marks", "duration_minutes"],
    });
    return { mapping, exam };
  }

  async getExamReviewRecord(mappingId: string) {
    return ExamReview.findOne({
      where: { exam_user_mapping_id: mappingId },
      attributes: ["reviewed_at", "reviewers", "reviewer_comment"],
    });
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

  async bulkLogExamPublishEvent(
    dataArray: {
      assigned_id: string;
      assignment_id: string;
      user_id: string;
      publish: boolean;
    }[],
  ) {
    const payloads = dataArray.map((data) => ({
      assigned_id: data.assigned_id,
      assignment_id: data.assignment_id,
      user_id: data.user_id,
      publish: data.publish,
      created_at: new Date(),
    }));

    return AssignedActionItemsTimelineModel.bulkCreate(payloads, {
      ignoreDuplicates: true,
    });
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
