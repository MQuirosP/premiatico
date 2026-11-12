import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

const mockCampaigns: Array<Record<string, unknown>> = [];
const mockParticipations = { confirmed: 0, reserved: 0 };

const mockAdmin = {
  id: 'admin_1',
  name: 'Admin Premiático',
  email: 'admin@premiatico.com',
  passwordHash: bcrypt.hashSync('SuperSecret123!', 10),
  role: 'SUPER_ADMIN' as const,
  isActive: true,
};

vi.mock('../src/core/prisma.js', () => ({
  prisma: {
    adminUser: {
      findFirst: vi.fn(async () => mockAdmin),
      findUnique: vi.fn(async () => mockAdmin),
    },
    campaign: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; slug?: string } }) => {
        return (
          mockCampaigns.find(
            (c) => (where.id && c.id === where.id) || (where.slug && c.slug === where.slug),
          ) ?? null
        );
      }),
      findMany: vi.fn(async () => mockCampaigns),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const created = {
          id: `camp_${mockCampaigns.length + 1}`,
          status: 'DRAFT',
          publishedAt: null,
          combos: [],
          prizes: [],
          ...data,
        };
        mockCampaigns.push(created);
        return created;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const found = mockCampaigns.find((c) => c.id === where.id);
        if (found) Object.assign(found, data);
        return found;
      }),
    },
    participation: {
      count: vi.fn(async ({ where }: { where: { status: string | { in: string[] } } }) => {
        if (where.status === 'CONFIRMED') return mockParticipations.confirmed;
        if (where.status === 'RESERVED') return mockParticipations.reserved;
        return mockParticipations.confirmed + mockParticipations.reserved;
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

describe('Campaigns & Legal Gate & Progress', () => {
  const app = createApp();
  let authCookies: string[] = [];

  beforeEach(async () => {
    mockCampaigns.length = 0;
    mockParticipations.confirmed = 0;
    mockParticipations.reserved = 0;

    const loginRes = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@premiatico.com', password: 'SuperSecret123!' });
    authCookies = (loginRes.headers['set-cookie'] as unknown as string[]) ?? [];
  });

  it('creates a campaign and blocks publishing without legal approval', async () => {
    const createRes = await request(app)
      .post('/api/v1/admin/campaigns')
      .set('Cookie', authCookies)
      .send({
        slug: 'promo-suv-2026',
        title: 'SUV 2026',
        description: 'Campaña promocional de prueba con vehículo del año',
        category: 'Vehículos',
        startAt: '2026-11-01T00:00:00Z',
        endAt: '2026-12-31T23:59:59Z',
        totalChances: 1000,
        requiresLegalApproval: true,
        legalApprovalStatus: 'PENDING',
        terms: 'Términos y condiciones completos de la promoción en Costa Rica.',
      });

    expect(createRes.status).toBe(201);
    const id = createRes.body.data.campaign.id as string;

    const publishRes = await request(app)
      .post(`/api/v1/admin/campaigns/${id}/publish`)
      .set('Cookie', authCookies);

    expect(publishRes.status).toBe(409);
    expect(publishRes.body.error.message).toContain('autorización legal');
  });

  it('calculates progress using only confirmed chances and caps at 100%', async () => {
    mockCampaigns.push({
      id: 'camp_active',
      slug: 'promo-casa',
      title: 'Casa en la Playa',
      description: 'Descripción válida de la campaña',
      category: 'Propiedades',
      status: 'ACTIVE',
      startAt: new Date('2026-01-01T00:00:00Z'),
      endAt: new Date('2027-01-01T00:00:00Z'),
      totalChances: 100,
      prizes: [],
      combos: [{ id: 'combo_1', name: '1 Pase', price: 4000, passQuantity: 1, chanceQuantity: 4, isActive: true }],
    });

    mockParticipations.confirmed = 69;
    mockParticipations.reserved = 20; // Must NOT count as soldPercentage

    const res = await request(app).get('/api/v1/campaigns/promo-casa');
    expect(res.status).toBe(200);
    expect(res.body.data.campaign.progress.soldPercentage).toBe(69);
    expect(res.body.data.campaign.progress.availableChances).toBe(11);
  });
});
