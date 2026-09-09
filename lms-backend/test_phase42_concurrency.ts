import { sequelize, connectDB } from "./src/config/database";
import { AiDocumentRepository } from "./src/modules/ai-documents/ai-document.repository";
import { AiDocument } from "./src/modules/ai-documents/ai-document.model";
import { randomUUID } from "crypto";

async function runTests() {
  await connectDB();
  
  // Apply schema changes for test environment
  try {
    await sequelize.query(`
      ALTER TABLE ai_documents
      ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS current_processing_job_id UUID;
    `);
  } catch (e) {
    console.log("Migration failed or already applied", e);
  }

  const repo = new AiDocumentRepository();
  
  // Organization and Student ID for testing
  const organization_id = "3c3e8785-5b8e-4a64-9669-e31b6df00d4d"; // Need valid UUIDs that don't violate constraints
  // But wait, the repository methods just generate queries. We need a real org/student to satisfy foreign keys if we insert.
  // Actually, let's just bypass constraints for the test or insert dummies.
  // Or just mock Sequelize?
  // Let's use the actual DB if we can, but we need an existing org and student.
  // It's better to fetch one existing organization and student.
  const [orgs]: any = await sequelize.query("SELECT id FROM organizations LIMIT 1");
  const [students]: any = await sequelize.query("SELECT id FROM students LIMIT 1");
  const [users]: any = await sequelize.query("SELECT id FROM users LIMIT 1");

  if (!orgs.length || !students.length || !users.length) {
    console.error("Missing mock data (orgs/students/users) to run tests.");
    process.exit(1);
  }

  const orgId = orgs[0].id;
  const studentId = students[0].id;
  const userId = users[0].id;

  // Create a document
  const doc = await repo.createDocument({
    organization_id: orgId,
    student_id: studentId,
    owner_user_id: userId,
    file_name: "test.pdf",
    storage_bucket: "test-bucket",
    storage_key: "test-key",
    mime_type: "application/pdf",
    file_size_bytes: 1000
  });

  const staleThreshold = new Date(Date.now() - 300000); // 5 minutes ago

  console.log("=== CASE A: TWO INITIAL PROCESSING REQUESTS (UPLOADED) ===");
  const jobIdA1 = randomUUID();
  const jobIdA2 = randomUUID();

  const [resA1, resA2] = await Promise.all([
    repo.acquireProcessingLease(doc.id, orgId, studentId, jobIdA1, staleThreshold),
    repo.acquireProcessingLease(doc.id, orgId, studentId, jobIdA2, staleThreshold)
  ]);

  console.log(`Request 1 affected: ${resA1}`);
  console.log(`Request 2 affected: ${resA2}`);
  if ((resA1 === 1 && resA2 === 0) || (resA1 === 0 && resA2 === 1)) {
    console.log("PASS: Only one lease acquired.");
  } else {
    console.log("FAIL: Concurrency protection failed.");
  }

  console.log("\n=== CASE B: TWO RETRIES FROM FAILED ===");
  // Force state to FAILED
  await AiDocument.update({ processing_status: "FAILED", processing_started_at: null, current_processing_job_id: null }, { where: { id: doc.id } });
  
  const jobIdB1 = randomUUID();
  const jobIdB2 = randomUUID();

  const [resB1, resB2] = await Promise.all([
    repo.acquireProcessingLease(doc.id, orgId, studentId, jobIdB1, staleThreshold),
    repo.acquireProcessingLease(doc.id, orgId, studentId, jobIdB2, staleThreshold)
  ]);

  console.log(`Request 1 affected: ${resB1}`);
  console.log(`Request 2 affected: ${resB2}`);
  if ((resB1 === 1 && resB2 === 0) || (resB1 === 0 && resB2 === 1)) {
    console.log("PASS: Only one lease acquired from FAILED.");
  } else {
    console.log("FAIL: Concurrency protection failed on FAILED state.");
  }

  console.log("\n=== CASE C: TWO STALE RECOVERIES ===");
  // Force state to stale PROCESSING
  await AiDocument.update({ 
    processing_status: "PROCESSING", 
    processing_started_at: new Date(Date.now() - 600000), // 10 minutes ago
    current_processing_job_id: randomUUID() 
  }, { where: { id: doc.id } });
  
  const jobIdC1 = randomUUID();
  const jobIdC2 = randomUUID();

  const [resC1, resC2] = await Promise.all([
    repo.acquireProcessingLease(doc.id, orgId, studentId, jobIdC1, staleThreshold),
    repo.acquireProcessingLease(doc.id, orgId, studentId, jobIdC2, staleThreshold)
  ]);

  console.log(`Request 1 affected: ${resC1}`);
  console.log(`Request 2 affected: ${resC2}`);
  if ((resC1 === 1 && resC2 === 0) || (resC1 === 0 && resC2 === 1)) {
    console.log("PASS: Only one lease acquired during stale recovery.");
  } else {
    console.log("FAIL: Concurrency protection failed during stale recovery.");
  }

  console.log("\n=== CASE D: ACTIVE PROCESSING RETRY ===");
  // Force state to active PROCESSING
  await AiDocument.update({ 
    processing_status: "PROCESSING", 
    processing_started_at: new Date(), // Just now
    current_processing_job_id: randomUUID() 
  }, { where: { id: doc.id } });
  
  const jobIdD1 = randomUUID();

  const resD1 = await repo.acquireProcessingLease(doc.id, orgId, studentId, jobIdD1, staleThreshold);

  console.log(`Request affected: ${resD1}`);
  if (resD1 === 0) {
    console.log("PASS: Active processing retry correctly rejected.");
  } else {
    console.log("FAIL: Active processing allowed a new lease.");
  }

  console.log("\n=== OLD-ATTEMPT PROTECTION TEST ===");
  const attemptAJobId = randomUUID();
  const attemptBJobId = randomUUID();

  // Attempt A becomes stale, Attempt B acquires lease
  await AiDocument.update({ 
    processing_status: "PROCESSING", 
    processing_started_at: new Date(), 
    current_processing_job_id: attemptBJobId 
  }, { where: { id: doc.id } });

  // Attempt A sends late COMPLETED result
  const resOld = await repo.releaseProcessingLease(doc.id, orgId, studentId, "COMPLETED", attemptAJobId);
  console.log(`Late Attempt A update affected: ${resOld}`);

  const checkDoc = await AiDocument.findOne({ where: { id: doc.id } });
  if (resOld === 0 && checkDoc?.current_processing_job_id === attemptBJobId && checkDoc?.processing_status === "PROCESSING") {
    console.log("PASS: Old attempt update rejected and Attempt B lease untouched.");
  } else {
    console.log("FAIL: Old attempt update overwrote state.");
  }

  // Cleanup
  await AiDocument.destroy({ where: { id: doc.id } });

  process.exit(0);
}

runTests().catch(console.error);
