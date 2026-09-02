import { sequelize } from './src/config/database';
import { lessonRepsitory } from './src/modules/lesson/lesson.repository';
import { sectionRepository } from './src/modules/section/section.repository';
import { ActionItemRepository } from './src/modules/actionItems/actionItems.repository';
import { ExamRepository } from './src/modules/exam/exam.repository';
import { encodeCursor } from './src/utils/cursor';
import { ValidationError } from './src/utils/globalErrorHandlingFile';

// Setup logging to capture SQL
let sqlLogs: string[] = [];
sequelize.options.logging = (msg) => sqlLogs.push(msg);

async function run() {
  const lessonRepo = new lessonRepsitory();
  const sectionRepo = new sectionRepository();
  const actionRepo = new ActionItemRepository();
  const examRepo = new ExamRepository();
  const orgId = '123e4567-e89b-12d3-a456-426614174000';
  const dummyDate = new Date().toISOString();

  // Helper function to test errors
  const assertValidationError = async (name: string, fn: () => Promise<any>) => {
    try {
      await fn();
      console.log(`❌ [${name}] FAILED - Expected ValidationError but succeeded`);
    } catch (e: any) {
      if (e instanceof ValidationError) {
        console.log(`✅ [${name}] PASSED - Threw ValidationError: ${e.message}`);
      } else {
        console.log(`❌ [${name}] FAILED - Threw ${e.name} instead of ValidationError: ${e.message}`);
      }
    }
  };

  const verifyEndpoint = async (name: string, repoCall: (cursor?: string, page?: number) => Promise<any>, cursorFields: string[], validData: any) => {
    console.log(`\n===================================`);
    console.log(` VERIFYING ${name} ENDPOINT`);
    console.log(`===================================`);
    
    // 1. FIRST PAGE CURSOR (cursor="")
    sqlLogs = [];
    await repoCall("", undefined);
    console.log(`\n[${name} - First Page Cursor] SQL Logs:`);
    sqlLogs.forEach(l => console.log(l));
    const firstPageValid = sqlLogs.some(l => l.includes('LIMIT 21') && !l.includes('OFFSET') && !l.includes('COUNT('));
    console.log(`-> First Page Valid (LIMIT 21, No OFFSET, No COUNT): ${firstPageValid ? '✅' : '❌'}`);

    // 2. NEXT PAGE CURSOR (valid cursor)
    sqlLogs = [];
    const validCursor = encodeCursor(validData);
    await repoCall(validCursor, undefined);
    console.log(`\n[${name} - Next Page Cursor] SQL Logs:`);
    sqlLogs.forEach(l => console.log(l));
    const nextPageValid = sqlLogs.some(l => l.includes('LIMIT 21') && !l.includes('OFFSET') && l.includes('<') && !l.includes('COUNT('));
    console.log(`-> Next Page Valid (LIMIT 21, Cursor WHERE, No OFFSET, No COUNT): ${nextPageValid ? '✅' : '❌'}`);

    // 3. LEGACY OFFSET (cursor undefined, page 1)
    sqlLogs = [];
    await repoCall(undefined, 1);
    console.log(`\n[${name} - Legacy Page 1] SQL Logs:`);
    sqlLogs.forEach(l => console.log(l));
    const legacyPage1Valid = sqlLogs.some(l => l.includes('OFFSET 0') && l.includes('LIMIT 20'));
    const countExists = sqlLogs.some(l => l.includes('COUNT('));
    console.log(`-> Legacy Page 1 Valid (LIMIT 20, OFFSET 0, COUNT if applicable): ${legacyPage1Valid ? '✅' : '❌'} (Count ran: ${countExists})`);

    // 4. INVALID CURSORS
    console.log(`\n[${name} - Invalid Cursors Test]`);
    await assertValidationError('Malformed Cursor', () => repoCall("invalid_base64_string!!!!"));
    await assertValidationError('Valid Base64 Invalid JSON', () => repoCall(Buffer.from("Not JSON").toString('base64url')));
    await assertValidationError('Missing Cursor Field', () => repoCall(encodeCursor({ id: 'abc' }))); 
    await assertValidationError('Wrong Timestamp Field', () => repoCall(encodeCursor({ wrong_timestamp: dummyDate, id: 'abc' })));
  };

  try {
    await verifyEndpoint(
      'Lesson', 
      (c, p) => lessonRepo.getLesson(orgId, p || 1, 20, c, {}), 
      ['created_at', 'id'], 
      { created_at: dummyDate, id: orgId }
    );

    await verifyEndpoint(
      'Section', 
      (c, p) => sectionRepo.getSection(orgId, p || 1, 20, c), 
      ['created_at', 'id'], 
      { created_at: dummyDate, id: orgId }
    );

    await verifyEndpoint(
      'Action Items', 
      (c, p) => actionRepo.getActionItems({ organization_id: orgId }, p || 1, 20, c), 
      ['created_at', 'id'], 
      { created_at: dummyDate, id: orgId }
    );

    await verifyEndpoint(
      'Exam Public Result', 
      (c, p) => examRepo.getPublicExamResult(p || 1, 20, c), 
      ['submitted_at', 'id'], 
      { submitted_at: dummyDate, id: orgId }
    );

    // 5. DB INDEX AUDIT
    console.log(`\n===================================`);
    console.log(` DATABASE INDEX AUDIT`);
    console.log(`===================================`);
    const indexesQuery = `
      SELECT tablename, indexname, indexdef 
      FROM pg_indexes 
      WHERE indexname IN ('idx_lessons_cursor', 'idx_sections_cursor', 'idx_action_items_cursor', 'idx_eum_public_cursor');
    `;
    const [indexes] = await sequelize.query(indexesQuery);
    console.log(JSON.stringify(indexes, null, 2));

  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}

run();
