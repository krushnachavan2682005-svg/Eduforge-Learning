export const createMemberSchema = {
  body: {
    type: "object",
    required: ["first_name", "last_name", "email", "role", "password"],
    properties: {
      first_name: { type: "string", minLength: 1, maxLength: 100 },
      last_name: { type: "string", minLength: 1, maxLength: 100 },
      email: { type: "string", format: "email", maxLength: 255 },
      phone: { type: "string", maxLength: 32 },
      role: { type: "string", enum: ["teacher", "student"] },
      password: { type: "string", minLength: 8, maxLength: 128 },
      confirm_password: { type: "string", minLength: 8, maxLength: 128 },
    },
    additionalProperties: false,
  },
};

export const resetMemberPasswordSchema = {
  body: {
    type: "object",
    required: ["password"],
    properties: {
      password: { type: "string", minLength: 8, maxLength: 128 },
      confirm_password: { type: "string", minLength: 8, maxLength: 128 },
    },
    additionalProperties: false,
  },
};

export const updateMemberSchema = {
  body: {
    type: "object",
    properties: {
      first_name: { type: "string", minLength: 1, maxLength: 100 },
      last_name: { type: "string", minLength: 1, maxLength: 100 },
      email: { type: "string", format: "email", maxLength: 255 },
      phone: { type: "string", maxLength: 32 },
      is_active: { type: "boolean" },
    },
    additionalProperties: false,
  },
};

export const assignRoleSchema = {
  body: {
    type: "object",
    required: ["role_code"],
    properties: {
      role_code: {
        type: "string",
        enum: ["organization_admin", "teacher", "student", "reviewer"],
      },
    },
    additionalProperties: false,
  },
};
