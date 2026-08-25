export const __ENV = Object.assign({
  BASE_URL: 'http://localhost:3000/eduforge/api',
  AUTH_TOKEN: '',
  ORGANIZATION_ID: '', // Provide a test organization ID
  USER_ID: '',
  STUDENT_ID: '',
  COURSE_ID: '',
  SECTION_ID: '',
  LESSON_ID: '',
  EXAM_ID: '',
}, globalThis.__ENV);

export const ENV = {
  BASE_URL: __ENV.BASE_URL,
  AUTH_TOKEN: __ENV.AUTH_TOKEN,
  ORGANIZATION_ID: __ENV.ORGANIZATION_ID,
  USER_ID: __ENV.USER_ID,
  STUDENT_ID: __ENV.STUDENT_ID,
  COURSE_ID: __ENV.COURSE_ID,
  SECTION_ID: __ENV.SECTION_ID,
  LESSON_ID: __ENV.LESSON_ID,
  EXAM_ID: __ENV.EXAM_ID,
};
