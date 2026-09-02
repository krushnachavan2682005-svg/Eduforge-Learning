import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { authenticate } from '../../lib/auth.js';
import { getAuthHeaders } from '../../helpers/auth.js';
import { ENV } from '../../config/environments.js';

const offset_shallow_duration = new Trend('offset_shallow_duration');
const offset_medium_duration = new Trend('offset_medium_duration');
const offset_deep_duration = new Trend('offset_deep_duration');
const offset_very_deep_duration = new Trend('offset_very_deep_duration');

const cursor_shallow_duration = new Trend('cursor_shallow_duration');
const cursor_medium_duration = new Trend('cursor_medium_duration');
const cursor_deep_duration = new Trend('cursor_deep_duration');
const cursor_very_deep_duration = new Trend('cursor_very_deep_duration');

export const options = {
  scenarios: {
    offset_shallow: { executor: 'constant-vus', vus: 5, duration: '30s', exec: 'offsetShallow' },
    offset_medium: { executor: 'constant-vus', vus: 5, duration: '30s', exec: 'offsetMedium', startTime: '30s' },
    offset_deep: { executor: 'constant-vus', vus: 5, duration: '30s', exec: 'offsetDeep', startTime: '60s' },
    offset_very_deep: { executor: 'constant-vus', vus: 5, duration: '30s', exec: 'offsetVeryDeep', startTime: '90s' },
    
    cursor_shallow: { executor: 'constant-vus', vus: 5, duration: '30s', exec: 'cursorShallow', startTime: '120s' },
    cursor_medium: { executor: 'constant-vus', vus: 5, duration: '30s', exec: 'cursorMedium', startTime: '150s' },
    cursor_deep: { executor: 'constant-vus', vus: 5, duration: '30s', exec: 'cursorDeep', startTime: '180s' },
    cursor_very_deep: { executor: 'constant-vus', vus: 5, duration: '30s', exec: 'cursorVeryDeep', startTime: '210s' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const token = authenticate();
  ENV.AUTH_TOKEN = token;
  const headers = getAuthHeaders();

  console.log("Preparing cursors for benchmarking...");
  let currentCursor = "";
  const cursors = { p1: "", p100: null, p500: null, p1000: null };

  const targetPages = [100, 500, 1000];
  let maxPageFound = 1;

  for (let i = 1; i <= 1000; i++) {
    const res = http.get(`${ENV.BASE_URL}/students/enrollments?limit=20&cursor=${currentCursor}`, { headers });
    
    if (res.status !== 200) {
      console.error(`Cursor prep failed at page ${i} with status ${res.status}`);
      break;
    }
    
    const body = res.json();
    if (!body || !body.pagination) {
       console.error(`Missing pagination metadata at page ${i}`);
       break;
    }

    if (i === 100) cursors.p100 = currentCursor;
    if (i === 500) cursors.p500 = currentCursor;
    if (i === 1000) cursors.p1000 = currentCursor;

    maxPageFound = i;

    if (body.pagination.has_next) {
      currentCursor = body.pagination.next_cursor;
    } else {
      console.log(`Reached end of data at page ${i}. Insufficient data for deeper benchmarks.`);
      break;
    }

    if (i === 1000) break;
  }

  console.log(`Cursor preparation complete up to page ${maxPageFound}.`);
  return { token, cursors };
}

function runBenchmark(reqFn, metric) {
  const res = reqFn();
  
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'has data array': (r) => Array.isArray(r.json('data')),
    'length <= 20': (r) => {
      const data = r.json('data');
      return Array.isArray(data) && data.length <= 20;
    },
  });

  if (success) {
    metric.add(res.timings.duration);
  }
  
  sleep(1);
}

export function offsetShallow(data) {
  ENV.AUTH_TOKEN = data.token;
  runBenchmark(() => http.get(`${ENV.BASE_URL}/students/enrollments?limit=20&page=1`, { headers: getAuthHeaders() }), offset_shallow_duration);
}

export function offsetMedium(data) {
  ENV.AUTH_TOKEN = data.token;
  runBenchmark(() => http.get(`${ENV.BASE_URL}/students/enrollments?limit=20&page=100`, { headers: getAuthHeaders() }), offset_medium_duration);
}

export function offsetDeep(data) {
  ENV.AUTH_TOKEN = data.token;
  runBenchmark(() => http.get(`${ENV.BASE_URL}/students/enrollments?limit=20&page=500`, { headers: getAuthHeaders() }), offset_deep_duration);
}

export function offsetVeryDeep(data) {
  ENV.AUTH_TOKEN = data.token;
  runBenchmark(() => http.get(`${ENV.BASE_URL}/students/enrollments?limit=20&page=1000`, { headers: getAuthHeaders() }), offset_very_deep_duration);
}

export function cursorShallow(data) {
  ENV.AUTH_TOKEN = data.token;
  runBenchmark(() => http.get(`${ENV.BASE_URL}/students/enrollments?limit=20&cursor=${data.cursors.p1}`, { headers: getAuthHeaders() }), cursor_shallow_duration);
}

export function cursorMedium(data) {
  if (!data.cursors.p100) return;
  ENV.AUTH_TOKEN = data.token;
  runBenchmark(() => http.get(`${ENV.BASE_URL}/students/enrollments?limit=20&cursor=${data.cursors.p100}`, { headers: getAuthHeaders() }), cursor_medium_duration);
}

export function cursorDeep(data) {
  if (!data.cursors.p500) return;
  ENV.AUTH_TOKEN = data.token;
  runBenchmark(() => http.get(`${ENV.BASE_URL}/students/enrollments?limit=20&cursor=${data.cursors.p500}`, { headers: getAuthHeaders() }), cursor_deep_duration);
}

export function cursorVeryDeep(data) {
  if (!data.cursors.p1000) return;
  ENV.AUTH_TOKEN = data.token;
  runBenchmark(() => http.get(`${ENV.BASE_URL}/students/enrollments?limit=20&cursor=${data.cursors.p1000}`, { headers: getAuthHeaders() }), cursor_very_deep_duration);
}
