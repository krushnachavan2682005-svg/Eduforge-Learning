import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

// ==================== Types ====================
export type Reviewer = { id: string; name?: string };

// ==================== Attributes ====================
export interface ExamAttributes {
  id: string;
  reviewers?: Reviewer[] | null;
  title: string;
  subject: string;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number;
  exam_date: Date; // This seems to be a general date for the exam
  exam_start_time: Date; // Specific start time
  organization_id?: string;
  is_completed: boolean;
  created_on: Date;
  updated_on: Date;
  created_by: string;
  updated_by: string;
}

interface ExamCreationAttributes
  extends Optional<
  ExamAttributes,
  "id" | "created_on" | "updated_on" | "is_completed"
> {}

export interface QuestionAttributes {
  id: string;
  exam_id: string;
  type: "mcq" | "short" | "long" | "practical";
  text: string;
  marks: number;
  is_mandatory: boolean;
  correct_answer?: string;
  options?: any;
  organization_id?: string;
  created_on: Date;
  updated_on: Date;
}

export interface QuestionCreationAttributes
  extends Optional<QuestionAttributes, "id" | "created_on" | "updated_on"> {}

export interface ExamSessionAttributes {
  id: string;
  exam_id: string;
  user_id: string;
  current_question_index: number;
  started_at: Date;
  completed_at?: Date | null;
  is_completed: boolean;
  answers_data: any;
  organization_id?: string;
  reviewers?: Reviewer[] | null;
  created_on: Date;
  updated_on: Date;
  exam?: ExamAttributes;
}

export interface ExamUserMappingAttributes {
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
  organization_id?: string;
  reviewers?: Reviewer[] | null;
  created_on: Date;
}

export interface ExamUserMappingPublicAttributes {
  id: string;
  exam_id: string;
  session_id: string;
  started_at: Date;
  is_completed: boolean;
  
  name?:string|null;
  email?: string|null;
  total_marks_obtained?: number;
  total_possible_marks?: number;
  percentage?: number;
  passed?: boolean;

  submitted_at?: Date;
  time_taken_minutes?: number;
  final_answers?: any;

  organization_id?: string;
  created_on: Date;
}


export type ExamUserMappingPublicCreationAttributes = Optional<
  ExamUserMappingPublicAttributes,
  "id" | "created_on" | "name" | "email"  | "total_marks_obtained" |
  "total_possible_marks" | "percentage" | "passed" |
  "submitted_at" | "time_taken_minutes" | "final_answers" | "organization_id"
>;
export interface ExamReviewAttributes {
  id: string;
  exam_id: string;
  exam_user_mapping_id: string;
  reviewers?: Reviewer[] | null;
  reviewed_at: Date;
  reviewed_answers: any;
  total_marks_obtained: number;
  percentage: number;
  passed: boolean;
  organization_id?: string;
  created_on: Date;
  updated_on: Date;
}

// ==================== Models ====================
class Exam
  extends Model<ExamAttributes, ExamCreationAttributes>
  implements ExamAttributes
{
  public id!: string;
  public reviewers?: Reviewer[] | null;
  public title!: string;
  public subject!: string;
  public total_marks!: number;
  public passing_marks!: number;
  public duration_minutes!: number;
  public exam_date!: Date;
  public organization_id?: string;
  public exam_start_time!: Date;
  public created_by!: string;
  public updated_by!: string;
  public is_completed!: boolean;
  public created_on!: Date;
  public updated_on!: Date;
  public questions?: Question[];
}

Exam.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    reviewers: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    total_marks: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    passing_marks: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    exam_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    exam_start_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    created_on: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_on: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "exams",
    modelName: "Exam",
    timestamps: false,
    hooks: {
      beforeUpdate: (exam: Exam) => {
        exam.updated_on = new Date();
      },
    },
  }
);

// ---------------- Question model ----------------
class Question
  extends Model<QuestionAttributes, QuestionCreationAttributes>
  implements QuestionAttributes
{
  public id!: string;
  public exam_id!: string;
  public type!: "mcq" | "short" | "long" | "practical";
  public text!: string;
  public marks!: number;
  public is_mandatory!: boolean;
  public correct_answer?: string;
  public options?: any;
  public organization_id?: string;
  public created_on!: Date;
  public updated_on!: Date;
}

Question.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    exam_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "exams", key: "id" },
    },
    type: {
      type: DataTypes.ENUM("mcq", "short", "long", "practical"),
      allowNull: false,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    marks: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_mandatory: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    correct_answer: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    options: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    created_on: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_on: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "exam_questions",
    modelName: "Question",
    timestamps: false,
    hooks: {
      beforeUpdate: (question: Question) => {
        question.updated_on = new Date();
      },
    },
  }
);

// ---------------- ExamSession model ----------------
class ExamSession
  extends Model<ExamSessionAttributes>
  implements ExamSessionAttributes
{
  public id!: string;
  public exam_id!: string;
  public user_id!: string;
  public current_question_index!: number;
  public started_at!: Date;
  public completed_at?: Date | null;
  public is_completed!: boolean;
  public answers_data!: any;
  public organization_id?: string;
  public reviewers?: Reviewer[] | null;
  public created_on!: Date;
  public updated_on!: Date;
  public exam?: Exam;
}

ExamSession.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    exam_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "exams", key: "id" },
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    current_question_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    answers_data: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    reviewers: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    created_on: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_on: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "exam_sessions",
    modelName: "ExamSession",
    timestamps: false,
    hooks: {
      beforeUpdate: (session: ExamSession) => {
        session.updated_on = new Date();
      },
    },
  }
);

// ---------------- ExamUserMapping model ----------------
class ExamUserMapping
  extends Model<ExamUserMappingAttributes>
  implements ExamUserMappingAttributes
{
  public id!: string;
  public exam_id!: string;
  public user_id!: string;
  public session_id!: string;
  public total_marks_obtained!: number;
  public total_possible_marks!: number;
  public percentage!: number;
  public passed!: boolean;
  public started_at!: Date;
  public submitted_at!: Date;
  public time_taken_minutes!: number;
  public final_answers!: any;
  public is_completed!: boolean;
  public review_status!: "pending_review" | "completed";
  public reviewed_by?: string | null;
  public reviewed_at?: Date | null;
  public organization_id?: string;
  public reviewers?: Reviewer[] | null;
  public created_on!: Date;
}

ExamUserMapping.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    exam_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "exams", key: "id" },
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    session_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "exam_sessions", key: "id" },
    },
    total_marks_obtained: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    total_possible_marks: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    percentage: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    passed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    time_taken_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    final_answers: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    is_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    review_status: {
      type: DataTypes.ENUM("pending_review", "completed"),
      allowNull: false,
      defaultValue: "pending_review",
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    reviewers: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    created_on: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "exam_user_mappings",
    modelName: "ExamUserMapping",
    timestamps: false,
  }
);

//------------------Exam-User-Mapping for Public Users--------
class ExamUserMappingPublic
  extends Model<
    ExamUserMappingPublicAttributes,
    ExamUserMappingPublicCreationAttributes
  >
  implements ExamUserMappingPublicAttributes
{
  public id!: string;

 
  public exam_id!: string;
  public session_id!: string;
  public started_at!: Date;
  public is_completed!: boolean;
  public email?: string;
  public name?:string;

 


  public total_marks_obtained?: number;
  public total_possible_marks?: number;
  public percentage?: number;
  public passed?: boolean;

  public submitted_at?: Date;
  public time_taken_minutes?: number;

  public final_answers?: any;

  public organization_id?: string;
  public created_on!: Date;
}

ExamUserMappingPublic.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    exam_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "exams", key: "id" },
    },

    session_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    name:{
      type:DataTypes.STRING,
      allowNull:true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true, 
    },

  
    total_marks_obtained: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    total_possible_marks: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    percentage: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },

    passed: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },

    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true, 
    },

    time_taken_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    final_answers: {
      type: DataTypes.JSONB,
      allowNull: true, 
    },

    is_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false, 
    },

    organization_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    created_on: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "exam_user_mappings_public", 
    modelName: "ExamUserMappingPublic",
    timestamps: false,
  }
);
// ---------------- ExamReview model ----------------
class ExamReview
  extends Model<ExamReviewAttributes, Partial<ExamReviewAttributes>>
  implements ExamReviewAttributes
{
  public id!: string;
  public exam_id!: string;
  public exam_user_mapping_id!: string;
  public reviewers?: Reviewer[] | null;
  public reviewed_at!: Date;
  public reviewed_answers!: any;
  public total_marks_obtained!: number;
  public percentage!: number;
  public passed!: boolean;
  public organization_id?: string;
  public created_on!: Date;
  public updated_on!: Date;
}

ExamReview.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    exam_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "exams", key: "id" },
    },
    exam_user_mapping_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "exam_user_mappings", key: "id" },
    },
    reviewers: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    reviewed_answers: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    total_marks_obtained: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    percentage: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    passed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    created_on: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_on: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "exam_reviews",
    modelName: "ExamReview",
    timestamps: false,
  }
);

// ---------------- ExamAssignment model ----------------
class ExamAssignment extends Model {
  public id!: string;
  public exam_id!: string;
  public user_id!: string;
  public organization_id?: string;
  public class_info?: { id: string; name?: string } | null;
  public created_on!: Date;
  public updated_on?: Date;
}

ExamAssignment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    exam_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "exams", key: "id" },
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    class_info: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    created_on: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_on: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "exam_assignments",
    modelName: "ExamAssignment",
    timestamps: false,
    hooks: {
      beforeUpdate: (assignment: ExamAssignment) => {
        assignment.updated_on = new Date();
      },
    },
  }
);

// ==================== Associations ====================
export const setupExamAssociations = () => {
  try {
    const User = sequelize.models.User;

    Exam.hasMany(Question, {
      foreignKey: "exam_id",
      as: "questions",
      onDelete: "CASCADE",
    });
    Exam.hasMany(ExamSession, { foreignKey: "exam_id", as: "sessions" });
    Exam.hasMany(ExamUserMapping, {
      foreignKey: "exam_id",
      as: "user_mappings",
    });

    if (User) {
      Exam.belongsToMany(User, {
        through: ExamAssignment,
        foreignKey: "exam_id",
        otherKey: "user_id",
        as: "assignedUsers",
      });

      User.belongsToMany(Exam, {
        through: ExamAssignment,
        foreignKey: "user_id",
        otherKey: "exam_id",
        as: "assignedExams",
      });
    }

    Question.belongsTo(Exam, { foreignKey: "exam_id", as: "exam" });
    ExamSession.belongsTo(Exam, { foreignKey: "exam_id", as: "exam" });
    ExamSession.hasOne(ExamUserMapping, {
      foreignKey: "session_id",
      as: "final_mapping",
    });

    ExamUserMapping.belongsTo(Exam, { foreignKey: "exam_id", as: "exam" });
    ExamUserMapping.belongsTo(ExamSession, {
      foreignKey: "session_id",
      as: "session",
    });
    ExamUserMapping.hasMany(ExamReview, {
      foreignKey: "exam_user_mapping_id",
      as: "reviews",
    });

    ExamReview.belongsTo(ExamUserMapping, {
      foreignKey: "exam_user_mapping_id",
      as: "user_mapping",
    });
    ExamReview.belongsTo(Exam, { foreignKey: "exam_id", as: "exam" });

    console.log("✅ Exam associations setup successfully");
  } catch (error) {
    console.error("❌ Error setting up exam associations:", error);
  }
};

setupExamAssociations();

export {
  Exam,
  Question,
  ExamSession,
  ExamUserMapping,
  ExamUserMappingPublic,
  ExamAssignment,
  ExamReview,
};
