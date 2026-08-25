const { Client } = require('pg');
async function run() {
  const client = new Client({
    user: 'postgres',
    password: 'krushna123',
    host: 'localhost',
    database: 'baap_lms_dev',
    port: 5432,
  });
  await client.connect();
  const res = await client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('users', 'organizations', 'organization_users', 'courses')
    ORDER BY table_name, ordinal_position;
  `);
  console.log(res.rows);
  await client.end();
}
run();
