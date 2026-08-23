import { check } from "k6";
import { request, getHeaders } from "../lib/http.js";
import { ENV } from "../config/environment.js";
import { routes } from "../config/routes.js";

export function getStudents(token) {
  const url = `${ENV.BASE_URL}${routes.students.list}`;
  const res = request("GET", url, null, { headers: getHeaders(token) }, "students");
  
  check(res, {
    "get students status is 200": (r) => r.status === 200,
  });
  
  return res.json();
}

export function getCourses(token) {
  const url = `${ENV.BASE_URL}${routes.courses.list}`;
  const res = request("GET", url, null, { headers: getHeaders(token) }, "courses");
  
  check(res, {
    "get courses status is 200": (r) => r.status === 200,
  });
  
  return res.json();
}
