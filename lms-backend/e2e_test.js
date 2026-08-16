const http = require('http');
const { Client } = require('pg');

async function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function decodeJwt(token) {
  if (!token) return null;
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  } catch (e) {
    return null;
  }
}

async function checkDb(email, courseTitle) {
  const client = new Client({
    user: 'postgres',
    password: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'baap_lms_dev'
  });
  await client.connect();
  
  const memberRes = await client.query(`
    SELECT ou.organization_id 
    FROM users u 
    JOIN organization_users ou ON u.id = ou.user_id 
    WHERE u.email = $1
  `, [email]);
  const courseRes = await client.query(`SELECT title, organization_id FROM courses WHERE title = $1`, [courseTitle]);
  
  await client.end();
  
  return {
    memberOrgId: memberRes.rows[0]?.organization_id,
    courseOrgId: courseRes.rows[0]?.organization_id
  };
}

async function run() {
  console.log("==========================================");
  console.log("1. LOGIN");
  
  const govindaRes = await request('POST', '/auth/login', { email: 'govinda@gmail.com', password: 'Krushna@123' });
  const krushnaRes = await request('POST', '/auth/login', { email: 'krushnachavan2682005@gmail.com', password: 'Krushna@123' });
  
  const gToken = govindaRes.body?.data?.access_token;
  const kToken = krushnaRes.body?.data?.access_token;
  
  if (!gToken || !kToken) {
    console.error("Login failed for one or both users!");
    return;
  }
  
  const gDecoded = decodeJwt(gToken);
  const kDecoded = decodeJwt(kToken);
  console.log(`Govinda orgId: ${gDecoded.organization_id}`);
  console.log(`Krushna orgId: ${kDecoded.organization_id}`);
  
  console.log("\n==========================================");
  console.log("2. PERMISSIONS");
  const gPerms = await request('GET', '/auth/permissions', null, gToken);
  console.log("Govinda Permissions fetched successfully:", gPerms.status === 200);

  const testEmail = `test-member-${Date.now()}@example.com`;
  const testCourse = `Tenant Test Course ${Date.now()}`;

  console.log("\n==========================================");
  console.log("3. CREATE MEMBER (GOVINDA)");
  const memberPayload = {
    first_name: "Test",
    last_name: "Member",
    email: testEmail,
    role: "student",
    password: "Test@123456",
    confirm_password: "Test@123456"
  };
  const mRes = await request('POST', '/members', memberPayload, gToken);
  console.log("Create Member Status:", mRes.status);
  
  console.log("\n==========================================");
  console.log("4. CREATE COURSE (GOVINDA)");
  const cPayload = {
    title: testCourse,
    description: "Temporary tenant isolation test",
    language: "English",
    level: "BEGINNER"
  };
  const cRes = await request('POST', '/eduforge/api/course', cPayload, gToken);
  const courseId = cRes.body?.data?.id;
  console.log("Create Course Status:", cRes.status);
  
  console.log("\n==========================================");
  console.log("5. DB VERIFICATION");
  const dbResult = await checkDb(testEmail, testCourse);
  console.log(`DB Member orgId: ${dbResult.memberOrgId} (Matches Govinda: ${dbResult.memberOrgId === gDecoded.organization_id})`);
  console.log(`DB Course orgId: ${dbResult.courseOrgId} (Matches Govinda: ${dbResult.courseOrgId === gDecoded.organization_id})`);

  console.log("\n==========================================");
  console.log("6. CROSS-TENANT ISOLATION");
  if (courseId) {
    const kFetchCourse = await request('GET', `/eduforge/api/course/${courseId}`, null, kToken);
    console.log("Krushna fetching Govinda's course status:", kFetchCourse.status);
    console.log("Is isolated (should be 500 or 404/403)?", kFetchCourse.status !== 200);
  }
}

run().catch(console.error);
