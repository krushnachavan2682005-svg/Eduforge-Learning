export const ENV = {
  BASE_URL: __ENV.BASE_URL || "http://localhost:3000",
  K6_AUTH_TOKEN: __ENV.K6_AUTH_TOKEN || null,
  TEST_USER_EMAIL: __ENV.TEST_USER_EMAIL || "test@example.com",
  TEST_USER_PASSWORD: __ENV.TEST_USER_PASSWORD || "password",
};
