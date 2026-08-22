import { sleep } from 'k6';
import { testCourses } from '../../modules/courses.js';
import { testStudents } from '../../modules/students.js';
import { testDashboard } from '../../modules/dashboard.js';

export const options = {
  stages: [
    { duration: '30s', target: 5 }, // Ramp up to 5 VUs
    { duration: '1m', target: 5 },  // Stay at 5 VUs for 1m
    { duration: '30s', target: 0 }, // Ramp down to 0 VUs
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // Less than 1% errors
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
  },
};

export default function () {
  testCourses(20, 1);
  sleep(1);
  testStudents(20, 1);
  sleep(1);
  testDashboard();
  sleep(1);
}
