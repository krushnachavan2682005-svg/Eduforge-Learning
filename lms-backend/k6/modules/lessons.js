import http from 'k6/http';
import { ENV } from '../config/environments.js';
import { getAuthHeaders } from '../helpers/auth.js';
import { is200, hasData } from '../helpers/checks.js';
import { metrics } from '../helpers/metrics.js';

export function testLessons(limit = 10, page = 1) {
  const url = `${ENV.BASE_URL}/all-lesson?limit=${limit}&page=${page}`;
  
  const res = http.get(url, { headers: getAuthHeaders() });
  
  metrics.lessonsLatency.add(res.timings.duration);
  
  const success = is200(res) && hasData(res);
  
  if (!success) {
    metrics.lessonsErrors.add(1);
  }
}

export function testLessonById(lessonId = ENV.LESSON_ID) {
  if (!lessonId) return;
  const url = `${ENV.BASE_URL}/lesson/${lessonId}`;
  
  const res = http.get(url, { headers: getAuthHeaders() });
  
  metrics.lessonsLatency.add(res.timings.duration);
  
  const success = is200(res);
  
  if (!success) {
    metrics.lessonsErrors.add(1);
  }
}
