const { sequelize } = require('./src/config/database');
async function run() {
  try {
    const q = "SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('organization_users', 'exam_user_mappings', 'levels')";
    const [indexes] = await sequelize.query(q);
    console.log(indexes);
  } catch(e) { console.error(e.message); }
  process.exit(0);
}
run();
