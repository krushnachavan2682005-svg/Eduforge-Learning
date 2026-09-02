# k6 Benchmark Guide: OFFSET vs CURSOR Pagination

This benchmark is designed to compare the real-world latency and database load implications of traditional OFFSET pagination versus sequential CURSOR pagination for the `GET /enrollments` endpoint. 

The test runs cleanly isolated scenarios at increasing depths (page 1, 100, 500, 1000) so we can directly observe if OFFSET performance degrades at depth, and if CURSOR avoids that degradation.

## How to Run

Execute the benchmark using the standard k6 runtime with your existing environment variables:

```bash
TEST_USER_EMAIL=admin@example.com \
TEST_USER_PASSWORD=yourpassword \
ORGANIZATION_ID=11111111-1111-1111-1111-111111111111 \
k6 run k6/scenarios/pagination/enrollments-pagination-benchmark.js
```

> [!NOTE]
> Ensure the target database has a sufficiently large dataset (ideally >20,000 records). If it has fewer, the setup block will cleanly fall back and not run deeper cursor tests.

## Scenarios

The benchmark executes 8 isolated, sequential scenarios. Each scenario runs for 30 seconds with a constant load of 5 VUs.

| Scenario | Mode | Depth | Query Parameters |
| --- | --- | --- | --- |
| `offset_shallow` | OFFSET | Page 1 | `?limit=20&page=1` |
| `offset_medium` | OFFSET | Page 100 | `?limit=20&page=100` |
| `offset_deep` | OFFSET | Page 500 | `?limit=20&page=500` |
| `offset_very_deep` | OFFSET | Page 1000 | `?limit=20&page=1000` |
| `cursor_shallow` | CURSOR | Page 1 | `?limit=20&cursor=` |
| `cursor_medium` | CURSOR | Page 100 | `?limit=20&cursor=<token_at_page_100>` |
| `cursor_deep` | CURSOR | Page 500 | `?limit=20&cursor=<token_at_page_500>` |
| `cursor_very_deep`| CURSOR | Page 1000 | `?limit=20&cursor=<token_at_page_1000>` |

## Cursor Preparation

Because cursor tokens are opaque and sequential, we cannot simply "guess" the token for page 1000. 

The `setup()` function solves this by traversing the cursor endpoint up to 1000 times before the actual load test begins. It collects and saves the exact `next_cursor` tokens emitted at pages 100, 500, and 1000. This ensures the benchmark accurately measures equivalent logical positions without mixing setup queries into the core performance results.

## Metrics to Observe

The test generates separate `Trend` metrics for every scenario:

- `offset_shallow_duration` vs `cursor_shallow_duration`
- `offset_medium_duration` vs `cursor_medium_duration`
- `offset_deep_duration` vs `cursor_deep_duration`
- `offset_very_deep_duration` vs `cursor_very_deep_duration`

**How to Interpret:**
Compare the **p95** and **p99** values (tail latency). 
- You should expect `offset` metrics to slowly degrade (get larger) as depth increases, as PostgreSQL has to scan and discard more rows. 
- You should expect `cursor` metrics to remain mostly flat, as the index allows PostgreSQL to jump instantly to the leaf node, regardless of depth.

## Correctness Validation

During the load test, k6 runs assertions on every response:
- **HTTP Status**: Verifies 200 OK.
- **Payload Shape**: Verifies the response contains a `data` array.
- **Length Boundaries**: Verifies `data.length <= 20` (prevents false positives where limits break).

Requests that fail these checks are automatically counted against the `http_req_failed` metric, which triggers an overall failure if it exceeds 1%.
