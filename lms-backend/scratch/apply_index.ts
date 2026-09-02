import { sequelize } from "../src/config/database";

async function applyIndex() {
  console.log("Checking DB Connection...");
  try {
    await sequelize.authenticate();
    console.log("DB Connected.");
  } catch (e: any) {
    console.error("DB Connection failed:", e.message);
    process.exit(1);
  }

  // Create the index
  try {
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_student_enrollments_cursor 
      ON student_enrollments (organization_id, enrolled_at DESC, id DESC);
    `);
    console.log("Index created successfully.");
  } catch (e: any) {
    console.log("Index creation failed:", e.message);
  }
  process.exit(0);
}

applyIndex();
