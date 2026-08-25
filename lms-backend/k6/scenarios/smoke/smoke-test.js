import { sleep } from 'k6';
import { testCourses, testCourseById } from '../../modules/courses.js';
import { testSections, testSectionById } from '../../modules/sections.js';
import { testLessons, testLessonById } from '../../modules/lessons.js';
import { testStudents, testStudentById } from '../../modules/students.js';
import { testEnrollments } from '../../modules/enrollments.js';
import { testExams, testExamById } from '../../modules/exams.js';
import { testDashboard, testMeDashboard } from '../../modules/dashboard.js';
import { authenticate } from '../../lib/auth.js';
import { ENV } from '../../config/environments.js';

export const options = {
  vus: 1,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate==0'], // No errors allowed during smoke test
  },
};

export function setup() {
  const token = authenticate();
  return { token };
}

export default function (data) {
  if (data && data.token) {
    ENV.AUTH_TOKEN = data.token;
  }

  testCourses(10, 1);
  testCourseById();
  sleep(1);

  testSections(10, 1);
  testSectionById();
  sleep(1);

  testLessons(10, 1);
  testLessonById();
  sleep(1);

  testStudents(10, 1);
  testStudentById();
  sleep(1);

  testEnrollments(10, 1);
  sleep(1);

  testExams(10, 1);
  testExamById();
  sleep(1);

  testDashboard();
  testMeDashboard();
  sleep(1);
}
