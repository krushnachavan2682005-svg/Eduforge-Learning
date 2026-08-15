export const getDashboardSchema = {
  params: {
    type: "object",
    properties: {
      user_id: { type: "string" },
    },
    required: ["user_id"],
  },
};

export const getTutorDashboardSchema = {
  params: {
    type: "object",
    properties: {
      user_id: { type: "string" },
    },
    required: [],
  },
};
