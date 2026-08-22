import http from 'k6/http';
import { ENV } from '../config/environments.js';
import { getAuthHeaders } from '../helpers/auth.js';
import { is201 } from '../helpers/checks.js';
import { metrics } from '../helpers/metrics.js';

export function testAssignCourse(payload) {
  const url = `${ENV.BASE_URL}/assignCourse`;
  
  const res = http.post(url, JSON.stringify(payload), { headers: getAuthHeaders() });
  
  metrics.assignmentsLatency.add(res.timings.duration);
  
  const success = is201(res);
  
  if (!success) {
    metrics.assignmentsErrors.add(1);
  }
}

export function testAssignActionItems(payload) {
  const url = `${ENV.BASE_URL}/assignActionItems`;
  
  const res = http.post(url, JSON.stringify(payload), { headers: getAuthHeaders() });
  
  metrics.assignmentsLatency.add(res.timings.duration);
  
  const success = is201(res);
  
  if (!success) {
    metrics.assignmentsErrors.add(1);
  }
}
