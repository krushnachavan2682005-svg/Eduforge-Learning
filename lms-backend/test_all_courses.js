const http = require('http');

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

async function run() {
  console.log("1. LOGIN");
  
  const krushnaRes = await request('POST', '/auth/login', { email: 'krushnachavan2682005@gmail.com', password: 'Krushna@123' });
  const kToken = krushnaRes.body?.data?.access_token;
  
  if (!kToken) {
    console.error("Login failed!");
    return;
  }
  
  console.log("2. GET /eduforge/api/all-courses?parsed_skipped_lesson=true");
  const getCoursesRes = await request('GET', '/eduforge/api/all-courses?parsed_skipped_lesson=true', null, kToken);
  console.log("Status:", getCoursesRes.status);
  console.log("Response Keys:", Object.keys(getCoursesRes.body));
  if (getCoursesRes.status !== 200) {
    console.log("Error Body:", getCoursesRes.body);
  }
}

run().catch(console.error);
