import { sleep } from "k6";
import { authenticate } from "../lib/auth.js";
import { getStudents, getCourses } from "../modules/endpoints.js";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"], // Baseline should have < 1% failures
    http_req_duration: ["p(95)<500"], // 95% of requests must complete below 500ms
  },
};

export function setup() {
  const token = authenticate();
  return { token };
}

export default function (data) {
  if (!data.token) return;

  getStudents(data.token);
  sleep(1);

  getCourses(data.token);
  sleep(1);
}
