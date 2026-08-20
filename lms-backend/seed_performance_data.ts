import { sequelize } from "./src/config/database";
import { Course } from "./src/models/course.model";
import { lesson } from "./src/models/lesson.model";
import { v4 as uuidv4 } from "uuid";
import { Op } from "sequelize";

const ORG_ID = "94cdb668-b694-40cd-86af-323a8a16ce84";
const TARGET_COURSES = 2000;
const LESSONS_PER_COURSE = 10;
const BATCH_SIZE = 5000;

async function runSeed() {
  try {
    await sequelize.authenticate();
    console.log("Connected to the database. Starting performance data seeding...");

    // 1. Idempotency check: Count existing performance test courses
    const existingCoursesCount = await Course.count({
      where: {
        organization_id: ORG_ID,
        title: {
          [Op.like]: "PerfTest-Course-%",
        },
      },
    });

    console.log(`Found ${existingCoursesCount} existing performance courses.`);

    if (existingCoursesCount >= TARGET_COURSES) {
      console.log(`Idempotency check passed. The database already contains at least ${TARGET_COURSES} performance courses.`);
    } else {
      const coursesToCreate = TARGET_COURSES - existingCoursesCount;
      console.log(`Need to create ${coursesToCreate} courses and ${coursesToCreate * LESSONS_PER_COURSE} lessons.`);

      const coursesData = [];
      const lessonsData = [];

      // Start numbering after the existing ones to avoid unique constraint violations
      const startIndex = existingCoursesCount + 1;

      for (let i = 0; i < coursesToCreate; i++) {
        const courseIndex = startIndex + i;
        const courseId = uuidv4();

        // Prepare Course
        coursesData.push({
          id: courseId,
          title: `PerfTest-Course-${courseIndex}`,
          description: `This is an auto-generated course for performance testing. Course index: ${courseIndex}`,
          level: "BEGINNER",
          organization_id: ORG_ID,
          is_published: true,
          created_at: new Date(),
          updated_at: new Date(),
        });

        // Prepare Lessons for this Course
        for (let j = 1; j <= LESSONS_PER_COURSE; j++) {
          lessonsData.push({
            id: uuidv4(),
            title: `PerfTest-Lesson-${courseIndex}-${j}`,
            course_id: courseId,
            seq_no: j,
            organization_id: ORG_ID,
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      }

      console.log("Inserting courses...");
      // Chunk courses insertion
      for (let i = 0; i < coursesData.length; i += BATCH_SIZE) {
        const batch = coursesData.slice(i, i + BATCH_SIZE);
        await Course.bulkCreate(batch, { hooks: false });
        console.log(`  Inserted courses ${i + 1} to ${i + batch.length}`);
      }

      console.log("Inserting lessons...");
      // Chunk lessons insertion
      for (let i = 0; i < lessonsData.length; i += BATCH_SIZE) {
        const batch = lessonsData.slice(i, i + BATCH_SIZE);
        await lesson.bulkCreate(batch, { hooks: false });
        console.log(`  Inserted lessons ${i + 1} to ${i + batch.length}`);
      }

      console.log("Insertion completed successfully.");
    }

    // 2. Verification step
    const totalCourses = await Course.count({ where: { organization_id: ORG_ID } });
    const totalLessons = await lesson.count({ where: { organization_id: ORG_ID } });

    console.log("==========================================");
    console.log("Verification Summary:");
    console.log(`Total Courses in Org: ${totalCourses}`);
    console.log(`Total Lessons in Org: ${totalLessons}`);
    console.log(`Average Lessons/Course: ${totalCourses > 0 ? (totalLessons / totalCourses).toFixed(2) : 0}`);
    console.log("==========================================");

    process.exit(0);
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  }
}

runSeed();
