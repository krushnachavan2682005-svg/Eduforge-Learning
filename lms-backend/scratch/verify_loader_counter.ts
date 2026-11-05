import assert from "assert";
import { examLoaderDevCounter } from "../src/modules/exam/exam.service";

/**
 * Development-only verification script for examLoaderDevCounter.
 * Validates in-memory counter operations (get, increment, reset) in isolation.
 *
 * Usage:
 *   npx ts-node scratch/verify_loader_counter.ts
 */
async function testLoaderCounter() {
  console.log("Verifying examLoaderDevCounter in-memory behavior...");

  // 1. Initial state
  examLoaderDevCounter.reset();
  assert.strictEqual(examLoaderDevCounter.get(), 0, "Counter should initialize to 0");
  assert.strictEqual(examLoaderDevCounter.count, 0, "count property should be 0");

  // 2. Increment simulation
  examLoaderDevCounter.count++;
  examLoaderDevCounter.count++;
  assert.strictEqual(examLoaderDevCounter.get(), 2, "Counter should reflect increments");

  // 3. Reset
  examLoaderDevCounter.reset();
  assert.strictEqual(examLoaderDevCounter.get(), 0, "Counter reset() should return value to 0");

  console.log("examLoaderDevCounter static check passed successfully.");
  process.exit(0);
}

testLoaderCounter().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
