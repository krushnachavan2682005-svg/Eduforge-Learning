export const lessonSchema = {
  body: {
    type: "object",
    required: ["course_id", "title"],
    properties: {
      title: { type: "string" },
      course_id: { type: "string" },
    },
  },
};
