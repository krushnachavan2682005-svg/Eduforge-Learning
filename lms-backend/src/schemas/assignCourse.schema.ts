export const assignCourse = {
  body: {
    type: "object",
    required: ["course_id"],
    properties: {
      course_id: {
        type: "array",
        items: { type: "string", format: "uuid" },
        minItems: 1,
      },
      class_id: { type: "string", format: "uuid" },
      user_id: {
        type: "array",
        items: { type: "string", format: "uuid" },
        minItems: 1,
      },
    },
    additionalProperties: false,
  },
};
