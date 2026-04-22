export const levelSchema = {
  body: {
    type: "object",
    properties: {
      level_name: { type: "string" },
      start_date: { type: "string" },
      end_date: { type: "string" },
    },
    required: ["level_name"],
  },
};
