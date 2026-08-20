export const assignActionItems = {
  body: {
    type: "object",
    required: ["action_item_id"],
    properties: {
      action_item_id: {
        type: "array",
        minItems: 1,
        items: { type: "string", format: "uuid" },
      },
      user_id: {
        type: "array",
        minItems: 1,
        items: { type: "string", format: "uuid" },
      },
      class_id: {
        anyOf: [
          {
            type: "array",
            minItems: 1,
            items: { type: "string", format: "uuid" },
          },
          { type: "string", format: "uuid" },
        ],
      },
    },
    anyOf: [
      { required: ["user_id"] },
      { required: ["class_id"] },
      { required: ["user_id", "class_id"] },
    ],
    additionalProperties: false,
  },
};

export const updateAssignedActionStatus = {
  params: {
    type: "object",
    required: ["user_id"],
    properties: {
      user_id: { type: "string", format: "uuid" },
    },
    additionalProperties: false,
  },
  body: {
    type: "object",
    required: ["assigned_action_item_id", "status"],
    properties: {
      assigned_action_item_id: {
        type: "string",
        format: "uuid",
      },
      status: {
        type: "string",
        enum: ["ASSIGNED", "SUBMITTED", "APPROVED", "REJECTED"],
      },
      score: {
        type: "integer",
        minimum: 0,
        nullable: true,
      },
      notes: {
        type: "string",
        nullable: true,
      },
      comment: {
        type: "string",
        nullable: true,
      },
      attachment: {
        type: "array",
        items: { type: "string" },
        nullable: true,
      },
    },
    additionalProperties: false,
  },
};

export const getAttachmentsSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string", format: "uuid" },
    },
    additionalProperties: false,
  },
};

export const updateAttachmentsSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string", format: "uuid" },
    },
    additionalProperties: false,
  },
  body: {
    type: "object",
    required: ["attachment"],
    properties: {
      attachment: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
      },
      action: {
        type: "string",
        enum: ["add", "replace"],
        default: "add",
        description:
          "Action to perform: 'add' to add files to existing array, 'replace' to replace entire array",
      },
    },
    additionalProperties: false,
  },
};

export const deleteAttachmentsSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string", format: "uuid" },
    },
    additionalProperties: false,
  },
  body: {
    type: "object",
    required: ["delete_keys"],
    properties: {
      delete_keys: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
        description: "Array of attachment to delete",
      },
    },
    additionalProperties: false,
  },
};

export const publishAssignedItemSchema = {
  body: {
    type: "object",
    required: ["assigned_id", "assignment_id", "publish", "user_id"],
    properties: {
      assigned_id: { type: "string", format: "uuid" },
      assignment_id: { type: "string", format: "uuid" },
      user_id: { type: "string", format: "uuid" },
      publish: { type: "boolean" },
    },
    additionalProperties: false,
  },
};

export const getAssignedTimelineSchema = {
  params: {
    type: "object",
    properties: {
      user_id: { type: "string", format: "uuid" },
    },
    additionalProperties: false,
  },
};
