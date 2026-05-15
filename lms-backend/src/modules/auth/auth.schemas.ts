export const registerSchema = {
  body: {
    type: "object",
    required: ["first_name", "last_name", "email", "password"],
    properties: {
      first_name: { type: "string", minLength: 1, maxLength: 100 },
      last_name: { type: "string", minLength: 1, maxLength: 100 },
      email: { type: "string", format: "email", maxLength: 255 },
      password: { type: "string", minLength: 8, maxLength: 128 },
      organization_name: { type: "string", minLength: 1, maxLength: 150 },
    },
    additionalProperties: false,
  },
};

export const loginSchema = {
  body: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email", maxLength: 255 },
      password: { type: "string", minLength: 1, maxLength: 128 },
    },
    additionalProperties: false,
  },
};
