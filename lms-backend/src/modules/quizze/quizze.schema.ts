export const quizSchema = {
  body: {
    type: "object",
    required: ["lesson_id", "question", "options"],
    properties: {
      id: { type: "string" },
      lesson_id: { type: "string" },
      question: { type: "string" },
      options: { 
        type: "array", 
        items: { type: "string" } 
      },
      correct_answer: { type: "string" },
    },
  },
};
