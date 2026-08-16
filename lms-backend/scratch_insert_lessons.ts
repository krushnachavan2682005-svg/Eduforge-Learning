import { sequelize } from "./src/config/database";
import { Course } from "./src/models/course.model";
import { lesson } from "./src/models/lesson.model";
import { v4 as uuidv4 } from 'uuid';

async function main() {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");
    
    const courses = await Course.findAll();
    console.log(`Found ${courses.length} courses.`);

    for (const course of courses) {
      console.log(`Processing course: ${course.title} (${course.id})`);
      
      // Check existing lessons
      const existingLessons = await lesson.findAll({
        where: { course_id: course.id }
      });

      console.log(`Found ${existingLessons.length} existing lessons for this course.`);

      const numLessonsToCreate = Math.max(0, 5 - existingLessons.length);

      for (let i = 0; i < numLessonsToCreate; i++) {
        const lessonTitle = `Lesson ${existingLessons.length + i + 1} - ${course.title.substring(0, 50)} Part ${i + 1}`;
        await lesson.create({
          title: lessonTitle,
          course_id: course.id,
          organization_id: course.organization_id,
        });
      }
      if (numLessonsToCreate > 0) {
        console.log(`Created ${numLessonsToCreate} lessons for course: ${course.title}`);
      }
    }

    console.log("Finished creating lessons.");
    process.exit(0);
  } catch (error) {
    console.error("Error creating lessons:", error);
    process.exit(1);
  }
}

main();
