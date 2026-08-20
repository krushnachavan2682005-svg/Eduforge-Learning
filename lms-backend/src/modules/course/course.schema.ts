export const createCourseSchema = {
  body: {
    type: "object",
    required: [
      "title",
      "level"
    ],
    properties: {
      subcategory_id: { type: "string" },
      title: { type: "string", minLength: 3 },
      description: { type: "string" },
      language: { type: "string", maxLength: 50 },
      price: { type: "number" },
      level: { type: "string", enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"] },
      thumbnail_url: { type: "string" },
      is_published: { type: "boolean" },
      tags: {
        type: "array",
        items: { type: "string" }
      }
    }
  }
};

export const updateCourseSchema = {
  body: {
    type: "object",
    properties: {
      instructor_id: { type: "string" },
      subcategory_id: { type: "string" },
      title: { type: "string", minLength: 3 },
      description: { type: "string" },
      language: { type: "string", maxLength: 50 },
      price: { type: "number" },
      level: { type: "string", enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"] },
      thumbnail_url: { type: "string" },
      is_published: { type: "boolean" },
      tags: {
        type: "array",
        items: { type: "string" }
      }
    }
  }
};
