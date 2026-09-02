const { sequelize } = require('./src/config/database');
async function run() {
  try {
    const q = "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname";
    const [indexes] = await sequelize.query(q);
    console.log('INDEXES IN DB:');
    for (const idx of indexes) {
      if (idx.indexname.startsWith('idx_')) {
        console.log(`- ${idx.indexname}: ${idx.indexdef}`);
      }
    }
  } catch(e) { console.error(e.message); }
  process.exit(0);
}
run();
