import http from 'k6/http';
import { ENV } from '../config/environments.js';
import { getAuthHeaders } from '../helpers/auth.js';
import { is200, hasData } from '../helpers/checks.js';
import { metrics } from '../helpers/metrics.js';

export function testStudents(limit = 10, page = 1) {
  const url = `${ENV.BASE_URL}/students?limit=${limit}&page=${page}`;
  
  const res = http.get(url, { headers: getAuthHeaders() });
  
  metrics.studentsLatency.add(res.timings.duration);
  
  const success = is200(res) && hasData(res);
  
  if (!success) {
    metrics.studentsErrors.add(1);
  }
}

export function testStudentById(studentId = ENV.STUDENT_ID) {
  if (!studentId) return;
  const url = `${ENV.BASE_URL}/students/${studentId}`;
  
  const res = http.get(url, { headers: getAuthHeaders() });
  
  metrics.studentsLatency.add(res.timings.duration);
  
  const success = is200(res);
  
  if (!success) {
    metrics.studentsErrors.add(1);
  }
}
