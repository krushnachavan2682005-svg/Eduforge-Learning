export const completedAssignCourseSchema = {
  body: {
    type: "object",
    required: ["course_id", "section_id", "lesson_id", "user_id"],
    properties: {
      course_id: { type: "string", format: "uuid" },
      section_id: { type: "string", format: "uuid" },
      lesson_id: { type: "string", format: "uuid" },
      user_id: { type: "string", format: "uuid" },
      is_completed: { type: "boolean" },
    },
  },
  params: {
    type: "object",
    required: ["client_id"],
    properties: {
      client_id: { type: "string", format: "uuid" },
    },
  },
};
