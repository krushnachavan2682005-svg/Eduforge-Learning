import { check } from 'k6';

export function is200(res) {
  return check(res, {
    'status is 200': (r) => r.status === 200,
  });
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
        return body.data && Array.isArray(body.data);
      } catch (e) {
        return false;
      }
    },
  });
}
