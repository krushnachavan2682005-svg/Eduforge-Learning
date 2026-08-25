import { sleep } from 'k6';

import { testCourses } from '../../modules/courses.js';
import { authenticate } from '../../lib/auth.js';
import { ENV } from '../../config/environments.js';

export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
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
  sleep(1);

  testCourses(20, 1);
  sleep(1);

  testCourses(50, 1);
  sleep(1);

  testCourses(100, 1);
  sleep(1);
}