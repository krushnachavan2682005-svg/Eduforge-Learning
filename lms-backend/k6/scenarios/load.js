import { sleep } from "k6";
import { authenticate } from "../lib/auth.js";
import { getStudents, getCourses } from "../modules/endpoints.js";

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Ramp up to 10 users
    { duration: "1m", target: 50 },  // Ramp up to 50 users
    { duration: "2m", target: 50 },  // Stay at 50 users for 2 mins
    { duration: "30s", target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"], // Load test can tolerate some failures if overloaded, but aim < 5%
    http_req_duration: ["p(95)<1500"], 
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
