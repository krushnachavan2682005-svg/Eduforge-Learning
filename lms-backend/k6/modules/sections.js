import http from 'k6/http';
import { ENV } from '../config/environments.js';
import { getAuthHeaders } from '../helpers/auth.js';
import { is200, hasData } from '../helpers/checks.js';
import { metrics } from '../helpers/metrics.js';

export function testSections(limit = 10, page = 1) {
  const url = `${ENV.BASE_URL}/sections?limit=${limit}&page=${page}`;
  
  const res = http.get(url, { headers: getAuthHeaders() });
  
  metrics.sectionsLatency.add(res.timings.duration);
  
  const success = is200(res) && hasData(res);
  
  if (!success) {
    metrics.sectionsErrors.add(1);
  }
}

export function testSectionById(sectionId = ENV.SECTION_ID) {
  if (!sectionId) return;
  const url = `${ENV.BASE_URL}/sections/${sectionId}`;
  
  const res = http.get(url, { headers: getAuthHeaders() });
  
  metrics.sectionsLatency.add(res.timings.duration);
  
  const success = is200(res);
  
  if (!success) {
    metrics.sectionsErrors.add(1);
  }
}
