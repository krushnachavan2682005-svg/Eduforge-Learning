const { sequelize } = require('./src/config/database');
const fs = require('fs');

async function run() {
  try {
    const sql = fs.readFileSync('database/index.sql', 'utf8');
    const queries = sql.split(';').filter(q => q.trim().length > 0);
    
    for (const q of queries) {
      if (q.includes('CREATE INDEX IF NOT EXISTS')) {
        try {
          await sequelize.query(q + ';');
          console.log('Executed:', q.trim().split('\n').join(' '));
        } catch (err) {
          console.log('Skipped (table might not exist):', err.message);
        }
      }
    }
  } catch(e) { console.error(e.message); }
  process.exit(0);
}
run();
