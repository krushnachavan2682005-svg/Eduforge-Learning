import http from 'k6/http';
import { ENV } from '../config/environments.js';
import { getAuthHeaders } from '../helpers/auth.js';
import { is200, hasData } from '../helpers/checks.js';
import { metrics } from '../helpers/metrics.js';

export function testCourses(limit = 10, page = 1) {
  const url = `${ENV.BASE_URL}/courses?limit=${limit}&page=${page}`;
  
  const res = http.get(url, { headers: getAuthHeaders() });
  
  metrics.coursesLatency.add(res.timings.duration);
  
  const success = is200(res) && hasData(res);
  
  if (!success) {
    metrics.coursesErrors.add(1);
  }
}

export function testCourseById(courseId = ENV.COURSE_ID) {
  if (!courseId) return;
  const url = `${ENV.BASE_URL}/courses/${courseId}`;
  
  const res = http.get(url, { headers: getAuthHeaders() });
  
  metrics.coursesLatency.add(res.timings.duration);
  
  const success = is200(res);
  
  if (!success) {
    metrics.coursesErrors.add(1);
  }
}
