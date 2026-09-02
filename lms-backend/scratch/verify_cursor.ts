import { StudentService } from "../src/modules/students/student.service";
import { sequelize } from "../src/config/database";

async function verify() {
  console.log("Checking DB Connection...");
  try {
    await sequelize.authenticate();
    console.log("DB Connected.");
  } catch (e: any) {
    console.error("DB Connection failed:", e.message);
    process.exit(0); // Exit gracefully if no DB
  }

  // Check if index exists
  try {
    const [indexes] = await sequelize.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'student_enrollments' AND indexname = 'idx_student_enrollments_cursor';
    `);
    console.log("Index check:", (indexes as any).length > 0 ? "EXISTS" : "MISSING");
  } catch (e: any) {
    console.log("Index check failed:", e.message);
  }

  // Turn on logging for Sequelize to capture SQL
  (sequelize as any).options.logging = console.log;

  const service = new StudentService();
  const orgId = "00000000-0000-0000-0000-000000000000";

  console.log("\n--- OFFSET PAGINATION ---");
  await service.listEnrollments(orgId, { limit: 20, page: 1 }).catch(() => {});
  
  console.log("\n--- CURSOR PAGINATION (PAGE 1) ---");
  let res = await service.listEnrollments(orgId, { limit: 20, cursor: "" }).catch(() => {});
  
  console.log("\n--- CURSOR PAGINATION (NEXT PAGE) ---");
  const dummyCursor = Buffer.from(JSON.stringify({ enrolledAt: new Date().toISOString(), id: "dummy-uuid" })).toString("base64url");
  await service.listEnrollments(orgId, { limit: 20, cursor: dummyCursor }).catch((e) => {
    console.log("Error:", e.message);
  });

  process.exit(0);
}

verify();
