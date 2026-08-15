// models/index.ts
import { Course } from "./course.model";
import { lesson } from "./lesson.model";

Course.hasMany(lesson, { foreignKey: "course_id" });
lesson.belongsTo(Course, { foreignKey: "course_id" });

export { Course, lesson };