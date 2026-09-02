import { sequelize } from './src/config/database';
import { CourseRepository } from './src/modules/course/course.repository';
import { ExamRepository } from './src/modules/exam/exam.repository';
import { encodeCursor } from './src/utils/cursor';
import { ValidationError } from './src/utils/globalErrorHandlingFile';

async function run() {
  const courseRepo = new CourseRepository();
  const examRepo = new ExamRepository();
  const orgId = '1234'; // It might fail in real DB if it's not a UUID, let's use a dummy UUID.
  const dummyUUID = '00000000-0000-0000-0000-000000000000';

  console.log('\n--- 1. Course - Empty Cursor (First Page) ---');
  try {
    await courseRepo.getAllCourses(dummyUUID, 1, 20, '');
    console.log('PASS');
  } catch(e: any) { console.error('FAIL:', e.message); }

  console.log('\n--- 2. Course - Valid Cursor (Next Page) ---');
  try {
    const cursorC = encodeCursor({ created_at: new Date().toISOString(), id: dummyUUID });
    await courseRepo.getAllCourses(dummyUUID, 1, 20, cursorC);
    console.log('PASS');
  } catch(e: any) { console.error('FAIL:', e.message); }
  
  console.log('\n--- 3. Course - Malformed Cursor ---');
  try {
    await courseRepo.getAllCourses(dummyUUID, 1, 20, 'malformed-cursor-string!!!');
    console.log('FAIL: Did not throw');
  } catch(e: any) { 
    if(e instanceof ValidationError) console.log('PASS: ValidationError thrown');
    else console.error('FAIL: Wrong error type:', e.name, e.message);
  }

  console.log('\n--- 4. Course - Structurally Invalid Cursor ---');
  try {
    const badCursor = encodeCursor({ foo: 'bar' }); // Missing created_at and id
    await courseRepo.getAllCourses(dummyUUID, 1, 20, badCursor);
    console.log('FAIL: Did not throw');
  } catch(e: any) {
    if(e instanceof ValidationError) console.log('PASS: ValidationError thrown');
    else console.error('FAIL: Wrong error type:', e.name, e.message);
  }

  console.log('\n--- 5. Course - Legacy Mode ---');
  try {
    await courseRepo.getAllCourses(dummyUUID, 1, 20, undefined);
    console.log('PASS');
  } catch(e: any) { console.error('FAIL:', e.message); }

  console.log('\n--- 6. Exam - Valid Cursor (Next Page) ---');
  try {
    const cursorE = encodeCursor({ created_on: new Date().toISOString(), id: dummyUUID });
    await examRepo.getAllExams(dummyUUID, 20, 0, cursorE);
    console.log('PASS');
  } catch(e: any) { console.error('FAIL:', e.message); }

  console.log('\n--- 7. Exam - Invalid Cursor Field Name ---');
  try {
    // Exam uses created_on, providing created_at should fail
    const badCursorE = encodeCursor({ created_at: new Date().toISOString(), id: dummyUUID });
    await examRepo.getAllExams(dummyUUID, 20, 0, badCursorE);
    console.log('FAIL: Did not throw');
  } catch(e: any) {
    if(e instanceof ValidationError) console.log('PASS: ValidationError thrown');
    else console.error('FAIL: Wrong error type:', e.name, e.message);
  }

  process.exit(0);
}

run();
