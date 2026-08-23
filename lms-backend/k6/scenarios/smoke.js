import { sleep, check } from "k6";
import { authenticate } from "../lib/auth.js";
import { getStudents, getCourses } from "../modules/endpoints.js";

export const options = {
  vus: 1,
  duration: "10s",
  thresholds: {
    http_req_failed: ["rate==0"], // Smoke test must have 0% failures
    checks: ["rate==1.0"], // 100% of checks must pass
  },
};

export function setup() {
  const token = authenticate();
  return { token };
}

export default function (data) {
  if (!data.token) {
    console.error("No token available, aborting iteration");
    return;
  }

  // Test /students endpoint
  getStudents(data.token);
  sleep(1);

  // Test /eduforge/api/courses endpoint
  getCourses(data.token);
  sleep(1);
}
