export const createFullExamSchema = {
  body: {
    type: "object",
    required: [
      "title",
      "subject",
      "total_marks",
      "passing_marks",
      "duration_minutes",
      "exam_start_time",
      "created_by",
      // "updated_by",
      "questions",
    ],
    properties: {
      reviewers: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", maxLength: 255 },
          },
        },
      },
      title: { type: "string", maxLength: 255 },
      subject: { type: "string", maxLength: 100 },
      total_marks: { type: "integer", minimum: 1 },
      passing_marks: { type: "integer", minimum: 0 },
      duration_minutes: { type: "integer", minimum: 1 },
      exam_date: { type: "string", format: "date-time" },
      exam_start_time: { type: "string", format: "date-time" },
      created_by: { type: "string", format: "uuid" },
      updated_by: { type: "string", format: "uuid" },
      questions: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["type", "text", "marks", "is_mandatory"],
          properties: {
            type: {
              type: "string",
              enum: ["mcq", "short", "long", "practical"],
            },
            text: { type: "string", minLength: 1 },
            marks: { type: "integer", minimum: 1 },
            is_mandatory: { type: "boolean" },
            options: {
              type: "array",
              minItems: 2,
              maxItems: 10,
              items: {
                type: "object",
                required: ["option_text"],
                properties: {
                  option_text: { type: "string", maxLength: 255 },
                },
              },
            },
            correct_answer: { type: "string" },
          },
        },
      },
    },
  },
};

export const updateFullExamSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string", format: "uuid" },
    },
  },
  body: {
    type: "object",
    required: ["updated_by"],
    properties: {
      reviewers: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
          },
        },
      },
      title: { type: "string", maxLength: 255 },
      subject: { type: "string", maxLength: 100 },
      total_marks: { type: "integer", minimum: 1 },
      passing_marks: { type: "integer", minimum: 0 },
      duration_minutes: { type: "integer", minimum: 1 },
      exam_date: { type: "string", format: "date-time" },
      exam_start_time: { type: "string", format: "date-time" },
      updated_by: { type: "string", format: "uuid" },
      questions: {
        type: "array",
        items: {
          type: "object",
          // When adding a new question during an update, these fields are essential.
          // The logic for existing questions is handled by their ID.
          if: { not: { required: ["id"] } },
          then: { required: ["type", "text", "marks", "is_mandatory"] },

          properties: {
            id: { type: "string", format: "uuid" },
            type: {
              type: "string",
              enum: ["mcq", "short", "long", "practical"],
            },
            text: { type: "string" },
            marks: { type: "integer" },
            is_mandatory: { type: "boolean" },
            options: {
              type: "array",
              minItems: 2,
              maxItems: 10,
              items: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  option_text: { type: "string", maxLength: 255 },
                },
              },
            },
            correct_answer: { type: "string" },
          },
        },
      },
    },
  },
};

export const assignExamSchema = {
  body: {
    type: "object",
    required: ["exam_id"],
    properties: {
      exam_id: {
        type: "array",
        items: { type: "string", format: "uuid" },
        minItems: 1,
      },
      user_id: {
        type: "array",
        items: { type: "string", format: "uuid" },
        minItems: 1,
      },
      class_id: { type: "string", format: "uuid" },
    },
    anyOf: [{ required: ["user_id"] }, { required: ["class_id"] }],
    additionalProperties: false,
  },
};

export const publishAssignedExamSchema = {
  body: {
    type: "object",
    required: ["assigned_id", "assignment_id", "user_id", "publish"],
    properties: {
      assigned_id: { type: "string", format: "uuid" },
      assignment_id: { type: "string", format: "uuid" },
      user_id: { type: "string", format: "uuid" },
      publish: { type: "boolean" },
    },
    additionalProperties: false,
  },
};

export const getAssignedExamTimelineSchema = {
  params: {
    type: "object",
    properties: {
      user_id: { type: "string", format: "uuid" },
    },
  },
};

export const saveAnswerSchema = {
  body: {
    type: "object",
    required: [
      "session_id",
      "question_id",
      "user_answer",
      "current_question_index",
    ],
    properties: {
      session_id: { type: "string", format: "uuid" },
      question_id: { type: "string", format: "uuid" },
      user_answer: { type: "string", maxLength: 1000 },
      current_question_index: { type: "integer", minimum: 0 },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: {
            next_question_index: { type: "integer" },
            next_question: { type: ["object", "null"] },
            is_exam_complete: { type: "boolean" },
            total_questions: { type: "integer" },
            session_id: { type: "string", format: "uuid" },
          },
        },
        message: { type: "string" },
      },
    },
  },
};

export const submitExamSchema = {
  body: {
    type: "object",
    required: ["session_id"],
    properties: {
      session_id: { type: "string", format: "uuid" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: {
            test_name: { type: "string" },
            total_marks: { type: "number" },
            results: { type: "object" },
            summary: { type: "object" },
          },
        },
        message: { type: "string" },
      },
    },
  },
};

export const reviewExamSchema = {
  params: {
    type: "object",
    required: ["session_id"],
    properties: {
      session_id: { type: "string", format: "uuid" },
    },
  },
  body: {
    type: "object",
    required: ["reviewed_answers"],
    properties: {
      // controllers accept optional 'reviewers' in body to indicate who reviewed
      reviewers: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
          },
        },
      },
      reviewed_answers: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["question_id", "marks_obtained", "is_correct"],
          properties: {
            question_id: { type: "string", format: "uuid" },
            marks_obtained: { type: "number", minimum: 0 },
            is_correct: { type: "boolean" },
            reviewer_comment: { type: "string", maxLength: 1000 },
          },
        },
      },
    },
  },
};

export const getSubmissionForReviewSchema = {
  params: {
    type: "object",
    required: ["user_id", "session_id"],
    properties: {
      user_id: { type: "string", format: "uuid" },
      session_id: { type: "string", format: "uuid" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: {
            submission_id: { type: "string", format: "uuid" },
            exam_id: { type: "string", format: "uuid" },
            user_id: { type: "string", format: "uuid" },
            student_name: { type: "string" },
            reviewed_by: { type: ["string", "null"] },
            test_name: { type: "string" },
            total_marks: { type: "number" },
            submission_details: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question_id: { type: ["string", "null"], format: "uuid" },
                  question_text: { type: ["string", "null"] },
                  question_type: {
                    type: ["string", "null"],
                    enum: ["mcq", "short", "long", "practical", null],
                  },
                  question_marks: { type: ["number", "null"] },
                  options: {
                    type: ["array", "null"],
                    items: {
                      type: "object",
                      properties: {
                        option_text: { type: "string" },
                      },
                      additionalProperties: true, // Allow other properties if they exist
                    },
                  },
                  is_mandatory: { type: ["boolean", "null"] },
                  user_answer: { type: ["string", "null"] },
                  is_correct: { type: ["boolean", "null"] },
                  marks_obtained: { type: ["number", "null"] },
                  correct_answer: { type: ["string", "null"] },
                  reviewer_comment: { type: ["string", "null"] },
                },
                // Allow additional properties if needed, or set to false
                additionalProperties: true,
              },
            },
          },
        },
        message: { type: "string" },
      },
    },
  },
};

// ------------------------------------------------------------
// Public exam schemas (no user_id required)
// ------------------------------------------------------------
export const publicExamStartSchema = {
  params: {
    type: "object",
    required: ["exam_id"],
    properties: {
      exam_id: { type: "string", format: "uuid" },
    },
  },
};

// Schema used when a user starts an assigned exam
export const startExamSchema = {
  params: {
    type: "object",
    required: ["exam_id", "user_id"],
    properties: {
      exam_id: { type: "string", format: "uuid" },
      user_id: { type: "string", format: "uuid" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: {
            session_id: { type: "string", format: "uuid" },
            current_question_index: { type: "integer" },
            total_questions: { type: "integer" },
            current_question: { type: ["object", "null"] },
            exam_details: { type: "object" },
            exam: { type: "object", additionalProperties: true },
            questions: {
              type: "array",
              items: { type: "object", additionalProperties: true },
            },
            remaining_seconds: { type: "integer" },
            saved_answers: {
              type: "array",
              items: { type: "object", additionalProperties: true },
            },
          },
          required: [
            "session_id",
            "current_question_index",
            "total_questions",
            "current_question",
            "exam_details",
          ],
          additionalProperties: true,
        },
        message: { type: "string" },
      },
      additionalProperties: false,
    },
  },
};

export const publicExamSubmitSchema = {
  params: {
    type: "object",
    required: ["exam_id"],
    properties: {
      exam_id: { type: "string", format: "uuid" },
    },
  },
  body: {
    type: "object",
    required: ["answers"],
    properties: {
      answers: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["question_id", "user_answer"],
          properties: {
            question_id: { type: "string", format: "uuid" },
            user_answer: { type: ["string", "number", "boolean"],
              maxLength: 1000 },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: {
            total_questions: { type: "integer" },
            total_correct: { type: "integer" },
            percentage: { type: "number" },
            passed: { type: "boolean" },
            feedback: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question_id: { type: "string", format: "uuid" },
                  user_answer: { type: ["string", "null"] },
                  correct_answer: { type: ["string", "null"] },
                  is_correct: { type: "boolean" },
                  marks_obtained: { type: "number" },
                },
                additionalProperties: false,
              },
            },
          },
        },
        message: { type: "string" },
      },
    },
  },
};
