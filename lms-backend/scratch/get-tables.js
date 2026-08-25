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
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `);
  console.log(res.rows);
  await client.end();
}
run();
