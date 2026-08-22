import { sleep } from 'k6';
import { testCourses } from '../../modules/courses.js';

export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  testCourses(10, 1);
  sleep(1);
  testCourses(20, 1);
  sleep(1);
  testCourses(50, 1);
  sleep(1);
  testCourses(100, 1);
  sleep(1);
}
