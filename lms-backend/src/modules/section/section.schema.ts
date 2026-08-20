export const sectionSchema = {
  body: {
    type: "object",
    required: ["title", "course_id", "lesson_id", "duration"],
    properties: {
      title: { type: "string" },
      course_id: { type: "string" },
      content_type: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "value"],
          properties: {
            type: {
              type: "string",
              enum: ["VIDEO", "PDF", "TEXT", "QUIZ", "IMAGE", "PPT"],
            },
            value: {
              type: ["string", "null"],
            },
            position: {
              type: "string",
            },
          },
        },
      },
      lesson_id: { type: "string" },
      duration: { type: "string" },
      quizzes: {
        type: "array",
        items: {
          type: "object",
          required: ["question", "options", "correct_answer"],
          properties: {
            question: { type: "string" },
            options: {
              type: "array",
              items: { type: "string" },
            },
            correct_answer: { type: "string" },
          },
        },
      },
    },
  },
};
