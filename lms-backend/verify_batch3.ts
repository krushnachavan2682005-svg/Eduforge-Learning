import { sequelize } from "./src/config/database";
import { paginate } from "./src/utils/pagination";
import { Quiz } from "./src/modules/quizze/quizze.model";
import { Course } from "./src/modules/course/course.model";

const ORG_ID = "00000000-0000-0000-0000-000000000000";

async function run() {
  const logs: string[] = [];
  sequelize.options.logging = (sql: string) => logs.push(sql);

  async function testQuery(name: string, promise: Promise<any>) {
    console.log(`\n--- Testing ${name} ---`);
    logs.length = 0;
    try { await promise; } catch (e: any) { console.log(`Expected Error: ${e.message}`); }
    console.log(`SQL Captured:\n${logs.join('\n')}`);
  }

  // 1. Quizzes First Page (cursor="")
  await testQuery("Quizzes First Page (cursor='')", paginate(Quiz, {
    page: 1, limit: 10, filters: { organization_id: ORG_ID },
    cursor: "", cursorFields: ["created_at", "id"],
    order: [["created_at", "DESC"], ["id", "DESC"]]
  }));
}

run();
