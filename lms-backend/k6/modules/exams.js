import http from 'k6/http';
import { ENV } from '../config/environments.js';
import { getAuthHeaders } from '../helpers/auth.js';
import { is200, hasData } from '../helpers/checks.js';
import { metrics } from '../helpers/metrics.js';

export function testExams(limit = 10, page = 1) {
  const url = `${ENV.BASE_URL}/exam?limit=${limit}&page=${page}`;
  
  const res = http.get(url, { headers: getAuthHeaders() });
  
  metrics.examsLatency.add(res.timings.duration);
  
  const success = is200(res) && hasData(res);
  
  if (!success) {
    metrics.examsErrors.add(1);
  }
}

export function testExamById(examId = ENV.EXAM_ID) {
  if (!examId) return;
  const url = `${ENV.BASE_URL}/exam/${examId}`;
  
  const res = http.get(url, { headers: getAuthHeaders() });
  
  metrics.examsLatency.add(res.timings.duration);
  
  const success = is200(res);
  
  if (!success) {
    metrics.examsErrors.add(1);
  }
}
