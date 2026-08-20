export const actionItemSchema = {
  body: {
    type: "object",
    properties: {
      task_name: { type: "string" },
      total_score: { type: "string" },
      description: { type: "string" },
      pdf_attachment:{ type: "string" },
      level: { type: "string" },
      reviewer: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
        },
      },
    },
    required: ["task_name"],
  },
};
