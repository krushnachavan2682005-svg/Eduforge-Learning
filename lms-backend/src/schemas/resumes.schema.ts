// schemas/resume.schema.ts
export const resumeSchema = {
  body: {
    type: "object",
    required: ["user_id", "name", "email"],
    properties: {
      user_id: { type: "string", format: "uuid" },
      name: { type: "string" },
      label: { type: "string" },
      email: { type: "string", format: "email" },
      phone: { type: "string" },
      url: { type: "string" },
      summary: { type: "string" },

      location: {
        type: "object",
        properties: {
          address: { type: "string" },
          city: { type: "string" },
          region: { type: "string" },
          country: { type: "string" },
        },
        additionalProperties: false,
      },

      education: {
        type: "array",
        items: {
          type: "object",
          required: ["institution", "area", "study_type"],
          properties: {
            institution: { type: "string" },
            area: { type: "string" },
            study_type: { type: "string" },
            start_date: { type: "string" },
            end_date: { type: "string" },
            score: { type: "string" },
          },
          additionalProperties: false,
        },
      },

      skills: {
        type: "array",
        items: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            level: { type: "string" },
          },
          additionalProperties: false,
        },
      },

      work: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "position", "start_date"],
          properties: {
            name: { type: "string" },
            position: { type: "string" },
            location: { type: "string" },
            start_date: { type: "string" },
            end_date: { type: "string" },
            summary: { type: "string" },
            highlights: { type: "array", items: { type: "string" } },
          },
          additionalProperties: false,
        },
      },

      projects: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "entity", "start_date"],
          properties: {
            name: { type: "string" },
            entity: { type: "string" },
            location: { type: "string" },
            start_date: { type: "string" },
            end_date: { type: "string" },
            summary: { type: "string" },
            highlights: { type: "array", items: { type: "string" } },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
};
