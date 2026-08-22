# LMS Backend k6 Performance Testing Suite

This directory contains the k6 load testing suite designed to establish a performance baseline for the Node.js/Fastify/PostgreSQL LMS backend. It measures the performance of the system **before** optimizations like cursor pagination, Redis caching, or Kubernetes scaling are introduced.

## Configuration

We use environment variables to prevent hardcoding secrets and IDs. You must set these before running the tests.

Create a copy of this for your local environment (DO NOT commit secrets):

```bash
export BASE_URL=http://localhost:3000/api/v1
export AUTH_TOKEN=your_jwt_token_here
export ORGANIZATION_ID=test_org_id
export COURSE_ID=test_course_id
export STUDENT_ID=test_student_id
```

## Running Tests

We have separated the tests into different scenarios to model different traffic patterns. You can run them individually:

### 1. Smoke Test
Verifies API functionality before load testing (1 VU).
```bash
k6 run k6/scenarios/smoke/smoke-test.js
```

### 2. Baseline Test
Captures current performance under realistic low-to-medium traffic.
```bash
k6 run k6/scenarios/baseline/baseline-test.js
```

### 3. Load Test
Gradually increases traffic (e.g., up to 100 VUs) to measure performance under load.
```bash
k6 run k6/scenarios/load/load-test.js
```

### 4. Stress Test
Pushes beyond normal load to find latency degradation and DB saturation points.
```bash
k6 run k6/scenarios/stress/stress-test.js
```

### 5. Spike Test
Simulates sudden traffic increases (e.g., spike to 300 VUs) to evaluate system resilience.
```bash
k6 run k6/scenarios/spike/spike-test.js
```

### 6. Pagination Benchmark
Specific tests for `limit=10`, `limit=20`, `limit=50`, etc., to establish the current OFFSET pagination performance before migrating to cursor pagination.
```bash
k6 run k6/scenarios/pagination/pagination-benchmark.js
```

## Interpreting Results
- **p50, p90, p95, p99**: Request durations at different percentiles. `p95<1000ms` means 95% of requests completed in under 1 second.
- **Custom Metrics**: We use custom trends (e.g., `courses_latency`, `dashboard_latency`) to measure the performance of specific modules independently.

## Safety Warnings
> [!WARNING]
> Do NOT run write tests (e.g., `assignments.js`) against production data unless you are using dedicated test records in a sandboxed organization. The current test scripts focus heavily on read endpoints (GET) to prevent accidental data destruction. Write tests should only use controlled `organization_id` and test `course_id`/`student_id`.
