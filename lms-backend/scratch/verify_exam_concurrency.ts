import assert from "node:assert";
import {
  ExamService,
  examLoaderDevCounter,
  examCacheMetrics,
  examSingleFlight,
} from "../src/modules/exam/exam.service";
import { redis } from "../src/config/redis_client";

/**
 * Concurrency & Failure Integration Test Suite for ExamService.getExams
 *
 * Scenarios:
 * 1. 200 concurrent requests on cold cache invoke DB repository loader exactly once; warm cache hit works.
 * 2. Creator branch with 50 concurrent requests coalesces to exactly 1 creator DB loader call.
 * 3. Repository rejection: all concurrent callers reject, Map size returns to 0, subsequent request recovers.
 * 4. Exam-cache Redis GET failure: error recorded, repository loader invoked & result returned.
 * 5. Redis SET failure: error recorded, fetched repository result still returned.
 * 6. Stale-cache regression: Version GET failure never serves stale v0 cache, bypasses Redis GET/SET, coalesces DB load.
 * 7. Uninitialized version (version GET returns null) correctly follows intended v0 cache read/write flow.
 */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runExamConcurrencyTest() {
  console.log("===============================================================");
  console.log("Starting ExamService Concurrency & Failure Integration Suite");
  console.log("===============================================================\n");

  const service = new ExamService();

  const mockExamList = [
    { id: "exam-uuid-1", title: "Physics Midterm", organization_id: "org-test-123" },
    { id: "exam-uuid-2", title: "Chemistry Final", organization_id: "org-test-123" },
  ];

  // In-memory fake Redis storage
  const fakeRedisStore = new Map<string, string>();
  let redisGetCalls = 0;
  let redisSetCalls = 0;

  // Custom hooks for failure injection
  let hookRedisGet: ((k: string) => Promise<string | null>) | null = null;
  let hookRedisSet: ((k: string, v: string, opts?: any) => Promise<string>) | null = null;
  let hookDbAllExams: ((orgId: string, limit: number, skip: number, cursor?: string) => Promise<any>) | null = null;
  let hookDbCreatorExams: ((orgId: string, userId: string, limit: number, skip: number, cursor?: string) => Promise<any>) | null = null;

  // Intercept redis methods
  (redis as any).get = async (k: string) => {
    redisGetCalls++;
    if (hookRedisGet) return hookRedisGet(k);
    if (k.includes(":version")) {
      return fakeRedisStore.get(k) || "1";
    }
    return fakeRedisStore.get(k) || null;
  };

  (redis as any).set = async (k: string, v: string, opts?: any) => {
    redisSetCalls++;
    if (hookRedisSet) return hookRedisSet(k, v, opts);
    fakeRedisStore.set(k, v);
    return "OK";
  };

  // Mock repository methods
  let dbAllExamsInvocations = 0;
  (service as any).repository.getAllExams = async (
    orgId: string,
    limit: number,
    skip: number,
    cursor?: string
  ) => {
    dbAllExamsInvocations++;
    if (hookDbAllExams) return hookDbAllExams(orgId, limit, skip, cursor);
    await sleep(60); // Realistic DB query delay
    return mockExamList;
  };

  let dbCreatorExamsInvocations = 0;
  (service as any).repository.getExamsByCreator = async (
    orgId: string,
    userId: string,
    limit: number,
    skip: number,
    cursor?: string
  ) => {
    dbCreatorExamsInvocations++;
    if (hookDbCreatorExams) return hookDbCreatorExams(orgId, userId, limit, skip, cursor);
    await sleep(60);
    return mockExamList;
  };

  const resetState = () => {
    fakeRedisStore.clear();
    redisGetCalls = 0;
    redisSetCalls = 0;
    dbAllExamsInvocations = 0;
    dbCreatorExamsInvocations = 0;
    hookRedisGet = null;
    hookRedisSet = null;
    hookDbAllExams = null;
    hookDbCreatorExams = null;
    examLoaderDevCounter.reset();
    examSingleFlight.reset();
    examCacheMetrics.hits = 0;
    examCacheMetrics.misses = 0;
    examCacheMetrics.errors = 0;
  };

  // -------------------------------------------------------------------------
  // Scenario 1: 200 concurrent requests on cold cache (Success path)
  // -------------------------------------------------------------------------
  console.log("Scenario 1: 200 concurrent calls on cold cache...");
  resetState();
  {
    const CONCURRENT_REQUESTS = 200;
    const orgId = "org-concurrency-test";
    const page = 1;
    const limit = 10;

    const promises = Array.from({ length: CONCURRENT_REQUESTS }, () =>
      service.getExams(orgId, page, limit, undefined, undefined)
    );

    // Allow version resolution microtask to complete and single flight to start
    await sleep(10);
    assert.strictEqual(
      examSingleFlight.size,
      1,
      "SingleFlight map size must be 1 while flight is in progress"
    );

    const results = await Promise.all(promises);

    assert.strictEqual(results.length, CONCURRENT_REQUESTS);
    for (let i = 0; i < results.length; i++) {
      assert.deepStrictEqual(results[i], mockExamList, `Caller ${i} received expected exam list`);
    }

    assert.strictEqual(
      dbAllExamsInvocations,
      1,
      `DB repository should be invoked exactly once, got: ${dbAllExamsInvocations}`
    );
    assert.strictEqual(
      examLoaderDevCounter.get(),
      1,
      `examLoaderDevCounter should be 1, got: ${examLoaderDevCounter.get()}`
    );
    assert.strictEqual(
      examSingleFlight.flights_started,
      1,
      `flights_started must be 1, got: ${examSingleFlight.flights_started}`
    );
    assert.strictEqual(
      examSingleFlight.flights_joined,
      199,
      `flights_joined must be 199, got: ${examSingleFlight.flights_joined}`
    );
    assert.strictEqual(
      examSingleFlight.flights_failed,
      0,
      `flights_failed must be 0, got: ${examSingleFlight.flights_failed}`
    );
    assert.strictEqual(
      examCacheMetrics.misses,
      1,
      `Cache misses should be 1, got: ${examCacheMetrics.misses}`
    );
    assert.strictEqual(
      examCacheMetrics.hits,
      0,
      `Cache hits should be 0, got: ${examCacheMetrics.hits}`
    );
    assert.strictEqual(
      examSingleFlight.size,
      0,
      `Map size must return to 0, got: ${examSingleFlight.size}`
    );
    assert.strictEqual(
      redisSetCalls,
      1,
      `Redis SET should be called once, got: ${redisSetCalls}`
    );

    // Warm cache check
    const warmResult = await service.getExams(orgId, page, limit, undefined, undefined);
    assert.deepStrictEqual(warmResult, mockExamList);
    assert.strictEqual(examCacheMetrics.hits, 1, "Cache hit recorded");
    assert.strictEqual(examLoaderDevCounter.get(), 1, "DB counter unchanged on cache hit");
    console.log("  [PASS] Scenario 1 (200 concurrent callers & warm cache) passed.");
  }

  // -------------------------------------------------------------------------
  // Scenario 2: Creator branch with 50 concurrent requests
  // -------------------------------------------------------------------------
  console.log("\nScenario 2: Creator branch with 50 concurrent requests...");
  resetState();
  {
    const orgId = "org-creator-test";
    const page = 1;
    const limit = 10;
    const userId = "user-creator-123";

    const creatorPromises = Array.from({ length: 50 }, () =>
      service.getExams(orgId, page, limit, undefined, userId)
    );

    const creatorResults = await Promise.all(creatorPromises);
    assert.strictEqual(creatorResults.length, 50);
    assert.strictEqual(
      dbCreatorExamsInvocations,
      1,
      `Creator repository invoked once for 50 concurrent calls, got: ${dbCreatorExamsInvocations}`
    );
    assert.strictEqual(
      examLoaderDevCounter.get(),
      1,
      `examLoaderDevCounter should be 1, got: ${examLoaderDevCounter.get()}`
    );
    assert.strictEqual(
      examSingleFlight.flights_started,
      1,
      "Single flight started for creator"
    );
    assert.strictEqual(
      examSingleFlight.flights_joined,
      49,
      "49 callers joined creator flight"
    );
    assert.strictEqual(
      examSingleFlight.size,
      0,
      "Map size returned to 0 after creator flight"
    );
    console.log("  [PASS] Scenario 2 (Creator branch coalescing) passed.");
  }

  // -------------------------------------------------------------------------
  // Scenario 3: Repository rejection across concurrent callers & recovery
  // -------------------------------------------------------------------------
  console.log("\nScenario 3: Repository rejection across concurrent callers & recovery...");
  resetState();
  {
    const orgId = "org-fail-test";
    const page = 1;
    const limit = 10;

    // Simulate DB query failure
    hookDbAllExams = async () => {
      await sleep(30);
      throw new Error("PostgreSQL query connection terminated unexpectedly");
    };

    const CONCURRENT_FAILING = 15;
    const outcomes = await Promise.allSettled(
      Array.from({ length: CONCURRENT_FAILING }, () =>
        service.getExams(orgId, page, limit, undefined, undefined)
      )
    );

    assert.strictEqual(outcomes.length, CONCURRENT_FAILING);
    for (let i = 0; i < outcomes.length; i++) {
      const outcome = outcomes[i];
      assert.strictEqual(outcome.status, "rejected", `Caller ${i} must reject`);
      if (outcome.status === "rejected") {
        assert.strictEqual(
          (outcome.reason as Error).message,
          "PostgreSQL query connection terminated unexpectedly"
        );
      }
    }

    assert.strictEqual(
      dbAllExamsInvocations,
      1,
      "Failing DB query invoked only once for all joined callers"
    );
    assert.strictEqual(
      examSingleFlight.size,
      0,
      "SingleFlight Map size must be 0 after repository rejection"
    );
    assert.strictEqual(
      examSingleFlight.flights_failed,
      1,
      "flights_failed must be incremented"
    );

    // Restore repository to healthy state and verify fresh flight starts
    hookDbAllExams = null;
    const recoveredResult = await service.getExams(orgId, page, limit, undefined, undefined);
    assert.deepStrictEqual(recoveredResult, mockExamList, "Subsequent request recovered");
    assert.strictEqual(
      dbAllExamsInvocations,
      2,
      "Repository invoked again for fresh flight after previous failure"
    );
    assert.strictEqual(
      examSingleFlight.flights_started,
      2,
      "flights_started incremented to 2"
    );
    assert.strictEqual(examSingleFlight.size, 0, "Map size 0 after recovery");
    console.log("  [PASS] Scenario 3 (Repository rejection and recovery) passed.");
  }

  // -------------------------------------------------------------------------
  // Scenario 4: Exam-cache Redis GET failure (Graceful degradation)
  // -------------------------------------------------------------------------
  console.log("\nScenario 4: Exam-cache Redis GET failure degrades gracefully to DB...");
  resetState();
  {
    const orgId = "org-redis-get-fail";
    const page = 1;
    const limit = 10;

    // Version key succeeds (v1), but exam cache GET inside single-flight throws
    hookRedisGet = async (k: string) => {
      if (k.includes(":version")) {
        return "1";
      }
      throw new Error("Redis cluster node unreachable during GET");
    };

    const initialErrors = examCacheMetrics.errors;
    const result = await service.getExams(orgId, page, limit, undefined, undefined);

    assert.deepStrictEqual(result, mockExamList, "Returned repository result despite Redis GET error");
    assert.strictEqual(
      dbAllExamsInvocations,
      1,
      "Repository loader was called after Redis GET failed"
    );
    assert.strictEqual(
      examCacheMetrics.errors,
      initialErrors + 1,
      "examCacheMetrics.errors incremented for Redis GET failure"
    );
    assert.strictEqual(
      examSingleFlight.size,
      0,
      "Map size 0 after degraded completion"
    );
    console.log("  [PASS] Scenario 4 (Exam-cache Redis GET failure degradation) passed.");
  }

  // -------------------------------------------------------------------------
  // Scenario 5: Redis SET failure still returns repository result
  // -------------------------------------------------------------------------
  console.log("\nScenario 5: Redis SET failure still returns repository result...");
  resetState();
  {
    const orgId = "org-redis-set-fail";
    const page = 1;
    const limit = 10;

    // Simulate Redis SET write failure (e.g. OOM or READONLY replica)
    hookRedisSet = async () => {
      throw new Error("OOM command not allowed when used memory > 'maxmemory'");
    };

    const initialErrors = examCacheMetrics.errors;
    const result = await service.getExams(orgId, page, limit, undefined, undefined);

    assert.deepStrictEqual(
      result,
      mockExamList,
      "Repository result successfully returned despite Redis SET error"
    );
    assert.strictEqual(
      dbAllExamsInvocations,
      1,
      "Repository was invoked to fetch data"
    );
    assert.strictEqual(
      examCacheMetrics.errors,
      initialErrors + 1,
      "examCacheMetrics.errors incremented for Redis SET failure"
    );
    assert.strictEqual(
      examSingleFlight.size,
      0,
      "Map size 0 after flight completes"
    );
    console.log("  [PASS] Scenario 5 (Redis SET failure handling) passed.");
  }

  // -------------------------------------------------------------------------
  // Scenario 6: Version Redis GET failure prevents stale v0 cache hit & bypasses cache
  // -------------------------------------------------------------------------
  console.log("\nScenario 6: Version GET failure regression test (prevents stale v0 read & bypasses cache)...");
  resetState();
  {
    const orgId = "org-version-fail-regression";
    const page = 1;
    const limit = 10;
    const staleV0Key = `org:${orgId}:v0:exams:${page}:${limit}:NO_CURSOR:NO_USER`;

    // 1. Pre-seed fake Redis store with a stale v0 payload
    const staleExamPayload = [{ id: "stale-v0-exam", title: "Outdated V0 Exam Data" }];
    fakeRedisStore.set(staleV0Key, JSON.stringify(staleExamPayload));

    let examCacheGetAttempts = 0;
    let examCacheSetAttempts = 0;

    // 2. Make version GET throw, and track any attempts to GET or SET exam cache keys
    hookRedisGet = async (k: string) => {
      if (k.includes(":version")) {
        throw new Error("Simulated Redis network timeout during version lookup");
      }
      if (k.includes(":exams:")) {
        examCacheGetAttempts++;
      }
      return fakeRedisStore.get(k) || null;
    };

    hookRedisSet = async (k: string, v: string, opts?: any) => {
      if (k.includes(":exams:")) {
        examCacheSetAttempts++;
      }
      fakeRedisStore.set(k, v);
      return "OK";
    };

    const CONCURRENT_DEGRADED = 20;
    const initialErrors = examCacheMetrics.errors;

    // 3. Dispatch concurrent requests
    const promises = Array.from({ length: CONCURRENT_DEGRADED }, () =>
      service.getExams(orgId, page, limit, undefined, undefined)
    );

    const results = await Promise.all(promises);

    // 4. Verify all callers received fresh repository result, NEVER stale v0 payload
    assert.strictEqual(results.length, CONCURRENT_DEGRADED);
    for (let i = 0; i < results.length; i++) {
      assert.deepStrictEqual(
        results[i],
        mockExamList,
        `Caller ${i} must receive fresh DB exam list, not stale v0`
      );
      assert.notDeepStrictEqual(
        results[i],
        staleExamPayload,
        `Caller ${i} must NOT receive stale v0 payload`
      );
    }

    // 5. Verify database loader ran exactly once for concurrent requests
    assert.strictEqual(
      dbAllExamsInvocations,
      1,
      "Repository database loader must be invoked exactly once for concurrent degraded requests"
    );
    assert.strictEqual(
      examSingleFlight.flights_started,
      1,
      "Single flight started for degraded requests"
    );
    assert.strictEqual(
      examSingleFlight.flights_joined,
      CONCURRENT_DEGRADED - 1,
      `${CONCURRENT_DEGRADED - 1} callers joined the degraded single flight`
    );

    // 6. Verify NO exam-cache GET or SET occurred during degraded path
    assert.strictEqual(
      examCacheGetAttempts,
      0,
      `No exam-cache Redis GET calls should occur during degraded mode (got: ${examCacheGetAttempts})`
    );
    assert.strictEqual(
      examCacheSetAttempts,
      0,
      `No exam-cache Redis SET calls should occur during degraded mode (got: ${examCacheSetAttempts})`
    );

    // 7. Verify error metrics incremented
    assert.strictEqual(
      examCacheMetrics.errors,
      initialErrors + CONCURRENT_DEGRADED,
      "examCacheMetrics.errors incremented for version GET failures"
    );

    // 8. Verify map size is 0
    assert.strictEqual(
      examSingleFlight.size,
      0,
      "Map size must be 0 after degraded flights resolve"
    );
    console.log("  [PASS] Scenario 6 (Version GET failure regression test) passed.");
  }

  // -------------------------------------------------------------------------
  // Scenario 7: Uninitialized version (returns null) uses intended v0 cache read/write flow
  // -------------------------------------------------------------------------
  console.log("\nScenario 7: Uninitialized version (returns null) uses intended v0 cache read/write flow...");
  resetState();
  {
    const orgId = "org-uninitialized-version";
    const page = 1;
    const limit = 10;
    const v0Key = `org:${orgId}:v0:exams:${page}:${limit}:NO_CURSOR:NO_USER`;

    let observedFlightKey = "";
    const originalDo = examSingleFlight.do.bind(examSingleFlight);
    (examSingleFlight as any).do = (key: string, loader: any, opts: any) => {
      observedFlightKey = key;
      return originalDo(key, loader, opts);
    };

    // Version key returns null (uninitialized version), cache is cold initially
    hookRedisGet = async (k: string) => {
      if (k.includes(":version")) {
        return null; // Key does not exist in Redis yet
      }
      return fakeRedisStore.get(k) || null;
    };

    // First request: cold cache with version null -> uses v0, calls DB, writes to v0 cache
    const initialErrors = examCacheMetrics.errors;
    const result1 = await service.getExams(orgId, page, limit, undefined, undefined);

    assert.deepStrictEqual(result1, mockExamList);
    assert.strictEqual(observedFlightKey, v0Key, "Must use v0 key for uninitialized version");
    assert.strictEqual(examCacheMetrics.errors, initialErrors, "No cache errors when version is null");
    assert.strictEqual(dbAllExamsInvocations, 1, "DB invoked for cold v0 request");
    assert.strictEqual(redisSetCalls, 1, "Redis SET invoked to cache under v0");
    assert.strictEqual(fakeRedisStore.has(v0Key), true, "fakeRedisStore now has v0 cache populated");

    // Second request: warm cache with version null -> hits v0 cache in Redis!
    const result2 = await service.getExams(orgId, page, limit, undefined, undefined);
    assert.deepStrictEqual(result2, mockExamList);
    assert.strictEqual(dbAllExamsInvocations, 1, "DB not invoked on v0 cache hit");
    assert.strictEqual(examCacheMetrics.hits, 1, "Cache hit recorded for v0 key");

    // Restore singleFlight.do
    (examSingleFlight as any).do = originalDo;
    console.log("  [PASS] Scenario 7 (Uninitialized version v0 caching) passed.");
  }

  console.log("\n===============================================================");
  console.log("All Concurrency, Failure, and Regression Scenarios PASSED!");
  console.log("===============================================================");
}

runExamConcurrencyTest().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
