import { sleep } from 'k6';
import { testCourses } from '../../modules/courses.js';
import { testStudents } from '../../modules/students.js';
import { testDashboard } from '../../modules/dashboard.js';

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // Allow some errors under stress
  },
};

export default function () {
  testCourses(50, 1);
  sleep(1);
  testStudents(50, 1);
  sleep(1);
  testDashboard();
  sleep(1);
}
