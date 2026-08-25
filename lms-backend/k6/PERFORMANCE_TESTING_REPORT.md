# EduForge LMS — Production Performance Testing Report

**Document:** Performance Testing & Benchmark Report
**System:** EduForge Learning Management System (LMS)
**Testing Tool:** k6
**Environment:** Local development environment
**Test Type:** Functional performance, baseline, pagination, load, spike, and stress testing
**Report Status:** Completed
**Authentication:** JWT-based authenticated requests
**Test Date:** 24 August 2026

---

## 1. Executive Summary

A comprehensive performance-testing suite was executed against the EduForge LMS backend using k6.

The test suite covered:

* Smoke testing
* Pagination benchmarking
* Baseline performance
* Load testing
* Spike testing
* Stress testing

Authentication was performed through the application's real login endpoint and the resulting JWT was propagated through the protected API requests.

### Overall Result

The system demonstrated:

* **100% successful HTTP requests across all reported tests**
* **0% HTTP request failure rate**
* Successful JWT authentication
* Successful protected API access
* No observed HTTP 401/403/404/500 failures during the final performance runs

However, the higher-concurrency tests exposed a clear **latency scalability limitation**.

The most important observation is that while the application remained functionally available under load, response latency increased substantially as concurrency increased.

Therefore:

> **Functional reliability under the tested workloads is strong, but performance scalability requires optimization before considering the current results production-ready at 100–300 concurrent virtual users.**

---

# 2. Test Environment

## 2.1 Application

**Application:** EduForge LMS Backend

**Technology characteristics:**

* Node.js
* Fastify
* TypeScript
* PostgreSQL
* Sequelize ORM
* JWT authentication
* Multi-tenant organization context

## 2.2 Performance Tool

**Tool:** k6

The tests generated concurrent authenticated HTTP traffic against the backend.

## 2.3 Authentication

The performance suite uses the application's normal authentication flow:

```text
k6 setup()
     ↓
POST /auth/login
     ↓
JWT access_token
     ↓
Authorization: Bearer <JWT>
     ↓
Protected API endpoints
     ↓
Backend authentication
     ↓
Tenant / organization context
```

No authentication bypass or hardcoded JWT was used.

---

# 3. Test Scenarios

| Test                 | Maximum VUs | Duration | Purpose                                           |
| -------------------- | ----------: | -------: | ------------------------------------------------- |
| Smoke                |           1 |   10 sec | Basic functional verification                     |
| Pagination Benchmark |           5 |    1 min | Evaluate pagination/query-size behavior           |
| Baseline             |           5 |    2 min | Establish normal performance baseline             |
| Load                 |         100 |    8 min | Evaluate behavior under sustained increasing load |
| Spike                |         300 |   4m 40s | Evaluate sudden/high concurrency                  |
| Stress               |         200 |   23 min | Evaluate sustained stress behavior                |

---

# 4. Smoke Test

**File:** `k6/scenarios/smoke/smoke-test.js`

### Configuration

* Maximum VUs: 1
* Test duration: 10 seconds
* Requests: 15
* HTTP failure threshold: 0%

### Results

| Metric                |    Result |
| --------------------- | --------: |
| HTTP requests         |        15 |
| HTTP failures         |         0 |
| HTTP failure rate     | **0.00%** |
| Checks                |        28 |
| Checks passed         |        28 |
| Checks failed         |         0 |
| Average HTTP duration |  50.46 ms |
| Median HTTP duration  |  10.76 ms |
| P90                   |  38.87 ms |
| P95                   | 199.33 ms |
| Maximum               |    555 ms |

### Endpoint Performance

| Endpoint Group | Average Latency |
| -------------- | --------------: |
| Courses        |         8.66 ms |
| Dashboard      |        18.21 ms |
| Enrollments    |        31.81 ms |
| Exams          |         5.98 ms |
| Lessons        |         5.99 ms |
| Sections       |        11.51 ms |
| Students       |        18.80 ms |

### Assessment

**Status: PASS**

The smoke test confirms that the authentication chain and protected endpoints operate correctly under a single-user workload.

---

# 5. Pagination Benchmark

**File:** `k6/scenarios/pagination/pagination-benchmark.js`

### Configuration

* VUs: 5
* Duration: 1 minute
* Tested pagination sizes:

  * 10
  * 20
  * 50
  * 100

### Results

| Metric                |    Result |
| --------------------- | --------: |
| HTTP requests         |       301 |
| HTTP failures         |         0 |
| HTTP failure rate     | **0.00%** |
| Checks                |       602 |
| Checks passed         |       602 |
| Checks failed         |         0 |
| Average HTTP duration |  68.48 ms |
| Median                |  70.90 ms |
| P90                   | 113.05 ms |
| P95                   | 146.30 ms |
| Maximum               | 456.33 ms |

### Assessment

**Status: PASS**

The pagination benchmark remained stable under five concurrent VUs.

The measured P95 of approximately **146 ms** indicates healthy performance for this workload.

The benchmark also confirms that the API continues to operate successfully while testing different pagination limits.

---

# 6. Baseline Test

**File:** `k6/scenarios/baseline/baseline-test.js`

### Configuration

* Maximum VUs: 5
* Duration: 2 minutes
* Gradual ramp-up and ramp-down
* HTTP failure threshold: <1%

### Result

The baseline test was previously validated successfully with the authenticated configuration.

The baseline scenario established the expected low-concurrency behavior before higher-load testing.

### Assessment

**Status: PASS**

The baseline establishes a stable reference point for comparison with load, spike, and stress tests.

---

# 7. Load Test

**File:** `k6/scenarios/load/load-test.js`

### Load Profile

```text
10 VUs
   ↓
25 VUs
   ↓
50 VUs
   ↓
100 VUs
   ↓
0 VUs
```

Total duration: approximately 8 minutes.

### Results

| Metric                |     Result |
| --------------------- | ---------: |
| Maximum VUs           |        100 |
| HTTP requests         |      9,085 |
| HTTP failures         |          0 |
| HTTP failure rate     |  **0.00%** |
| Checks                |     18,170 |
| Checks passed         |     18,170 |
| Checks failed         |          0 |
| Average HTTP duration |  582.54 ms |
| Median                |  131.37 ms |
| P90                   |     1.89 s |
| P95                   | **2.38 s** |
| Maximum               |     3.94 s |
| Iterations            |      4,542 |

### Threshold Result

Configured:

```text
http_req_failed < 1%
http_req_duration P95 < 1000 ms
```

Actual:

```text
HTTP failure rate = 0.00%       PASS
P95 latency = 2.38 seconds      FAIL
```

### Assessment

**Status: PARTIAL PASS / PERFORMANCE THRESHOLD FAILURE**

The backend remained functionally reliable with **0% HTTP failures**, but latency exceeded the defined performance objective.

The P95 response time reached approximately **2.38 seconds**, more than twice the configured 1-second target.

This indicates that the application can handle the tested request volume without returning errors, but response time deteriorates as concurrency increases.

---

# 8. Spike Test

**File:** `k6/scenarios/spike/spike-test.js`

### Load Profile

Maximum concurrency:

**300 VUs**

Duration:

**4 minutes 40 seconds**

### Results

| Metric                |     Result |
| --------------------- | ---------: |
| Maximum VUs           |        300 |
| HTTP requests         |      7,383 |
| HTTP failures         |          0 |
| HTTP failure rate     |  **0.00%** |
| Checks                |     14,766 |
| Checks passed         |     14,766 |
| Checks failed         |          0 |
| Average HTTP duration |     4.13 s |
| Median                |     3.77 s |
| P90                   |     8.66 s |
| P95                   | **9.48 s** |
| Maximum               |    11.89 s |
| Iterations            |      3,691 |

### Endpoint Performance

| Endpoint Group | Average |    P95 |
| -------------- | ------: | -----: |
| Courses        |  3.58 s | 8.88 s |
| Students       |  4.68 s | 9.94 s |

### Assessment

**Status: FUNCTIONAL PASS / PERFORMANCE WARNING**

The system maintained:

**0.00% HTTP failures**

even at 300 concurrent VUs.

However, latency increased dramatically:

* Average: **4.13 s**
* P95: **9.48 s**
* Maximum: **11.89 s**

This indicates that the application remained available but became highly latency-bound under spike conditions.

The spike test therefore demonstrates resilience at the HTTP-error level, but it does **not** demonstrate acceptable user-facing performance at 300 concurrent VUs.

---

# 9. Stress Test

**File:** `k6/scenarios/stress/stress-test.js`

### Load Profile

```text
50 VUs
   ↓
100 VUs
   ↓
200 VUs
   ↓
sustained periods
   ↓
ramp down
```

Total duration:

**23 minutes**

### Results

| Metric                |     Result |
| --------------------- | ---------: |
| Maximum VUs           |        200 |
| HTTP requests         |     45,619 |
| HTTP failures         |          0 |
| HTTP failure rate     |  **0.00%** |
| Checks                |     91,238 |
| Checks passed         |     91,238 |
| Checks failed         |          0 |
| Average HTTP duration |     1.73 s |
| Median                |     1.00 s |
| P90                   |     4.96 s |
| P95                   | **6.01 s** |
| Maximum               |    10.05 s |
| Iterations            |     22,809 |

### Endpoint Performance

| Endpoint Group | Average |    P95 |
| -------------- | ------: | -----: |
| Courses        |  1.82 s | 5.96 s |
| Students       |  1.65 s | 6.08 s |

### Assessment

**Status: FUNCTIONAL PASS / PERFORMANCE WARNING**

The application successfully processed more than **45,000 HTTP requests** during the stress test without an HTTP failure.

This is a strong functional-resilience result.

However, the P95 latency reached approximately **6 seconds**.

Therefore, the application currently demonstrates:

> **High request-success reliability but insufficient latency scalability at sustained 200-VU stress.**

---

# 10. Cross-Test Comparison

| Test       | Max VUs | Requests | Failure Rate | Avg Latency | P95 Latency | Result                 |
| ---------- | ------: | -------: | -----------: | ----------: | ----------: | ---------------------- |
| Smoke      |       1 |       15 |        0.00% |       50 ms |      199 ms | PASS                   |
| Pagination |       5 |      301 |        0.00% |       68 ms |      146 ms | PASS                   |
| Load       |     100 |    9,085 |        0.00% |      583 ms |      2.38 s | ⚠️ P95 FAIL            |
| Spike      |     300 |    7,383 |        0.00% |      4.13 s |      9.48 s | ⚠️ Latency degradation |
| Stress     |     200 |   45,619 |        0.00% |      1.73 s |      6.01 s | ⚠️ Latency degradation |

---

# 11. Performance Scaling Observation

The most significant result is the relationship between concurrency and latency.

At low concurrency:

```text
5 VUs
P95 ≈ 146 ms
```

At 100 VUs:

```text
P95 ≈ 2.38 s
```

At 200 VUs:

```text
P95 ≈ 6.01 s
```

At 300 VUs:

```text
P95 ≈ 9.48 s
```

This demonstrates a clear nonlinear latency increase as concurrency grows.

The application does not appear to fail through HTTP errors under the tested conditions. Instead, it exhibits increasing request-processing time.

This is an important distinction:

```text
Reliability:
        ████████████████████  Strong

Latency scalability:
        ███████░░░░░░░░░░░░░  Needs optimization
```

---

# 12. Key Findings

## Finding 1 — Authentication is stable

The k6 suite successfully authenticates using the application's real JWT authentication flow.

No authentication bypass was required.

**Status: PASS**

---

## Finding 2 — Protected API reliability is strong

Across the reported load and stress scenarios:

**HTTP failure rate = 0.00%**

This means the backend continued responding successfully even under high concurrency.

**Status: PASS**

---

## Finding 3 — Low-concurrency performance is healthy

Pagination testing at five VUs produced:

**P95 ≈ 146 ms**

Smoke testing also remained within reasonable latency levels.

**Status: PASS**

---

## Finding 4 — Performance degrades significantly with concurrency

At 100 VUs:

**P95 ≈ 2.38 s**

At 200 VUs:

**P95 ≈ 6.01 s**

At 300 VUs:

**P95 ≈ 9.48 s**

This is the primary performance concern.

**Status: ACTION REQUIRED**

---

# 13. Recommended Investigation Areas

The next performance-optimization phase should focus on identifying the bottleneck rather than immediately increasing infrastructure capacity.

Recommended areas:

### Database

* PostgreSQL connection pool utilization
* Slow queries
* Missing indexes
* Sequential scans
* Lock contention
* `EXPLAIN ANALYZE`
* Concurrent query saturation

### Sequelize / ORM

* N+1 queries
* Eager-loading behavior
* `include` joins
* Pagination with joins
* `COUNT` queries
* Unnecessary selected columns
* Large result sets
* Query duplication

### Application

* CPU utilization
* Node.js event-loop latency
* Memory usage
* Garbage collection
* Fastify request processing time

### Infrastructure

* PostgreSQL CPU/memory
* Database connection limits
* Network latency
* Node.js process configuration
* Horizontal scaling requirements

---

# 14. Recommended Next Testing Phase

Before declaring the system production-ready, the following should be performed in a production-like environment:

1. Repeat the baseline test after database warm-up.
2. Run load testing at 10, 25, 50 and 100 VUs.
3. Capture PostgreSQL `EXPLAIN ANALYZE` for the slowest endpoints.
4. Monitor database connection pool usage.
5. Monitor Node.js CPU and memory.
6. Identify endpoints contributing most to P95 latency.
7. Optimize the slow queries.
8. Repeat the same k6 tests.
9. Compare before/after P50, P90 and P95 latency.
10. Repeat spike and stress tests after optimization.

---

# 15. Production Readiness Assessment

| Area                       | Assessment             |
| -------------------------- | ---------------------- |
| Authentication             | PASS                   |
| API availability           | PASS                   |
| HTTP error rate            | PASS                   |
| Low-concurrency latency    | PASS                   |
| Pagination performance     | PASS                   |
| 100-VU latency target      | FAIL                   |
| 200-VU latency scalability | WARNING                |
| 300-VU spike latency       | WARNING                |
| Overall scalability        | **Needs optimization** |

### Final Assessment

The EduForge LMS backend demonstrated excellent **functional resilience** during the executed tests, maintaining a **0% HTTP failure rate** even during sustained stress and 300-VU spike testing.

However, the results also reveal a significant scalability bottleneck in request latency.

The system should therefore **not be considered fully performance-ready for sustained high-concurrency production traffic yet**.

The next engineering objective should be:

> **Reduce P95 latency under 100–200 concurrent users while preserving the current 0% HTTP failure rate.**

The current k6 results provide a strong baseline against which subsequent database, ORM, caching, and infrastructure optimizations can be measured.

---

## 16. Test Evidence Summary

### Smoke

```text
http_req_failed = 0.00%
P95 = 199.33 ms
```

### Pagination

```text
http_req_failed = 0.00%
P95 = 146.30 ms
```

### Load

```text
http_req_failed = 0.00%
P95 = 2.38 s
Threshold = 1.00 s
Result = Threshold exceeded
```

### Spike

```text
http_req_failed = 0.00%
P95 = 9.48 s
Maximum VUs = 300
```

### Stress

```text
http_req_failed = 0.00%
P95 = 6.01 s
Maximum VUs = 200
Requests = 45,619
```

---

## Conclusion

The current EduForge LMS performance test suite successfully validates the application's authentication, API availability, and behavior under progressively increasing concurrency.

The strongest result is the absence of HTTP failures across the completed higher-load tests.

The primary limitation is latency scalability. As concurrency increases from single-digit VUs to 100–300 VUs, response times increase from tens of milliseconds to several seconds.

This strongly suggests that the next phase should focus on **database query optimization, Sequelize query shape, connection-pool behavior, and application resource utilization**.

The k6 suite should now be retained as a regression-performance baseline and rerun after every major backend performance optimization.
