import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

const mockAdmin = {
  id: 'admin_1',
  name: 'Admin Premiático',
  email: 'admin@premiatico.com',
  passwordHash: bcrypt.hashSync('SuperSecret123!', 10),
  role: 'SUPER_ADMIN' as const,
  isActive: true,
};

const mockPasses: Array<Record<string, unknown>> = [];

vi.mock('../src/core/prisma.js', () => ({
  prisma: {
    adminUser: {
      findFirst: vi.fn(async () => mockAdmin),
      findUnique: vi.fn(async () => mockAdmin),
    },
    digitalPass: {
      findMany: vi.fn(async () => mockPasses),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const created = { id: `pass_${mockPasses.length + 1}`, ...data };
        mockPasses.push(created);
        return created;
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

vi.mock('../src/modules/storage/storage.service.js', () => ({
  r2KeyBuilders: {
    passFile: (passId: string, fileName: string) => `passes/${passId}/${fileName}`,
  },
  uploadObject: vi.fn(async () => undefined),
  getSignedUploadUrl: vi.fn(async () => ({ uploadUrl: 'https://r2.test/put', key: 'k' })),
  getSignedDownloadUrl: vi.fn(async () => ({ downloadUrl: 'https://r2.test/get', key: 'k' })),
}));

import { createApp } from '../src/server/app.js';

describe('Admin Digital Passes Upload', () => {
  const app = createApp();
  let authCookies: string[] = [];

  beforeEach(async () => {
    mockPasses.length = 0;
    const loginRes = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@premiatico.com', password: 'SuperSecret123!' });
    authCookies = (loginRes.headers['set-cookie'] as unknown as string[]) ?? [];
  });

  it('POST /api/v1/admin/passes/upload creates a digital pass from multipart upload', async () => {
    const res = await request(app)
      .post('/api/v1/admin/passes/upload')
      .set('Cookie', authCookies)
      .field('name', '30MM')
      .field('description', 'Gánate 30 Millonzotes!')
      .attach('file', Buffer.from('fake-jpg-bytes'), {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pass.name).toBe('30MM');
  });
});
