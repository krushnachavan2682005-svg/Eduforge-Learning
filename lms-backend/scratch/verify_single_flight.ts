import assert from "node:assert";
import {
  SingleFlightGroup,
  SingleFlightTimeoutError,
} from "../src/utils/single_flight";

/**
 * SingleFlightGroup Verification Test Suite
 *
 * Requirements covered:
 * 1. 200 concurrent calls with the same key invoke the loader exactly once; all receive the result.
 * 2. Metrics report flights_started = 1 and flights_joined = 199.
 * 3. After success, Map size is 0.
 * 4. If loader rejects, all joined callers reject, Map size returns to 0, and later call starts fresh flight.
 * 5. Synchronous loader throw is handled correctly and does not leave a Map entry.
 * 6. Never-settling loader times out, rejects callers, and removes the active Map entry.
 * 7. After timeout, a new flight can start, and the old flight's cleanup cannot delete the new flight.
 * 8. Different keys create separate flights.
 * 9. Timeout does not cancel the original loader (documented limitation in test notes).
 *
 * Usage:
 *   cd lms-backend
 *   npx ts-node scratch/verify_single_flight.ts
 */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runVerificationSuite() {
  console.log("===============================================================");
  console.log("Starting SingleFlightGroup Verification Test Suite");
  console.log("===============================================================\n");

  let passedScenarios = 0;

  // -------------------------------------------------------------------------
  // Scenario 1, 2, 3: 200 concurrent calls, single invocation, metrics, map cleanup
  // -------------------------------------------------------------------------
  console.log("Running Scenario 1-3: 200 concurrent callers, deduplication, metrics & cleanup...");
  {
    const group = new SingleFlightGroup();
    let loaderExecutions = 0;
    const expectedData = { examId: "exam-concurrency-200", title: "SingleFlight Stress Test" };

    const loader = async () => {
      loaderExecutions++;
      await sleep(40);
      return expectedData;
    };

    const CONCURRENT_COUNT = 200;
    const callers = Array.from({ length: CONCURRENT_COUNT }, () =>
      group.do("exam:batch:200", loader)
    );

    // Verify Map size during flight
    assert.strictEqual(group.size, 1, "Map size must be 1 while flight is in-progress");
    assert.strictEqual(group.has("exam:batch:200"), true);

    const results = await Promise.all(callers);

    // Check loader invoked exactly once
    assert.strictEqual(loaderExecutions, 1, "Loader must be invoked exactly once for 200 concurrent callers");
    assert.strictEqual(results.length, CONCURRENT_COUNT);
    for (let i = 0; i < results.length; i++) {
      assert.deepStrictEqual(results[i], expectedData, `Caller ${i} must receive the exact expected data`);
    }

    // Check metrics
    assert.strictEqual(group.flights_started, 1, "flights_started must be exactly 1");
    assert.strictEqual(group.flights_joined, 199, "flights_joined must be exactly 199");
    assert.strictEqual(group.flights_failed, 0, "flights_failed must be 0");

    // Check Map size after completion
    assert.strictEqual(group.size, 0, "Map size must be 0 after successful completion");
    assert.strictEqual(group.getMapSize(), 0, "getMapSize() must return 0");

    passedScenarios++;
    console.log("  [PASS] Scenario 1-3 passed successfully.");
  }

  // -------------------------------------------------------------------------
  // Scenario 4: Loader rejection, all joined callers reject, map size 0, fresh flight
  // -------------------------------------------------------------------------
  console.log("\nRunning Scenario 4: Async rejection, joined rejection, cleanup & fresh flight...");
  {
    const group = new SingleFlightGroup();
    let failingLoaderExecutions = 0;
    const failingLoader = async () => {
      failingLoaderExecutions++;
      await sleep(20);
      throw new Error("Database network partition simulated");
    };

    const JOINED_COUNT = 10;
    const settledOutcomes = await Promise.allSettled(
      Array.from({ length: JOINED_COUNT }, () => group.do("failing_query_key", failingLoader))
    );

    assert.strictEqual(failingLoaderExecutions, 1, "Failing loader must be executed once for concurrent callers");
    assert.strictEqual(settledOutcomes.length, JOINED_COUNT);
    for (let i = 0; i < settledOutcomes.length; i++) {
      const outcome = settledOutcomes[i];
      assert.strictEqual(outcome.status, "rejected", `Caller ${i} must reject`);
      if (outcome.status === "rejected") {
        assert.strictEqual(
          (outcome.reason as Error).message,
          "Database network partition simulated",
          `Caller ${i} must receive the underlying rejection reason`
        );
      }
    }

    assert.strictEqual(group.size, 0, "Map size must return to 0 after rejection");
    assert.strictEqual(group.flights_started, 1, "flights_started must be 1");
    assert.strictEqual(group.flights_joined, 9, "flights_joined must be 9");
    assert.strictEqual(group.flights_failed, 1, "flights_failed must be 1");

    // Verify rejection is not cached: later call starts a fresh flight
    let freshLoaderExecutions = 0;
    const freshResult = await group.do("failing_query_key", async () => {
      freshLoaderExecutions++;
      return "fresh_recovery_data";
    });

    assert.strictEqual(freshResult, "fresh_recovery_data");
    assert.strictEqual(freshLoaderExecutions, 1, "Fresh flight loader must execute");
    assert.strictEqual(group.flights_started, 2, "flights_started should now be 2");
    assert.strictEqual(group.size, 0, "Map size should remain 0 after fresh flight finishes");

    passedScenarios++;
    console.log("  [PASS] Scenario 4 passed successfully.");
  }

  // -------------------------------------------------------------------------
  // Scenario 5: Synchronous loader throw handling & map cleanup
  // -------------------------------------------------------------------------
  console.log("\nRunning Scenario 5: Synchronous loader throw handling...");
  {
    const group = new SingleFlightGroup();
    let caughtSyncError = false;

    try {
      await group.do("sync_crash_key", () => {
        throw new Error("Immediate synchronous validation crash");
      });
    } catch (err: any) {
      caughtSyncError = true;
      assert.strictEqual(err.message, "Immediate synchronous validation crash");
    }

    assert.strictEqual(caughtSyncError, true, "Synchronous throw must be caught by caller");
    assert.strictEqual(group.size, 0, "Map size must be 0 after synchronous throw");
    assert.strictEqual(group.flights_started, 1, "flights_started must be 1");
    assert.strictEqual(group.flights_failed, 1, "flights_failed must be 1");

    // Later call can start cleanly
    const postSyncRecovery = await group.do("sync_crash_key", () => "recovered_after_sync_throw");
    assert.strictEqual(postSyncRecovery, "recovered_after_sync_throw");
    assert.strictEqual(group.flights_started, 2);
    assert.strictEqual(group.size, 0);

    passedScenarios++;
    console.log("  [PASS] Scenario 5 passed successfully.");
  }

  // -------------------------------------------------------------------------
  // Scenario 6: Never-settling loader times out, rejects callers & removes map entry
  // -------------------------------------------------------------------------
  console.log("\nRunning Scenario 6: Timeout on never-settling loader & map eviction...");
  {
    const group = new SingleFlightGroup();
    let neverSettlingLoaderInvocations = 0;

    const neverSettlingLoader = () => {
      neverSettlingLoaderInvocations++;
      return new Promise<string>(() => {
        // Intentionally never resolves or rejects
      });
    };

    const TIMEOUT_MS = 35;
    const callers = [
      group.do("stuck_resource", neverSettlingLoader, { timeoutMs: TIMEOUT_MS }),
      group.do("stuck_resource", neverSettlingLoader, { timeoutMs: TIMEOUT_MS }),
      group.do("stuck_resource", neverSettlingLoader, { timeoutMs: TIMEOUT_MS }),
    ];

    const outcomes = await Promise.allSettled(callers);
    assert.strictEqual(neverSettlingLoaderInvocations, 1, "Loader invoked once");
    assert.strictEqual(outcomes.length, 3);

    for (let i = 0; i < outcomes.length; i++) {
      const outcome = outcomes[i];
      assert.strictEqual(outcome.status, "rejected", `Caller ${i} must reject on timeout`);
      if (outcome.status === "rejected") {
        assert.ok(
          outcome.reason instanceof SingleFlightTimeoutError,
          `Caller ${i} rejection must be instance of SingleFlightTimeoutError`
        );
        assert.ok(
          outcome.reason.message.includes(`timed out after ${TIMEOUT_MS}ms`),
          `Caller ${i} message should describe timeout`
        );
      }
    }

    assert.strictEqual(group.size, 0, "Map entry must be evicted upon timeout");
    assert.strictEqual(group.flights_started, 1);
    assert.strictEqual(group.flights_joined, 2);
    assert.strictEqual(group.flights_failed, 1);

    passedScenarios++;
    console.log("  [PASS] Scenario 6 passed successfully.");
  }

  // -------------------------------------------------------------------------
  // Scenario 7: Stale-flight protection (old timed-out flight doesn't delete new flight)
  // -------------------------------------------------------------------------
  console.log("\nRunning Scenario 7: Stale-flight protection after timeout...");
  {
    const group = new SingleFlightGroup();
    let flight1Finished = false;

    // Flight 1: slow loader with short timeout
    const flight1Loader = async () => {
      await sleep(120);
      flight1Finished = true;
      return "flight1_late_result";
    };

    let flight1Error: any;
    const p1 = group.do("race_key", flight1Loader, { timeoutMs: 30 }).catch((err) => {
      flight1Error = err;
    });

    // Wait 40ms for Flight 1 to time out
    await sleep(40);
    assert.ok(flight1Error instanceof SingleFlightTimeoutError, "Flight 1 timed out as expected");
    assert.strictEqual(group.size, 0, "Map is empty after Flight 1 timeout");
    assert.strictEqual(flight1Finished, false, "Flight 1 loader is still running in background");

    // Start Flight 2 under the SAME key while Flight 1 loader is still active in background
    let flight2Invocations = 0;
    const flight2Loader = async () => {
      flight2Invocations++;
      await sleep(110); // completes at t = 40 + 110 = 150ms
      return "flight2_success_result";
    };

    const p2 = group.do("race_key", flight2Loader, { timeoutMs: 300 });
    assert.strictEqual(group.size, 1, "Flight 2 registered in Map");

    // Wait 90ms (now t = ~130ms): Flight 1 loader has now settled at 120ms
    await sleep(90);
    assert.strictEqual(flight1Finished, true, "Flight 1 loader finished in background");

    // CRITICAL: Flight 2 MUST still be present in the Map! Old flight 1 cleanup must not delete Flight 2!
    assert.strictEqual(
      group.size,
      1,
      "Flight 2 must still be in the Map; old Flight 1 cleanup must NOT delete it!"
    );
    assert.strictEqual(group.has("race_key"), true);

    const flight2Result = await p2;
    assert.strictEqual(flight2Result, "flight2_success_result");
    assert.strictEqual(flight2Invocations, 1);
    assert.strictEqual(group.size, 0, "Map cleaned up after Flight 2 resolves normally");
    assert.strictEqual(group.flights_started, 2);
    assert.strictEqual(group.flights_failed, 1); // Only Flight 1 failed

    passedScenarios++;
    console.log("  [PASS] Scenario 7 passed successfully.");
  }

  // -------------------------------------------------------------------------
  // Scenario 8: Different keys create separate flights
  // -------------------------------------------------------------------------
  console.log("\nRunning Scenario 8: Independent keys create separate flights...");
  {
    const group = new SingleFlightGroup();
    let invocationsA = 0;
    let invocationsB = 0;

    const [resA, resB] = await Promise.all([
      group.do("key:alpha", async () => {
        invocationsA++;
        await sleep(25);
        return "alpha_payload";
      }),
      group.do("key:beta", async () => {
        invocationsB++;
        await sleep(25);
        return "beta_payload";
      }),
    ]);

    assert.strictEqual(resA, "alpha_payload");
    assert.strictEqual(resB, "beta_payload");
    assert.strictEqual(invocationsA, 1);
    assert.strictEqual(invocationsB, 1);
    assert.strictEqual(group.flights_started, 2, "Two distinct flights started");
    assert.strictEqual(group.flights_joined, 0, "No joins across different keys");
    assert.strictEqual(group.size, 0, "Map size 0 after both finish");

    passedScenarios++;
    console.log("  [PASS] Scenario 8 passed successfully.");
  }

  // -------------------------------------------------------------------------
  // Scenario 9: Timeout does not cancel the original loader (documented limitation)
  // -------------------------------------------------------------------------
  console.log("\nRunning Scenario 9: Verifying timeout does not cancel original loader...");
  {
    /**
     * TEST NOTES & LIMITATION DOCUMENTATION:
     *
     * In JavaScript / Node.js, standard ES Promises and async functions are eager
     * and non-cancellable by external callers once initiated.
     *
     * When SingleFlightGroup hits a timeout:
     * 1. It evicts the flight entry from the internal Map to prevent holding the key hostage.
     * 2. It rejects all callers currently awaiting that flight with a SingleFlightTimeoutError.
     * 3. However, the underlying asynchronous loader function itself (and any pending I/O,
     *    such as a Sequelize database query or HTTP request) continues executing to completion
     *    in the Node.js event loop in the background, because JavaScript promises cannot be aborted
     *    externally without cooperative cancellation tokens (e.g. AbortController / AbortSignal).
     *
     * This test explicitly verifies that the loader continues and finishes in the background,
     * proving that callers are decoupled from the stuck execution without causing unhandled
     * promise rejections.
     */
    const group = new SingleFlightGroup();
    let loaderStarted = false;
    let loaderCompleted = false;
    let sideEffectValue = 0;

    const slowBackgroundLoader = async () => {
      loaderStarted = true;
      await sleep(80);
      sideEffectValue = 100;
      loaderCompleted = true;
      return "background_result";
    };

    let callerTimedOut = false;
    try {
      await group.do("non_cancel_test", slowBackgroundLoader, { timeoutMs: 25 });
    } catch (err: any) {
      callerTimedOut = true;
      assert.ok(err instanceof SingleFlightTimeoutError);
    }

    assert.strictEqual(callerTimedOut, true, "Caller timed out at 25ms");
    assert.strictEqual(loaderStarted, true, "Loader had started");
    assert.strictEqual(loaderCompleted, false, "Loader has not yet completed at 25ms");
    assert.strictEqual(sideEffectValue, 0);

    // Wait 70ms more (now t = ~95ms, exceeding 80ms loader duration)
    await sleep(70);

    assert.strictEqual(
      loaderCompleted,
      true,
      "Original loader continued running and completed in the background despite flight timeout"
    );
    assert.strictEqual(
      sideEffectValue,
      100,
      "Loader side-effects completed in the background"
    );

    passedScenarios++;
    console.log("  [PASS] Scenario 9 passed successfully.");
  }

  console.log("\n===============================================================");
  console.log(`Verification Summary: All ${passedScenarios} scenarios PASSED.`);
  console.log("===============================================================");
}

runVerificationSuite().catch((err) => {
  console.error("Verification suite failed:", err);
  process.exit(1);
});
