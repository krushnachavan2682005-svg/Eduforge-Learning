import { ENV } from '../config/environments.js';

export function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (ENV.AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${ENV.AUTH_TOKEN}`;
  }

  if (ENV.ORGANIZATION_ID) {
    headers['x-organization-id'] = ENV.ORGANIZATION_ID;
  }

  return headers;
}
