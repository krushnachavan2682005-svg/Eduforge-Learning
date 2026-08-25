import { check } from 'k6';

export function is200(res) {
  const result = check(res, {
    'status is 200': (r) => r.status === 200,
  });
  if (!result) {
    const hasToken = res.request && res.request.headers && res.request.headers["Authorization"];
    console.info(`Endpoint: ${res.request ? res.request.url : 'unknown'}`);
    console.info(`Method: ${res.request ? res.request.method : 'unknown'}`);
    console.info(`Status: ${res.status}`);
    console.info(`Token present: ${!!hasToken}`);
    console.info(`Authorization header present: ${!!hasToken}`);
    console.info(`Body: ${String(res.body).substring(0, 100)}`);
  }
  return result;
}

export function is201(res) {
  return check(res, {
    'status is 201': (r) => r.status === 201,
  });
}

export function isSuccess(res) {
  return check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });
}

export function hasData(res) {
  return check(res, {
    'has data array': (r) => {
      try {
        const body = JSON.parse(r.body);
        if (Array.isArray(body)) return true;
        if (body.data && Array.isArray(body.data)) return true;
        if (body.items && Array.isArray(body.items)) return true;
        return false;
      } catch (e) {
        return false;
      }
    },
  });
}
