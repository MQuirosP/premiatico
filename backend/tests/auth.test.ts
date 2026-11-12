import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/premiatico_test';
process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
process.env.CORS_ORIGIN = 'http://localhost:3000';

const mockAdmin = {
  id: 'admin_1',
  name: 'Admin Premiático',
  username: 'admin.sys.root',
  email: 'admin@premiatico.com',
  passwordHash: bcrypt.hashSync('SuperSecret123!', 10),
  role: 'SUPER_ADMIN' as const,
  isActive: true,
};

vi.mock('../src/core/prisma.js', () => ({
  prisma: {
    adminUser: {
      findFirst: vi.fn(async ({ where }: { where: { OR?: Array<{ email?: string; username?: string }> } }) => {
        const matches = where.OR?.some(
          (cond) =>
            (cond.email && cond.email === mockAdmin.email) ||
            (cond.username && cond.username === mockAdmin.username),
        );
        return matches ? mockAdmin : null;
      }),
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email === mockAdmin.email || where.id === mockAdmin.id) {
          return mockAdmin;
        }
        return null;
      }),
    },
    auditLog: {
      create: vi.fn(async () => ({ id: 'audit_1' })),
    },
    $disconnect: vi.fn(async () => undefined),
  },
}));

vi.mock('../src/core/redis.js', () => ({
  REDIS_PREFIXES: {
    CACHE: 'premiatico:cache:',
    RATE: 'premiatico:rate:',
    JOBS: 'premiatico:jobs:',
  },
  buildRedisKey: (prefix: string, key: string) => `${prefix}${key}`,
  getRedisClient: () => null,
}));

import { createApp } from '../src/server/app.js';

describe('Admin Auth & Health', () => {
  const app = createApp();

  beforeAll(() => {
    expect(mockAdmin.passwordHash).toBeTruthy();
  });

  it('GET /api/v1/health returns ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.service).toBe('premiatico-api');
  });

  it('GET /api/v1/admin/auth/me rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/admin/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/admin/auth/login validates input with Zod', async () => {
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ identifier: 'ab', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/admin/auth/login rejects invalid password', async () => {
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@premiatico.com', password: 'WrongPassword123' });

    expect(res.status).toBe(401);
  });

  it('POST /api/v1/admin/auth/login sets HttpOnly cookie and allows /me', async () => {
    const loginRes = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@premiatico.com', password: 'SuperSecret123!' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.admin.email).toBe('admin@premiatico.com');

    const cookies = loginRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies?.[0]).toContain('HttpOnly');

    const meRes = await request(app)
      .get('/api/v1/admin/auth/me')
      .set('Cookie', cookies ?? []);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.admin.id).toBe('admin_1');
  });
});
