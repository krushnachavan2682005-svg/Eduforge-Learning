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
  try {
    await client.query(`ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id);`);
    console.log("Column organization_id added to users table.");
  } catch (err) {
    console.error(err);
  }
  await client.end();
}
run();
