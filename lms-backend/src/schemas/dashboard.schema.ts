export const getDashboardSchema = {
  params: {
    type: "object",
    properties: {
      client_id: { type: "string" },
      user_id: { type: "string" },
    },
    required: ["client_id", "user_id"],
  },
};

export const getTutorDashboardSchema = {
  params: {
    type: "object",
    properties: {
      client_id: { type: "string" },
      user_id: { type: "string" },
    },
    required: ["client_id"],
  },
};
