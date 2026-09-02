import dotenv from "dotenv";

dotenv.config();

async function runDiagnostic() {
  const email = process.env.TEST_USER_EMAIL || "krushnachavan2682005@gmail.com";
  const password = process.env.TEST_USER_PASSWORD || "Krushna@123";
  const orgId = "00000000-0000-0000-0000-000000000000";
  const baseUrl = "http://localhost:3000/eduforge/api";

  console.log("--- Login ---");
  let token = "";
  try {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const body = await res.json();
    token = body?.data?.access_token;
    console.log("Login HTTP Status:", res.status);
    console.log("Token Present:", !!token);
  } catch (err: any) {
    console.error("Login Error:", err.message);
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "x-organization-id": orgId,
  };

  console.log("\n--- Testing GET /enrollments ---");
  try {
    const res = await fetch(`${baseUrl}/enrollments?limit=20`, { headers });
    console.log("HTTP Status:", res.status);
    const body = await res.text();
    console.log("Response Body:", body.substring(0, 200));
  } catch (err: any) {
    console.error("GET /enrollments Error:", err.message);
  }

  console.log("\n--- Testing GET /students/enrollments ---");
  try {
    const res = await fetch(`${baseUrl}/students/enrollments?limit=20`, { headers });
    console.log("HTTP Status:", res.status);
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      console.log("Response Body Structure:", Object.keys(data));
      console.log("Response Data Length:", Array.isArray(data?.data) ? data.data.length : "Not an array");
      console.log("Pagination:", JSON.stringify(data?.meta?.pagination, null, 2) || JSON.stringify(data?.meta, null, 2));
    } catch (e) {
      console.log("Failed to parse JSON. Raw body:", text.substring(0, 200));
    }
  } catch (err: any) {
    console.error("GET /students/enrollments Error:", err.message);
  }
}

runDiagnostic();
