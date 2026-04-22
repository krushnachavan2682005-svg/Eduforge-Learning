export const enrollmentSchema = {
  body: {
    type: "object",
    required: ["user_id", "course_id"], 
    properties: {
      id: { type: "string" },
      user_id: { type: "string" },
      course_id: { type: "string" },
      enrolled_at: { type: "string" },
    },
  },
};

