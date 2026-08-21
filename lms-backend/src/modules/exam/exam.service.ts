import { ExamRepository } from "./exam.repository";
import { ForbiddenError, NotFoundError, ValidationError } from "../../utils/globalErrorHandlingFile";
import { StudentRepository } from "../students/student.repository";
import { IExamCreateRequest, IExamUpdate } from "./exam.interface";
import { v4 as uuid } from "uuid";

export class ExamService {
  private repository = new ExamRepository();
  private studentRepository = new StudentRepository();

  async createExam(organizationId: string, userId: string, data: IExamCreateRequest) {
    const examData = {
      ...data,
      organization_id: organizationId,
      created_by: userId || data.created_by,
      updated_by: userId || (data as any).updated_by || data.created_by,
    };

    return this.repository.createFullExam(organizationId, examData);
  }

  async getExams(organizationId: string, page: number, limit: number, userId?: string) {
    const skip = (page - 1) * limit;

    if (userId) {
      return this.repository.getAssignedExamsForUserFilter(organizationId, limit, skip, userId);
    }

    return this.repository.getAllExams(organizationId, limit, skip);
  }

  async getExamById(organizationId: string, examId: string) {
    const exam = await this.repository.getExamById(organizationId, examId);
    if (!exam) {
      throw new NotFoundError("Exam not found");
    }
    return exam;
  }

  async getExamsByCreator(organizationId: string, userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return this.repository.getExamsByCreator(organizationId, userId, limit, skip);
  }

  async updateExam(organizationId: string, examId: string, userId: string, data: IExamUpdate) {
    const updateData = {
      ...data,
      organization_id: organizationId,
      updated_by: userId || (data as any).updated_by,
    };

    const updated = await this.repository.updateExam(organizationId, examId, updateData);
    if (!updated) {
      throw new NotFoundError("Exam not found");
    }
    return updated;
  }

  async deleteExam(organizationId: string, examId: string) {
    const success = await this.repository.deleteExam(organizationId, examId);
    if (!success) {
      throw new NotFoundError("Exam not found");
    }
    return success;
  }

  // --- Helpers ---
  private toStudentExamSnapshot(snapshot: any) {
    if (!snapshot) return {};
    return {
      ...snapshot,
      questions: (snapshot.questions || []).map((question: any) => {
        const { correct_answer, correct_option, expected_answer, rubric, ...safeQuestion } = question;
        return safeQuestion;
      }),
    };
  }

  private buildExamSnapshot(examInstance: any) {
    const exam = examInstance?.toJSON ? examInstance.toJSON() : examInstance;
    const startTime = exam?.exam_start_time ? new Date(exam.exam_start_time) : null;
    const endTime =
      startTime && !isNaN(startTime.getTime())
        ? new Date(startTime.getTime() + (Number(exam?.duration_minutes) || 0) * 60 * 1000)
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

  private getExamStartAt(exam: any): Date | null {
    const start = exam?.exam_start_time ? new Date(exam.exam_start_time) : null;
    return start && !isNaN(start.getTime()) ? start : null;
  }

  private getExamEndAt(exam: any): Date | null {
    const start = this.getExamStartAt(exam);
    const duration = Number(exam?.duration_minutes) || 0;
    if (!start || duration <= 0) return null;
    return new Date(start.getTime() + duration * 60 * 1000);
  }

  private buildStartExamResponse(session: any, snapshot: any, savedAnswers: any[]) {
    const safeExam = this.toStudentExamSnapshot(snapshot);
    const safeQuestions = (safeExam.questions || []).map((question: any) => {
      const rawType = String(question?.question_type || question?.type || "").toLowerCase();
      const normalizedType = rawType === "mcq" ? "mcq" : "theory";
      const options = Array.isArray(question?.options)
        ? question.options
        : Array.isArray(question?.choices)
          ? question.choices
          : Array.isArray(question?.answer_options)
            ? question.answer_options
            : [];

      return {
        ...question,
        id: question?.id || question?.question_id,
        question_id: question?.question_id || question?.id,
        question_text: question?.question_text || question?.question || question?.title || question?.text || "",
        text: question?.text || question?.question_text || question?.question || question?.title || "",
        question_type: normalizedType,
        type: rawType || normalizedType,
        options,
        marks: Number(question?.marks) || 0,
      };
    });
    const now = new Date();
    let expiresAt = safeExam.end_time ? new Date(safeExam.end_time) : null;
    if (!expiresAt || isNaN(expiresAt.getTime())) {
      const duration = Number(safeExam.duration_minutes) || 0;
      const startedAt = session?.started_at ? new Date(session.started_at) : now;
      expiresAt = duration > 0 ? new Date(startedAt.getTime() + duration * 60 * 1000) : null;
    }
    const remainingSeconds = expiresAt && !isNaN(expiresAt.getTime())
      ? Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
      : Math.max(0, (Number(safeExam.duration_minutes) || 0) * 60);

    const exam = {
      id: safeExam.exam_id,
      title: safeExam.title,
      subject: safeExam.subject,
      duration_minutes: Number(safeExam.duration_minutes) || 0,
      total_marks: Number(safeExam.total_marks) || 0,
      passing_marks: Number(safeExam.passing_marks) || 0,
      started_at: session?.started_at || null,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      start_time: safeExam.start_time || safeExam.exam_start_time || null,
      end_time: safeExam.end_time || (expiresAt ? expiresAt.toISOString() : null),
      exam_date: safeExam.exam_date || null,
      exam_start_time: safeExam.exam_start_time || safeExam.start_time || null,
      reviewer_type: safeExam.reviewer_type || "teacher",
      questions: safeQuestions,
    };

    return {
      session_id: session.id!,
      current_question_index: session.current_question_index || 0,
      total_questions: safeQuestions.length,
      current_question: safeQuestions[session.current_question_index || 0] || null,
      exam,
      questions: safeQuestions,
      remaining_seconds: remainingSeconds,
      exam_details: exam,
      saved_answers: savedAnswers || [],
    };
  }

  // --- Batch 2 Endpoints ---

  async startExam(organizationId: string, userId: string, examId: string) {
    const assignment = await this.repository.findAssignment(organizationId, userId, examId);
    if (!assignment) {
      throw new ForbiddenError("TEST_NOT_ASSIGNED: This test is not assigned to you.");
    }

    const submitted = await this.repository.findCompletedMapping(organizationId, userId, examId);
    if (submitted) {
      throw new ForbiddenError("TEST_ALREADY_SUBMITTED: You have already submitted this test.");
    }

    const activeSession = await this.repository.findActiveSession(organizationId, userId, examId);
    if (activeSession) {
      let snapshot = this.repository.getSessionSnapshot(activeSession);
      if (!snapshot) {
        const legacyExam = await this.repository.getExamById(organizationId, examId);
        snapshot = this.buildExamSnapshot(legacyExam);
      }
      return this.buildStartExamResponse(
        activeSession,
        snapshot,
        this.repository.getSessionAnswers(activeSession),
      );
    }

    const exam = await this.repository.getExamById(organizationId, examId);
    if (!exam) {
      throw new NotFoundError("Exam not found");
    }

    const startAt = this.getExamStartAt(exam);
    const endAt = this.getExamEndAt(exam);
    const now = new Date();
    if (startAt && now < startAt) {
      throw new ForbiddenError("TEST_NOT_STARTED: This test has not started yet.");
    }
    if (endAt && now > endAt) {
      throw new ForbiddenError("TEST_EXPIRED: This test has expired.");
    }

    const questions = (exam as any).questions || [];
    if (questions.length === 0) {
      throw new ForbiddenError("Exam has no questions");
    }

    const session = await this.repository.startExamSession({
      exam_id: examId,
      user_id: userId,
      organization_id: organizationId,
      current_question_index: 0,
      reviewers: (exam as any).reviewers || [],
    });
    
    // Fallback if session doesn't contain a snapshot initially
    let snapshot = this.repository.getSessionSnapshot(session);
    if (!snapshot) {
      snapshot = this.buildExamSnapshot(exam);
    }

    return this.buildStartExamResponse(
      session,
      snapshot,
      this.repository.getSessionAnswers(session),
    );
  }

  async startPublicExam(examId: string, userData: { first_name: string; last_name: string; email: string }) {
    const exam = await this.repository.getExamById("", examId);
    if (!exam) {
      throw new NotFoundError("Exam not found");
    }

    const questions = (exam as any).questions || [];
    const hasNonMcq = questions.some((q: any) => q.type !== "mcq");
    if (hasNonMcq) {
      throw new ForbiddenError("For Public Exam only MCQ is allowed");
    }

    const session_id = uuid();
    const name = [userData.first_name, userData.last_name].filter((v) => v && v.trim() !== "").join(" ") || null;
    
    await this.repository.createPublicExamSession({
      exam_id: examId,
      session_id,
      started_at: new Date(),
      is_completed: false,
      name,
      email: userData.email,
    });

    return {
      exam_details: exam,
      session_id,
    };
  }

  async savePublicExamAnswer(examId: string, sessionId: string, newAnswers: Array<{ question_id: string; user_answer: string }>) {
    const session = await this.repository.getPublicExamSessionBySessionId(sessionId);
    if (!session || session.exam_id !== examId) {
      throw new ForbiddenError("Exam_id or Session_id not match");
    }

    const existingAnswers = session.final_answers || [];
    const mergedAnswers = [...existingAnswers];

    for (const newAnswer of newAnswers) {
      const index = mergedAnswers.findIndex((ans: any) => ans.question_id === newAnswer.question_id);
      if (index !== -1) {
        mergedAnswers[index] = newAnswer;
      } else {
        mergedAnswers.push(newAnswer);
      }
    }

    await this.repository.updatePublicExamSession(sessionId, {
      final_answers: mergedAnswers,
    });

    return mergedAnswers;
  }

  async resumePublicExamSession(sessionId: string) {
    const session = await this.repository.getPublicExamSessionBySessionId(sessionId);
    if (!session) {
      throw new NotFoundError("Session Id not found");
    }
    return {
      session_id: sessionId,
      exam: session.exam_id,
      answers: session.final_answers || [],
      is_completed: session.is_completed,
    };
  }

  async submitPublicExam(examId: string, sessionId: string, answers: Array<{ question_id: string; user_answer: string }>) {
    const session = await this.repository.getPublicExamSessionBySessionId(sessionId);
    if (!session || session.exam_id !== examId) {
      throw new ForbiddenError("Exam_id or Session_id Not Match");
    }

    if (session.is_completed) {
      throw new ForbiddenError("Exam already submitted");
    }

    const exam = await this.repository.getExamById("", examId);
    if (!exam) {
      throw new NotFoundError("Exam not found");
    }

    const questions = (exam as any).questions || [];

    let total_correct = 0;
    let obtainedMarks = 0;

    questions.forEach((q: any) => {
      const userAnswerObj = answers.find((a) => a.question_id === q.id);
      if (!userAnswerObj) return;

      const userAnswer = userAnswerObj.user_answer;
      const correctAnswer = q.correct_answer;

      if (userAnswer?.trim().toLowerCase() === correctAnswer?.trim().toLowerCase()) {
        total_correct++;
        obtainedMarks += Number(q.marks) || 0;
      }
    });

    const total_questions = questions.length;
    const totalMarks = Number((exam as any).total_marks) || 0;
    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
    const passed = obtainedMarks >= Number((exam as any).passing_marks || 0);

    await this.repository.updatePublicExamSession(sessionId, {
      total_marks_obtained: obtainedMarks,
      total_possible_marks: totalMarks,
      percentage,
      passed,
      final_answers: answers,
      submitted_at: new Date(),
      is_completed: true,
    });

    return {
      name: session.name,
      total_questions,
      total_correct,
      percentage,
      passed,
      score: obtainedMarks,
      session_id: sessionId,
    };
  }

  async getPublicExamResult(page: number, limit: number) {
    return this.repository.getPublicExamResult(page, limit);
  }

  // --- Batch 3 Endpoints ---

  async saveAnswer(organizationId: string, userId: string, sessionId: string, questionId: string, userAnswer: string, questionIndex: number) {
    const session = await this.repository.getExamSession(sessionId, userId);
    if (!session) throw new NotFoundError("Exam session not found or access denied");
    if (session.is_completed) throw new ValidationError("Exam session is already completed");

    const container = this.repository.getSessionContainer(session.answers_data);
    let snapshot = container.exam_snapshot;
    if (!snapshot) {
      const exam = await this.repository.getExamById(organizationId, session.exam_id);
      snapshot = this.repository.buildExamSnapshot(exam);
    }
    const snapshotQuestions = snapshot?.questions || [];

    if (!snapshotQuestions.length) {
      throw new NotFoundError("Exam or questions not found");
    }

    const totalQuestions = snapshotQuestions.length;
    if (questionIndex < 0 || questionIndex >= totalQuestions) {
      throw new ValidationError(`Invalid question index: ${questionIndex}. Total questions: ${totalQuestions}`);
    }

    const questionExists = snapshotQuestions.some(
      (q: any) => q.id === questionId || q.question_id === questionId
    );
    if (!questionExists) {
      throw new NotFoundError(`Question with id ${questionId} not found in this exam`);
    }

    const isExamComplete = questionIndex === totalQuestions - 1;

    const updatedSession = await this.repository.atomicSaveAnswer(
      sessionId,
      questionId,
      userAnswer,
      questionIndex,
      snapshot
    );

    return {
      session: updatedSession,
      isExamComplete
    };
  }

  private validateAnswer(question: any, userAnswer: string) {
    if (question.type !== "mcq" || !question.correct_answer) {
      return { isCorrect: false, marksObtained: 0 };
    }
    const isCorrect = String(question.correct_answer).trim().toLowerCase() === String(userAnswer || "").trim().toLowerCase();
    return { isCorrect, marksObtained: isCorrect ? Number(question.marks) || 0 : 0 };
  }

  private calculateExamResults(questions: any[], answers: any[], examPassingMarks: number) {
    const finalAnswers: any[] = [];
    let totalMarksObtained = 0;
    const totalPossibleMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

    questions.forEach((question: any) => {
      const questionId = question.id || question.question_id;
      const userAnswer = answers.find((a: any) => a.question_id === questionId);
      const validation = userAnswer ? this.validateAnswer(question, userAnswer.user_answer) : { isCorrect: false, marksObtained: 0 };

      const finalAnswer = {
        question_id: questionId!,
        question_type: question.type,
        question_text: question.text || question.question_text,
        options: question.options || null,
        is_mandatory: question.is_mandatory !== false,
        user_answer: userAnswer?.user_answer || "",
        is_correct: validation.isCorrect,
        marks_obtained: validation.marksObtained,
        correct_answer: question.correct_answer,
        question_marks: Number(question.marks) || 0,
        reviewer_comment: "",
        snapshot_passing_marks: examPassingMarks,
      };

      finalAnswers.push(finalAnswer);
      totalMarksObtained += validation.marksObtained;
    });

    const percentage = totalPossibleMarks > 0 ? (totalMarksObtained / totalPossibleMarks) * 100 : 0;
    const passed = totalMarksObtained >= examPassingMarks;

    return {
      finalAnswers,
      totalMarksObtained,
      totalPossibleMarks,
      percentage: Math.round(percentage * 100) / 100,
      passed,
    };
  }

  async submitExam(organizationId: string, userId: string, sessionId: string) {
    const session = await this.repository.getExamSession(sessionId, userId);
    if (!session) throw new NotFoundError("Exam session not found or access denied.");
    if (session.is_completed) {
      return { alreadyCompleted: true };
    }

    const existingMapping = await this.repository.findCompletedMappingBySession(sessionId, userId);
    if (existingMapping) {
      return { alreadyCompleted: true };
    }

    const exam = session.exam;
    if (!exam) throw new NotFoundError("Exam not found for this session");

    const container = this.repository.getSessionContainer(session.answers_data);
    const snapshot = container.exam_snapshot || this.repository.buildExamSnapshot(exam);
    const snapshotQuestions = snapshot?.questions || [];
    if (!snapshotQuestions.length) throw new NotFoundError("Questions not found for this exam.");

    const examPassingMarks = Number(snapshot.passing_marks) || Number(exam.passing_marks) || 0;
    const results = this.calculateExamResults(snapshotQuestions, container.answers, examPassingMarks);

    const timeTakenMinutes = session.started_at
      ? Math.round((new Date().getTime() - new Date(session.started_at).getTime()) / 60000)
      : 0;

    const hasManualReviewQuestions = snapshotQuestions.some((q: any) =>
      ["short", "long", "practical"].includes(q.type)
    );
    const reviewStatus = hasManualReviewQuestions ? "pending_review" : "completed";

    const transaction = await this.repository.beginTransaction();
    try {
      await this.repository.updateSessionStatus(sessionId, true, transaction);

      const mappingData = {
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
        review_status: reviewStatus,
        organization_id: (session as any).organization_id || organizationId,
        reviewers: snapshot.reviewers || (exam as any).reviewers || [],
        created_on: new Date(),
      };

      const mapping = await this.repository.createExamMapping(mappingData, transaction);
      await transaction.commit();

      const fullMapping = await this.repository.getFullMapping(mapping.id);

      return {
        alreadyCompleted: false,
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

  async getExamResults(organizationId: string, userId: string, sessionId: string) {
    const results = await this.repository.getExamResults(sessionId, userId);
    if (results.mapping && (results.mapping as any).organization_id && (results.mapping as any).organization_id !== organizationId) {
      throw new ForbiddenError("Not authorized to view these results");
    }
    return results;
  }

  async reviewExam(organizationId: string, sessionId: string, reviewData: any) {
    const transaction = await this.repository.beginTransaction();
    try {
      const mapping = await this.repository.getMappingForUpdate(sessionId, transaction);
      if (!mapping) throw new NotFoundError(`Exam results not found for session ${sessionId}`);

      if ((mapping as any).organization_id && (mapping as any).organization_id !== organizationId) {
        throw new ForbiddenError("Not authorized to review this exam");
      }

      const exam = (mapping as any).exam;
      if (!exam || !exam.questions) throw new NotFoundError("Exam or questions not found for this mapping.");

      const originalFinalAnswers = (mapping as any).final_answers || [];
      const reviewedAnswersMap = new Map<string, any>((reviewData.reviewed_answers || []).map((a: any) => [a.question_id, a]));
      let totalMarksObtained = Number((mapping as any).total_marks_obtained) || 0;

      const updatedFinalAnswers = originalFinalAnswers.map((originalAnswer: any) => {
        const reviewedAnswer = reviewedAnswersMap.get(originalAnswer.question_id);
        if (reviewedAnswer) {
          totalMarksObtained = totalMarksObtained - Number(originalAnswer.marks_obtained || 0) + Number(reviewedAnswer.marks_obtained || 0);
          return {
            ...originalAnswer,
            marks_obtained: Number(reviewedAnswer.marks_obtained || 0),
            is_correct: reviewedAnswer.is_correct,
            reviewer_comment: reviewedAnswer.reviewer_comment,
          };
        }
        return originalAnswer;
      });

      const totalPossibleMarks = Number((mapping as any).total_possible_marks) || 0;
      const percentage = totalPossibleMarks > 0 ? (totalMarksObtained / totalPossibleMarks) * 100 : 0;
      const snapshotPassingMarks = Number((originalFinalAnswers[0] as any)?.snapshot_passing_marks) || Number(exam?.passing_marks) || 0;
      const passed = totalMarksObtained >= snapshotPassingMarks;

      const manualQuestionIds = new Set<string>(
        originalFinalAnswers
          .filter((answer: any) => ["short", "long", "practical"].includes(answer.question_type))
          .map((answer: any) => answer.question_id)
      );
      const isReviewComplete = Array.from(manualQuestionIds).every((qid) => reviewedAnswersMap.has(qid));

      const reviewersForRecord = reviewData.reviewers || (mapping as any).reviewers || [];

      const reviewRecordData = {
        exam_id: exam.id,
        exam_user_mapping_id: (mapping as any).id,
        reviewers: reviewersForRecord,
        reviewed_at: new Date(),
        reviewed_answers: updatedFinalAnswers,
        total_marks_obtained: totalMarksObtained,
        percentage: Math.round(percentage * 100) / 100,
        passed,
        organization_id: (mapping as any).organization_id,
      };

      const reviewRecord = await this.repository.upsertReviewRecord((mapping as any).id, reviewRecordData, transaction);

      const mappingUpdateData = {
        total_marks_obtained: totalMarksObtained,
        percentage: Math.round(percentage * 100) / 100,
        passed,
        final_answers: updatedFinalAnswers,
        review_status: isReviewComplete ? "completed" : "pending_review",
        reviewed_by: (reviewersForRecord[0] && reviewersForRecord[0].id) || null,
        reviewed_at: new Date(),
      };

      await this.repository.updateMapping((mapping as any).id, mappingUpdateData, transaction);
      await transaction.commit();

      return { mapping: { ...(mapping as any).toJSON(), ...mappingUpdateData }, review: reviewRecord.toJSON() };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async assignExam(organizationId: string, examIds: string[], userIds: string[], classIds: string[]) {
    const validExamIds: string[] = [];
    for (const examId of examIds) {
      const exam = await this.repository.getExamById(organizationId, examId);
      if (!exam) throw new NotFoundError(`Exam with ID '${examId}' not found.`);
      if ((exam as any).organization_id && (exam as any).organization_id !== organizationId) {
         throw new ForbiddenError(`Exam with ID '${examId}' does not belong to this organization.`);
      }
      validExamIds.push(examId);
    }
    let finalUserIds: string[] = [];
    let classInfo: { id: string; name: string } | undefined;
    if (userIds && userIds.length) {
       finalUserIds.push(...userIds);
    }
    for (const classId of classIds) {
       const classUserIds = await this.studentRepository.getUserIdsByClassId(organizationId, classId);
       const classDetails = await this.studentRepository.getClassById(organizationId, classId);
       finalUserIds.push(...classUserIds);
       if (classDetails && !classInfo) {
         classInfo = { id: classDetails.id, name: classDetails.name };
       }
    }
    finalUserIds = [...new Set(finalUserIds)];
    if (!finalUserIds.length) throw new ValidationError('No users found to assign.');
    const validMembersCount = await this.repository.countValidOrganizationUsers(organizationId, finalUserIds);
    if (validMembersCount !== finalUserIds.length) {
       throw new ValidationError('One or more users do not belong to this organization or are inactive.');
    }
    const assignmentsToCreate = [];
    for (const examId of validExamIds) {
      for (const userId of finalUserIds) {
         assignmentsToCreate.push({
           exam_id: examId,
           user_id: userId,
           organization_id: organizationId,
           class_info: classInfo || null,
         });
      }
    }
    const assignments = await this.repository.bulkCreateExamAssignments(assignmentsToCreate);
    for (const assignment of assignments) {
       if (!(assignment as any).id) continue;
       try {
         await this.repository.logExamPublishEvent({
           assigned_id: (assignment as any).id,
           assignment_id: (assignment as any).exam_id,
           user_id: (assignment as any).user_id,
           publish: false,
         });
       } catch (err) {
         console.warn('Failed to log publish event for single assignment', err);
       }
    }
    return assignments;
  }

  async getAssignedExams(organizationId: string, userId: string, page: number, limit: number) {
    const assignments = await this.repository.getAssignmentsByUserId(userId);
    if (assignments.length === 0) return { items: [], pagination: { total: 0, page, limit, totalPages: 0 } };
    const examIds = assignments.map((a: any) => a.exam_id);
    const assignmentMap = new Map<string, string>();
    assignments.forEach((a: any) => { if (a.exam_id && a.id) assignmentMap.set(a.exam_id, a.id); });
    const { items: exams, pagination } = await this.repository.paginateExams(page, limit, examIds);
    const mappings = await this.repository.getExamUserMappingsForExams(userId, examIds, true);
    const completedExamIds = new Set(mappings.map((m: any) => m.exam_id));
    const reviewStatusMap = new Map<string, string>();
    mappings.forEach((m: any) => { if (m.exam_id && m.review_status) reviewStatusMap.set(m.exam_id, m.review_status); });
    const assignmentIds = assignments.map((a: any) => a.id);
    const timelineRecords = await this.repository.getPublishTimelinesForAssignments(assignmentIds);
    const publishMap = new Map<string, boolean>();
    timelineRecords.forEach((r: any) => {
      const aid = r.assigned_id;
      if (!publishMap.has(aid)) publishMap.set(aid, !!r.publish);
    });
    const processed = exams.map((exam: any) => {
      const examJson = exam.toJSON();
      const snapshot = (this.repository as any).buildExamSnapshot(examJson);
      const questions = (examJson.questions || []).map((q: any) => { const { correct_answer, ...rest } = q; return rest; });
      const is_completed = examJson.id ? completedExamIds.has(examJson.id) : false;
      const review_status = examJson.id ? reviewStatusMap.get(examJson.id) || 'Pending Review' : 'Pending Review';
      let is_published = false;
      let test_id = null;
      if (examJson.id) {
        const aid = assignmentMap.get(examJson.id);
        if (aid) { is_published = publishMap.get(aid) ?? false; test_id = aid; }
      }
      const base = { ...examJson };
      delete base.is_completed;
      delete base.questions;
      const now = new Date();
      const startAt = snapshot.start_time ? new Date(snapshot.start_time) : null;
      const endAt = snapshot.end_time ? new Date(snapshot.end_time) : null;
      const availability_status = is_completed ? 'submitted' : startAt && now < startAt ? 'not_started' : endAt && now > endAt ? 'expired' : 'available';
      return { ...base, test_id, is_published, is_completed, review_status, start_time: snapshot.start_time, end_time: snapshot.end_time, availability_status, questions };
    });
    return { items: processed, pagination };
  }

  async publishAssignedExam(assignedId: string, assignmentId: string, userId: string, publish: boolean) {
    const assignments = await this.repository.getAssignmentsByUserId(userId);
    const assignment = assignments.find((a: any) => a.id === assignedId && a.exam_id === assignmentId);
    if (!assignment) throw new NotFoundError('Assigned exam not found');
    await this.repository.logExamPublishEvent({ assigned_id: assignedId, assignment_id: assignmentId, user_id: userId, publish });
    return { assigned_id: assignedId, assignment_id: assignmentId, publish };
  }

  async getAssignedExamPublishTimeline(organizationId: string, userId: string | undefined) {
    const raw = await this.repository.getExamPublishTimelineByUser(userId, !userId);
    let studentNameMap: Record<string, string> = {};
    if (raw.length) {
      const uniqueUserIds = [...new Set(raw.map((r: any) => r.user_id))];
      const orgId = organizationId || (raw[0] as any)?.organization_id || '';
      studentNameMap = await this.studentRepository.getStudentNamesByUserIds(orgId, uniqueUserIds);
    }
    return raw.map((item: any) => ({
      studentName: studentNameMap[item.user_id] || '',
      type: 'Exam',
      title: item.title || '',
      description: item.subject || '',
      date: item.created_at ? item.created_at.toISOString().split('T')[0] : null,
      achieved_marks: item.achieved_marks || '',
      total_marks: item.total_marks || '',
      raw: item
    }));
  }

  async getReviewerDashboard(reviewerId: string) {
    const results = await this.repository.getReviewerDashboardExams(reviewerId);
    if (results.length === 0) return [];
    const namesByOrg = new Map<string, Record<string, string>>();
    const orgIds = [...new Set(results.map((r: any) => r?.organization_id).filter(Boolean))];
    for (const organizationId of orgIds) {
      const userIds = [...new Set(results.filter((r: any) => r?.organization_id === organizationId).map((r: any) => r?.user_id).filter(Boolean))];
      namesByOrg.set(organizationId as string, await this.studentRepository.getStudentNamesByUserIds(organizationId as string, userIds as string[]));
    }
    return results.map((r: any) => ({ ...r, student_name: namesByOrg.get(r?.organization_id as string)?.[r?.user_id as string] || '' }));
  }

  async getSubmissionForReview(organizationId: string, userId: string, sessionId: string) {
    const res = await this.repository.getExamUserMappingWithExam(sessionId, userId);
    if (!res) throw new NotFoundError(`Submission not found for session ${sessionId} and user ${userId}`);
    const { mapping, exam } = res;
    const studentName = await this.studentRepository.getStudentDisplayName(mapping.organization_id || organizationId, mapping.user_id);
    const finalAnswers = Array.isArray(mapping.final_answers) ? mapping.final_answers : [];
    const submissionDetails = finalAnswers.map((answer: any) => ({
      question_id: answer?.question_id,
      question_text: answer?.question_text,
      question_type: answer?.question_type,
      question_marks: answer?.question_marks,
      options: answer?.options,
      is_mandatory: answer?.is_mandatory,
      user_answer: answer?.user_answer ?? null,
      is_correct: answer?.is_correct ?? null,
      marks_obtained: answer?.marks_obtained ?? null,
      correct_answer: answer?.correct_answer,
      reviewer_comment: answer?.reviewer_comment ?? null,
    }));
    const reviewerId = mapping?.reviewed_by;
    const reviewerObj = mapping?.reviewers?.find((r: any) => r.id === reviewerId);
    return {
      submission_id: mapping.id,
      exam_id: mapping.exam_id,
      user_id: mapping.user_id,
      studentName: studentName,
      reviewed_by: reviewerObj?.name || null,
      test_name: (exam as any)?.title || '',
      total_marks: mapping.total_possible_marks || (exam as any)?.total_marks || 0,
      submission_details: submissionDetails,
    };
  }

  async getStudentExamReview(organizationId: string, userId: string, examId: string) {
    const res = await this.repository.getExamUserMappingByExamId(examId, userId, organizationId);
    if (!res) throw new NotFoundError(`Exam submission not found for exam ${examId} and user ${userId}`);
    const { mapping, exam } = res;
    if (mapping.review_status !== 'completed') throw new Error(`Exam review not yet available. Current status: ${mapping.review_status}`);
    const studentName = await this.studentRepository.getStudentDisplayName(mapping.organization_id || organizationId, mapping.user_id);
    const finalAnswers = Array.isArray(mapping.final_answers) ? mapping.final_answers : [];
    const reviewDetails = finalAnswers.map((answer: any) => ({
      question_id: answer?.question_id,
      question_text: answer?.question_text,
      question_type: answer?.question_type,
      question_marks: answer?.question_marks,
      options: answer?.options,
      is_mandatory: answer?.is_mandatory,
      user_answer: answer?.user_answer ?? null,
      is_correct: answer?.is_correct ?? false,
      marks_obtained: answer?.marks_obtained ?? 0,
      correct_answer: answer?.correct_answer,
      reviewer_comment: answer?.reviewer_comment ?? null,
    }));
    const totalQuestions = reviewDetails?.length;
    const correctAnswers = reviewDetails?.filter((q: any) => q?.is_correct).length;
    const totalMarksObtained = reviewDetails?.reduce((sum: number, q: any) => sum + (q?.marks_obtained || 0), 0) || 0;
    const totalPossibleMarks = reviewDetails?.reduce((sum: number, q: any) => sum + (q?.question_marks || 0), 0) || 0;
    const percentage = totalPossibleMarks > 0 ? (totalMarksObtained / totalPossibleMarks) * 100 : 0;
    const snapshotPassingMarks = Number((finalAnswers[0] as any)?.snapshot_passing_marks) || Number((exam as any)?.passing_marks) || 0;
    const passed = totalMarksObtained >= snapshotPassingMarks;
    
    const reviewRecord = await this.repository.getExamReviewRecord(mapping.id);
    let reviewerName = 'System';
    let reviewerComments = null;
    if (reviewRecord) {
      reviewerComments = (reviewRecord as any).reviewer_comment;
      const reviewerId = mapping?.reviewed_by;
      if (reviewerId) {
        const reviewerObj = mapping?.reviewers?.find((r: any) => r.id === reviewerId);
        if (reviewerObj && reviewerObj.name) {
          reviewerName = reviewerObj.name;
        } else {
          try { reviewerName = await this.studentRepository.getStudentDisplayName(organizationId, reviewerId); } catch (e) {}
        }
      }
    }
    
    return {
      submission_id: mapping?.id,
      exam_id: mapping?.exam_id,
      user_id: mapping?.user_id,
      student_name: studentName,
      reviewer_name: reviewerName,
      test_name: (exam as any)?.title || '',
      total_marks: mapping.total_possible_marks || (exam as any)?.total_marks,
      passing_marks: snapshotPassingMarks,
      duration_minutes: (exam as any)?.duration_minutes,
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
        grade: passed ? 'Pass' : 'Fail',
      },
      review_details: reviewDetails,
    };
  }
}
