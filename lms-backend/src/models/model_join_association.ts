// models/index.ts
import { Course } from "../modules/course/course.model";
import { lesson } from "../modules/lesson/lesson.model";

Course.hasMany(lesson, { foreignKey: "course_id", as: "lessons" });
lesson.belongsTo(Course, { foreignKey: "course_id", as: "course" });

export { Course, lesson };