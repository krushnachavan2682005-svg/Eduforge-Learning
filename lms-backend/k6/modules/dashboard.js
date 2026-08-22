import http from 'k6/http';
import { ENV } from '../config/environments.js';
import { getAuthHeaders } from '../helpers/auth.js';
import { is200 } from '../helpers/checks.js';
import { metrics } from '../helpers/metrics.js';

export function testDashboard() {
  const url = `${ENV.BASE_URL}/dashboard/admin`;
  
  const res = http.get(url, { headers: getAuthHeaders() });
  
  metrics.dashboardLatency.add(res.timings.duration);
  
  const success = is200(res);
  
  if (!success) {
    metrics.dashboardErrors.add(1);
  }
}

export function testMeDashboard() {
  const url = `${ENV.BASE_URL}/dashboard/student`;
  
  const res = http.get(url, { headers: getAuthHeaders() });
  
  metrics.dashboardLatency.add(res.timings.duration);
  
  const success = is200(res);
  
  if (!success) {
    metrics.dashboardErrors.add(1);
  }
}
