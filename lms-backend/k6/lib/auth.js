import { check } from "k6";
import { request, getHeaders } from "./http.js";
import { ENV } from "../config/environment.js";
import { routes } from "../config/routes.js";

export function authenticate() {
  if (ENV.K6_AUTH_TOKEN) {
    return ENV.K6_AUTH_TOKEN;
  }

  const payload = JSON.stringify({
    email: ENV.TEST_USER_EMAIL,
    password: ENV.TEST_USER_PASSWORD,
  });

  const url = `${ENV.BASE_URL}${routes.auth.login}`;
  const res = request("POST", url, payload, { headers: getHeaders() }, "auth");

  const loginCheck = check(res, {
    "login status is 200": (r) => r.status === 200,
    "login returns token": (r) => r.json("token") !== undefined,
  });

  if (!loginCheck) {
    console.error(`Login failed. Check TEST_USER_EMAIL and TEST_USER_PASSWORD, or provide K6_AUTH_TOKEN.`);
    return null;
  }

  return res.json("token");
}
