const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgres://postgres:krushna123@localhost:5432/eduforge_learning', { logging: false });
async function run() {
  try {
    const [tables] = await sequelize.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', tables.map(t => t.table_name).join(', '));
  } catch(e) { console.error(e.message); }
  process.exit(0);
}
run();
