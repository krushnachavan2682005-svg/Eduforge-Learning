import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 1,
  iterations: 1,
};

export function setup() {
  const payload = JSON.stringify({
    first_name: "Test",
    last_name: "User",
    email: __ENV.TEST_USER_EMAIL || "test@example.com",
    password: __ENV.TEST_USER_PASSWORD || "password",
  });
  const headers = { "Content-Type": "application/json" };

  // Try register first
  const regUrl = `http://localhost:3000/auth/register`;
  http.post(regUrl, payload, { headers });

  const url = `http://localhost:3000/auth/login`;
  const res = http.post(url, payload, { headers });
  
  console.log(`LOGIN_STATUS=${res.status}`);
  console.log(`LOGIN_BODY=${res.body}`);
  const token = res.json("data.access_token");
  console.log(`TOKEN_PRESENT=${!!token}`);
  console.log(`TOKEN_LENGTH=${token ? String(token).length : 0}`);

  return { token };
}

export default function (data) {
  const url = `http://localhost:3000/eduforge/api/all-courses?limit=1&page=1`;
  
  const headers = { 
    "Content-Type": "application/json",
  };
  
  if (data.token) {
    headers["Authorization"] = `Bearer ${data.token}`;
  }
  
  console.log(`AUTH_HEADER_PRESENT=${!!headers["Authorization"]}`);

  const res = http.get(url, { headers });
  console.log(`PROTECTED_ENDPOINT_STATUS=${res.status}`);
  
  check(res, {
    "status is not 401": (r) => r.status !== 401,
  });
}
