import assert from "assert";
import { StudentService } from "../src/modules/students/student.service";
import { Student } from "../src/modules/students/student.model";
import { LocalEnrollment } from "../src/modules/students/enrollment.model";
import { sequelize } from "../src/config/database";

async function runTests() {
  console.log("Starting cursor pagination tests...");
  const orgId = "11111111-1111-1111-1111-111111111111"; // dummy org
  const service = new StudentService();

  // Test 1: First page
  const res1 = await service.listEnrollments(orgId, { limit: 2 });
  console.log("Test 1 Result:", res1.meta || res1.pagination);

  // Test 2: Next page
  let nextCursor = res1.pagination?.next_cursor;
  if (nextCursor) {
    const res2 = await service.listEnrollments(orgId, { limit: 2, cursor: nextCursor });
    console.log("Test 2 Result:", res2.pagination);
  }

  console.log("Tests completed.");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
