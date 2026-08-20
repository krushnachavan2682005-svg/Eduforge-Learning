export const ReviewSchema = {
  schema: {
    body: {
      type: "object",
      properties: {
        id: { type: "string" },
        user_id: { type: "string" },
        course_id: { type: "string" },
        rating: { type: "integer", minimum: 1, maximum: 5 },
        comment: { type: "string" },
      },
      oneOf: [
        {
          required: ["user_id", "course_id", "rating"],
          not: { required: ["id"] },
        },
        {
          required: ["id"], 
        },
      ],
      additionalProperties: false,
    },
  },
};
