import http from "k6/http";

export function getHeaders(token = null) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export function logError(res, moduleName, method, url, params) {
  if (res.status >= 400) {
    const hasToken = params && params.headers && params.headers["Authorization"];
    const authHeaderPresent = !!hasToken;
    const shortBody = String(res.body).substring(0, 100);
    
    console.info(`Endpoint: ${moduleName}`);
    console.info(`Method: ${method}`);
    console.info(`URL: ${url}`);
    console.info(`Status: ${res.status}`);
    console.info(`Body: ${shortBody}`);
    console.info(`Token present: ${authHeaderPresent}`);
    console.info(`Authorization header present: ${authHeaderPresent}`);
  }
}

export function request(method, url, body, params, moduleName) {
  let res;
  if (method === "GET") {
    res = http.get(url, params);
  } else if (method === "POST") {
    res = http.post(url, body, params);
  } else if (method === "PUT") {
    res = http.put(url, body, params);
  } else if (method === "PATCH") {
    res = http.patch(url, body, params);
  } else if (method === "DELETE") {
    res = http.del(url, body, params);
  } else {
    throw new Error(`Unsupported method ${method}`);
  }

  logError(res, moduleName, method, url, params);
  return res;
}
