# Performance Test Plan & Baseline Analysis

## Endpoint Matrix

| Module | Endpoint | Type | Priority | Test |
| ------ | -------- | ---- | -------- | ---- |
| Courses | `GET /courses` | Read | Tier A | `baseline`, `load`, `pagination` |
| Courses | `GET /courses/:id` | Read | Tier C | `baseline` |
| Sections | `GET /sections` | Read | Tier A | `baseline`, `load` |
| Lessons | `GET /lessons` | Read | Tier A | `baseline`, `load` |
| Students | `GET /students` | Read | Tier A | `baseline`, `load`, `stress` |
| Enrollments | `GET /enrollments` | Read | Tier A | `baseline` |
| Exams | `GET /exam` | Read | Tier A | `baseline` |
| Dashboard | `GET /dashboard/admin` | Read | Tier A | `baseline`, `load`, `stress` |
| Assignments | `POST /assignCourse` | Write | Tier B | Controlled `load` |
| Assignments | `POST /assignActionItems` | Write | Tier B | Controlled `load` |

---

## Baseline Metrics (Pre-Optimization)

*Note: Execute the tests and fill in these metrics.*

**Endpoint:** `GET /courses?limit=10&page=1`
**VUs:** 5
**Duration:** 1m
**RPS:** ___
**p50:** ___ ms
**p90:** ___ ms
**p95:** ___ ms
**p99:** ___ ms
**Error rate:** ___ %
**Response size:** ___ KB

**Endpoint:** `GET /dashboard/admin`
**VUs:** 5
**Duration:** 1m
**RPS:** ___
**p50:** ___ ms
**p90:** ___ ms
**p95:** ___ ms
**p99:** ___ ms
**Error rate:** ___ %
**Response size:** ___ KB

---

## Future Comparison Framework

As we introduce architectural improvements, use this table to compare performance metrics against the baseline.

### `GET /courses?limit=50` (Pagination Benchmark)

| Metric | Current (OFFSET) | Cursor Pagination | Redis Cache | Kubernetes |
| ------ | ---------------- | ----------------- | ----------- | ---------- |
| **p95 latency** | ___ ms | ___ ms | ___ ms | ___ ms |
| **p99 latency** | ___ ms | ___ ms | ___ ms | ___ ms |
| **RPS** | ___ | ___ | ___ | ___ |
| **Error rate** | ___ | ___ | ___ | ___ |

### `GET /dashboard/admin` (Aggregation Benchmark)

| Metric | Current | Optimized Queries | Redis Cache | Kubernetes |
| ------ | ------- | ----------------- | ----------- | ---------- |
| **p95 latency** | ___ ms | ___ ms | ___ ms | ___ ms |
| **p99 latency** | ___ ms | ___ ms | ___ ms | ___ ms |
| **RPS** | ___ | ___ | ___ | ___ |
| **Error rate** | ___ | ___ | ___ | ___ |
