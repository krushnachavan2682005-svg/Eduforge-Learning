const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgres://postgres:krushna123@localhost:5432/eduforge_learning', { logging: false });
async function run() {
  try {
    const q = `
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position;
    `;
    const [columns] = await sequelize.query(q);
    
    const schema = {};
    for (const col of columns) {
      if (!schema[col.table_name]) schema[col.table_name] = [];
      schema[col.table_name].push(col.column_name);
    }
    
    console.log(JSON.stringify(schema, null, 2));
  } catch(e) { console.error(e.message); }
  process.exit(0);
}
run();
