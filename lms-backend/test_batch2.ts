import { sequelize } from './src/config/database';
import { lessonRepsitory } from './src/modules/lesson/lesson.repository';
import { sectionRepository } from './src/modules/section/section.repository';
import { ActionItemRepository } from './src/modules/actionItems/actionItems.repository';
import { ExamRepository } from './src/modules/exam/exam.repository';
import { encodeCursor } from './src/utils/cursor';

// Enable logging
sequelize.options.logging = console.log;

async function run() {
  try {
    const lessonRepo = new lessonRepsitory();
    const sectionRepo = new sectionRepository();
    const actionRepo = new ActionItemRepository();
    const examRepo = new ExamRepository();
    const orgId = '123e4567-e89b-12d3-a456-426614174000';

    console.log('\n--- 1. Lesson - Next Page Cursor ---');
    const cursorL = encodeCursor({ created_at: new Date().toISOString(), id: '123e4567-e89b-12d3-a456-426614174000' });
    await lessonRepo.getLesson(orgId, 1, 20, cursorL, {});

    console.log('\n--- 2. Section - Next Page Cursor ---');
    const cursorS = encodeCursor({ created_at: new Date().toISOString(), id: '123e4567-e89b-12d3-a456-426614174000' });
    await sectionRepo.getSection(orgId, 1, 20, cursorS);

    console.log('\n--- 3. Action Items - Next Page Cursor ---');
    const cursorA = encodeCursor({ created_at: new Date().toISOString(), id: '123e4567-e89b-12d3-a456-426614174000' });
    await actionRepo.getActionItems({ organization_id: orgId }, 1, 20, cursorA);

    console.log('\n--- 4. Exam Public Result - Next Page Cursor ---');
    const cursorP = encodeCursor({ submitted_at: new Date().toISOString(), id: '123e4567-e89b-12d3-a456-426614174000' });
    await examRepo.getPublicExamResult(1, 20, cursorP);

  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}

run();
