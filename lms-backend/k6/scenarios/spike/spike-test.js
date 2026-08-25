import { sleep } from 'k6';
import { testCourses } from '../../modules/courses.js';
import { testStudents } from '../../modules/students.js';
import { testDashboard } from '../../modules/dashboard.js';

import { authenticate } from '../../lib/auth.js';
import { ENV } from '../../config/environments.js';

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '10s', target: 300 }, // Spike to 300 VUs quickly
    { duration: '2m', target: 300 },  // Hold at 300 VUs
    { duration: '10s', target: 10 },  // Drop back to normal
    { duration: '1m', target: 10 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
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
  testCourses(50, 1);
  sleep(1);
  testStudents(50, 1);
  sleep(1);
  testDashboard();
  sleep(1);
}
