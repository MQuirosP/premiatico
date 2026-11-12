import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

const { state, txMock } = vi.hoisted(() => {
  const innerState = {
    admin: {
      id: 'admin_1',
      name: 'Admin Premiático',
      email: 'admin@premiatico.com',
      passwordHash: '',
      role: 'SUPER_ADMIN' as const,
      isActive: true,
    },
    payment: {
      id: 'pay_1',
      orderId: 'ord_1',
      amount: 8000,
      status: 'UNDER_REVIEW' as 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED',
      reviewedById: null as string | null,
      reviewedAt: null as Date | null,
      rejectionReason: null as string | null,
      reviewNotes: null as string | null,
    },
    order: {
      id: 'ord_1',
      publicReference: 'PRM-12345678',
      status: 'UNDER_REVIEW' as 'UNDER_REVIEW' | 'CONFIRMED' | 'REJECTED',
      confirmedAt: null as Date | null,
      customer: { fullName: 'María Quirós', email: 'maria@correo.com', phone: '88887777' },
      campaign: { title: 'Campaña SUV 2026', slug: 'suv-2026' },
      participations: [
        { id: 'p1', orderId: 'ord_1', number: '00123', status: 'RESERVED' as 'RESERVED' | 'CONFIRMED' | 'RELEASED', reservedUntil: null as Date | null, confirmedAt: null as Date | null },
        { id: 'p2', orderId: 'ord_1', number: '00456', status: 'RESERVED' as 'RESERVED' | 'CONFIRMED' | 'RELEASED', reservedUntil: null as Date | null, confirmedAt: null as Date | null },
      ],
    },
    audits: [] as Array<Record<string, unknown>>,
  };

  const mock = {
    $queryRaw: vi.fn(async () => [{ id: 'pay_1' }]),
    adminUser: {
      findFirst: vi.fn(async () => innerState.admin),
      findUnique: vi.fn(async () => innerState.admin),
    },
    payment: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id !== innerState.payment.id) return null;
        return { ...innerState.payment, order: innerState.order };
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(innerState.payment, data);
        return innerState.payment;
      }),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 1),
    },
    order: {
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(innerState.order, data);
        return innerState.order;
      }),
      count: vi.fn(async () => 1),
      aggregate: vi.fn(async () => ({ _sum: { totalAmount: 8000 } })),
      findMany: vi.fn(async () => []),
    },
    campaign: {
      count: vi.fn(async () => 1),
    },
    participation: {
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        let count = 0;
        for (const p of innerState.order.participations) {
          if (p.status === 'RESERVED') {
            Object.assign(p, data);
            count++;
          }
        }
        return { count };
      }),
      count: vi.fn(async () => 2),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        innerState.audits.push(data);
        return { id: `audit_${innerState.audits.length}` };
      }),
      findMany: vi.fn(async () => innerState.audits),
    },
    notificationLog: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({ id: 'notif_1' })),
    },
  };

  return { state: innerState, txMock: mock };
});

vi.mock('../src/core/prisma.js', () => ({
  prisma: {
    ...txMock,
    $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
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

describe('Admin Payments Approval, Rejection & Double-Approval Prevention', () => {
  const app = createApp();
  let authCookies: string[] = [];

  beforeEach(async () => {
    state.admin.passwordHash = bcrypt.hashSync('SuperSecret123!', 10);
    state.payment.status = 'UNDER_REVIEW';
    state.order.status = 'UNDER_REVIEW';
    state.order.participations.forEach((p) => {
      p.status = 'RESERVED';
      p.confirmedAt = null;
    });
    state.audits.length = 0;

    const loginRes = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@premiatico.com', password: 'SuperSecret123!' });
    authCookies = (loginRes.headers['set-cookie'] as unknown as string[]) ?? [];
  });

  it('blocks unauthenticated access to /admin/dashboard', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('approves payment atomically, confirms chances, and prevents double approval', async () => {
    const first = await request(app)
      .post('/api/v1/admin/payments/pay_1/approve')
      .set('Cookie', authCookies)
      .send({ reviewNotes: 'SINPE verificado' });

    expect(first.status).toBe(200);
    expect(state.payment.status).toBe('APPROVED');
    expect(state.order.status).toBe('CONFIRMED');
    expect(state.order.participations.every((p) => p.status === 'CONFIRMED')).toBe(true);
    expect(state.audits.some((a) => a.action === 'PAYMENT_APPROVED')).toBe(true);

    // Second approval attempt must be rejected
    const second = await request(app)
      .post('/api/v1/admin/payments/pay_1/approve')
      .set('Cookie', authCookies)
      .send({});

    expect(second.status).toBe(409);
  });

  it('rejects payment terminally and releases chances', async () => {
    const res = await request(app)
      .post('/api/v1/admin/payments/pay_1/reject')
      .set('Cookie', authCookies)
      .send({ rejectionReason: 'Comprobante ilegible o monto incorrecto' });

    expect(res.status).toBe(200);
    expect(state.payment.status).toBe('REJECTED');
    expect(state.order.status).toBe('REJECTED');
    expect(state.order.participations.every((p) => p.status === 'RELEASED')).toBe(true);
    expect(state.audits.some((a) => a.action === 'PAYMENT_REJECTED')).toBe(true);
  });
});
