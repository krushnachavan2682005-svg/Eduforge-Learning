export interface Reviewer {
  id: string; // Reviewer UUID
  name?: string; // Reviewer Name (optional)
}

// ===========================================================
// EXAM & QUESTION INTERFACES
// ===========================================================
export interface IExam {
  id?: string;
  test_id?: string | null;
  reviewers?: Reviewer[] | null; // NEW JSON ARRAY
  title: string;
  subject: string;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number;
  exam_date?: string | Date; // General date
  exam_start_time: string | Date; // Specific start time
  client_id?: string;
  is_completed?: boolean;
  is_published?: boolean;
  created_on?: Date;
  updated_on?: Date;
  created_by: string;
  updated_by: string;
  questions?: IQuestion[];
}

export interface IQuestion {
  id?: string;
  exam_id?: string;
  type: "mcq" | "short" | "long" | "practical";
  text: string;
  marks: number;
  is_mandatory: boolean;
  correct_answer?: string;
  options?: any;
  client_id?: string;
  created_on?: Date;
  updated_on?: Date;
}

export interface IOption {
  id?: string;
  option_text: string;
}

export interface IExamUpdate {
  reviewers?: Reviewer[] | null; // reviewer structure in update flow
  title?: string;
  subject?: string;
  total_marks?: number;
  passing_marks?: number;
  duration_minutes?: number;
  exam_date?: string | Date; // General date
  exam_start_time?: string | Date;
  client_id?: string;
  is_completed?: boolean;
  updated_by: string; // Always require who updated it
  updated_on?: Date;
  questions?: IQuestionUpdate[];
}

export interface IQuestionUpdate {
  id?: string;
  exam_id?: string;
  type?: "mcq" | "short" | "long" | "practical";
  text?: string;
  marks?: number;
  is_mandatory?: boolean;
  correct_answer?: string;
  options?: any;
  client_id?: string;
}

export interface IExamWithQuestions extends IExam {
  questions: IQuestion[];
}

// ===========================================================
// CREATE EXAM
// ===========================================================
export interface IExamCreateRequest {
  reviewers?: Reviewer[] | null; // NEW (optional)
  title: string;
  subject: string;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number;
  exam_date?: string | Date; // General date
  exam_start_time: string | Date; // Specific start time
  client_id?: string;
  created_by: string;
  updated_by: string;
  questions: Omit<IQuestion, "id" | "exam_id" | "created_on">[];
  is_completed?: boolean;
}

// ===========================================================
// EXAM SESSION INTERFACES
// ===========================================================
export interface IExamSession {
  id?: string;
  exam_id: string;
  user_id: string;
  current_question_index: number;
  started_at: Date;
  completed_at?: Date | null;
  is_completed: boolean;
  answers_data: any;
  client_id?: string;
  reviewers?: Reviewer[] | null; // NEW (copied from exam)
  created_on?: Date;
  updated_on?: Date;
  exam?: IExam;
}

// Interface used when creating a session (repository)
export interface IExamSessionCreate {
  exam_id: string;
  user_id: string;
  current_question_index?: number;
  client_id?: string;
  answers_data?: IAnswerData[];
  reviewers?: Reviewer[] | null;
}

export interface IAnswerData {
  question_id: string;
  user_answer: string;
  answered_at: Date;
  question_index: number;
}

// Interface used by repository saveAnswer
export interface IAnswerSaveData {
  session_id: string;
  question_id: string;
  user_answer: string;
  question_index: number;
}

// ===========================================================
// EXAM USER MAPPING
// ===========================================================
export interface IExamUserMapping {
  id?: string;
  exam_id: string;
  user_id: string;
  session_id: string;
  total_marks_obtained: number;
  total_possible_marks: number;
  percentage: number;
  passed: boolean;
  started_at: Date;
  submitted_at: Date;
  time_taken_minutes: number;
  final_answers: any;
  is_completed: boolean;
  review_status: "pending_review" | "completed";
  reviewed_by?: string | null;
  reviewed_at?: Date | null;
  client_id?: string;
  created_on?: Date;
  reviewers?: Reviewer[] | null; // NEW
}

export interface IFinalAnswer {
  question_id: string;
  question_type: "mcq" | "short" | "long" | "practical";
  question_text?: string;
  options?: any;
  is_mandatory?: boolean;
  user_answer: string;
  is_correct: boolean;
  marks_obtained: number;
  correct_answer?: string;
  question_marks: number;
  reviewer_comment?: string;
  snapshot_passing_marks?: number;
}

// ===========================================================
// REQUEST/RESPONSE INTERFACES
// ===========================================================
export interface IStartExamRequest {
  exam_id: string;
}

export interface IStartExamResponse {
  session_id: string;
  current_question_index: number;
  current_question: IQuestion;
  total_questions: number;
  exam_details: IExam;
}

// -----------------------------------------------------------
// PUBLIC EXAM ROUTES (no user_id required)
// -----------------------------------------------------------
export interface IPublicExamStartResponse {
  exam_details: IExam;
  questions: IQuestion[];
}

export interface IPublicExamSubmitRequest {
  answers: Array<{ question_id: string; user_answer: string }>;
}

export interface IPublicExamSubmitResponse {
  total_questions: number;
  total_correct: number;
  percentage: number;
  passed: boolean;
  feedback?: Array<{
    question_id: string;
    user_answer: string | null;
    correct_answer: string | null;
    is_correct: boolean;
    marks_obtained: number;
  }>;
}

export interface ISaveAnswerRequest {
  session_id: string;
  question_id: string;
  user_answer: string;
  current_question_index: number;
}

interface ISaveAnswerResponse {
  success: boolean;
  current_question_index: number;
  is_exam_complete: boolean;
  session_id: string;
}

export interface ISubmitExamRequest {
  session_id: string;
}

export interface ISubmitExamResponse {
  success: boolean;
  data: {
    review_status?: "pending_review" | "completed";
    summary?: {
      totalMarksObtained: number;
      totalPossibleMarks: number;
      percentage: number;
      passed: boolean;
      timeTakenMinutes: number;
    };
  };
  message: string;
}

// ===========================================================
// REVIEW INTERFACES
// ===========================================================
export interface IReviewerAnswer {
  question_id: string;
  marks_obtained: number;
  is_correct: boolean;
  reviewer_comment?: string;
}

export interface IReviewExamRequest {
  session_id: string;
  reviewers?: Reviewer[] | null; // optional info about who reviewed
  reviewed_answers: IReviewerAnswer[];
}

export interface IReviewExamResponse {
  mapping: IExamUserMapping;
  review: any;
  test_name: string;
  total_marks: number;
}

export interface ISubmissionDetail {
  question_id: string;
  question_text: string;
  question_type: "mcq" | "short" | "long" | "practical";
  question_marks: number;
  options: any;
  is_mandatory: boolean;
  user_answer: string | null;
  is_correct: boolean | null;
  marks_obtained: number | null;
  correct_answer?: string | null;
  reviewer_comment?: string | null;
}

export interface IGetSubmissionForReviewResponse {
  student_name: string;
  test_name: string;
  total_marks: number;
  submission_details: ISubmissionDetail[];
}
// ===========================================================
// ASSIGNMENT
// ===========================================================
export interface IExamAssignment {
  id?: string;
  exam_id: string;
  user_id: string;
  client_id?: string;
}

// ===========================================================
// MODEL COMPATIBILITY (Used in Repository)
// ===========================================================
export interface ExamModelAttributes {
  id: string;
  reviewers?: Reviewer[] | null;
  title: string;
  subject: string;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number;
  exam_date: Date; // General date
  exam_start_time: Date; // Specific start time
  client_id?: string;
  is_completed: boolean;
  created_on: Date;
  updated_on: Date;
  created_by: string;
  updated_by: string;
}

export interface QuestionModelAttributes {
  id: string;
  exam_id: string;
  type: "mcq" | "short" | "long" | "practical";
  text: string;
  marks: number;
  is_mandatory: boolean;
  correct_answer?: string;
  options?: any;
  client_id?: string;
  created_on: Date;
  updated_on: Date;
}

export interface ExamSessionModelAttributes {
  id: string;
  exam_id: string;
  user_id: string;
  current_question_index: number;
  started_at: Date;
  completed_at?: Date | null;
  is_completed: boolean;
  answers_data: any;
  reviewers?: Reviewer[] | null;
  client_id?: string;
  created_on: Date;
  updated_on: Date;
  exam?: ExamModelAttributes;
}

export interface ExamUserMappingModelAttributes {
  id: string;
  exam_id: string;
  user_id: string;
  session_id: string;
  total_marks_obtained: number;
  total_possible_marks: number;
  percentage: number;
  passed: boolean;
  started_at: Date;
  submitted_at: Date;
  time_taken_minutes: number;
  final_answers: any;
  is_completed: boolean;
  review_status: "pending_review" | "completed";
  reviewed_by?: string | null;
  reviewed_at?: Date | null;
  client_id?: string;
  reviewers?: Reviewer[] | null;
  created_on: Date;
}
