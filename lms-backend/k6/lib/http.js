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

export function logError(res, moduleName, method, url) {
  if (res.status >= 400) {
    console.error(`[K6 ERROR]`);
    console.error(`Module: ${moduleName}`);
    console.error(`Method: ${method}`);
    console.error(`URL: ${url}`);
    console.error(`Status: ${res.status}`);
    console.error(`Body: ${res.body}`);
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

  logError(res, moduleName, method, url);
  return res;
}
