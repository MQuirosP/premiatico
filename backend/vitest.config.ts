import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/premiatico_test',
      SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
      CORS_ORIGIN: 'http://localhost:3000',
    },
  },
});
