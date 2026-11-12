import { beforeEach, describe, expect, it, vi } from 'vitest';

const { state, txMock, withLock } = vi.hoisted(() => {
  const innerState = {
    campaign: {
      id: 'camp_1',
      status: 'ACTIVE',
      startAt: new Date('2026-01-01T00:00:00Z'),
      endAt: new Date('2027-01-01T00:00:00Z'),
      totalChances: 100,
      maxNumberChanges: 5,
      reservationMinutes: 15,
      paymentWindowMinutes: 60,
    },
    combo: {
      id: 'combo_1',
      campaignId: 'camp_1',
      name: 'Combo 4 Chances',
      price: 4000,
      passQuantity: 1,
      chanceQuantity: 4,
      isActive: true,
    },
    sessions: [] as Array<Record<string, unknown>>,
    orders: [] as Array<Record<string, unknown>>,
    participations: [] as Array<{
      id: string;
      campaignId: string;
      reservationSessionId: string | null;
      orderId: string | null;
      number: string;
      status: 'RESERVED' | 'CONFIRMED' | 'RELEASED';
      reservedUntil: Date | null;
    }>,
  };

  let mutexQueue = Promise.resolve();
  function lock<T>(fn: () => Promise<T>): Promise<T> {
    const next = mutexQueue.then(fn, fn);
    mutexQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  const mock = {
    $queryRaw: vi.fn(async () => [{ id: 'camp_1' }]),
    campaign: {
      findUnique: vi.fn(async () => innerState.campaign),
    },
    campaignCombo: {
      findFirst: vi.fn(async () => innerState.combo),
    },
    reservationSession: {
      findMany: vi.fn(async ({ where }: { where: { status?: string; expiresAt?: { lte: Date } } }) => {
        return innerState.sessions.filter(
          (s) =>
            (!where.status || s.status === where.status) &&
            (!where.expiresAt?.lte || (s.expiresAt as Date) <= where.expiresAt.lte),
        );
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const s = innerState.sessions.find((item) => item.id === where.id);
        if (!s) return null;
        return { ...s, campaign: innerState.campaign, combo: innerState.combo };
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const created = { id: `sess_${innerState.sessions.length + 1}`, ...data };
        innerState.sessions.push(created);
        return created;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const found = innerState.sessions.find((s) => s.id === where.id);
        if (found) Object.assign(found, data);
        return found;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { id: { in: string[] } }; data: Record<string, unknown> }) => {
        let count = 0;
        for (const s of innerState.sessions) {
          if (where.id.in.includes(s.id as string)) {
            Object.assign(s, data);
            count++;
          }
        }
        return { count };
      }),
    },
    order: {
      findMany: vi.fn(async ({ where }: { where: { status?: string; expiresAt?: { lte: Date } } }) => {
        return innerState.orders.filter(
          (o) =>
            (!where.status || o.status === where.status) &&
            (!where.expiresAt?.lte || (o.expiresAt as Date) <= where.expiresAt.lte),
        );
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { id: { in: string[] } }; data: Record<string, unknown> }) => {
        let count = 0;
        for (const o of innerState.orders) {
          if (where.id.in.includes(o.id as string)) {
            Object.assign(o, data);
            count++;
          }
        }
        return { count };
      }),
    },
    payment: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    participation: {
      count: vi.fn(async ({ where }: { where: { status: { in: string[] } } }) => {
        return innerState.participations.filter((p) => where.status.in.includes(p.status)).length;
      }),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { reservationSessionId?: string; status?: string | { in: string[] } };
        }) => {
          return innerState.participations.filter((p) => {
            if (where.reservationSessionId && p.reservationSessionId !== where.reservationSessionId) {
              return false;
            }
            if (typeof where.status === 'string') return p.status === where.status;
            if (where.status && 'in' in where.status) return where.status.in.includes(p.status);
            return true;
          });
        },
      ),
      createMany: vi.fn(
        async ({
          data,
          skipDuplicates,
        }: {
          data: Array<{
            campaignId: string;
            reservationSessionId: string;
            number: string;
            status: 'RESERVED';
            reservedUntil: Date;
          }>;
          skipDuplicates?: boolean;
        }) => {
          let count = 0;
          for (const row of data) {
            const conflict = innerState.participations.some(
              (p) =>
                p.campaignId === row.campaignId &&
                p.number === row.number &&
                (p.status === 'RESERVED' || p.status === 'CONFIRMED'),
            );
            if (conflict) {
              if (skipDuplicates) continue;
              throw new Error('Unique constraint violation');
            }
            innerState.participations.push({
              id: `part_${innerState.participations.length + 1}`,
              orderId: null,
              ...row,
            });
            count++;
          }
          return { count };
        },
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { reservationSessionId?: { in: string[] } | string; orderId?: { in: string[] }; status?: string };
          data: Partial<{ status: 'RELEASED'; reservedUntil: Date | null }>;
        }) => {
          let count = 0;
          for (const p of innerState.participations) {
            if (where.status && p.status !== where.status) continue;
            if (typeof where.reservationSessionId === 'string' && p.reservationSessionId !== where.reservationSessionId) {
              continue;
            }
            if (
              where.reservationSessionId &&
              typeof where.reservationSessionId === 'object' &&
              !where.reservationSessionId.in.includes(p.reservationSessionId ?? '')
            ) {
              continue;
            }
            if (where.orderId && !where.orderId.in.includes(p.orderId ?? '')) continue;
            Object.assign(p, data);
            count++;
          }
          return { count };
        },
      ),
    },
  };

  return { state: innerState, txMock: mock, withLock: lock };
});

vi.mock('../src/core/prisma.js', () => ({
  prisma: {
    ...txMock,
    $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => withLock(() => cb(txMock))),
  },
}));

import { releaseExpiredReservations } from '../src/modules/chances/chances.service.js';
import {
  createReservationSession,
  regenerateReservationNumbers,
} from '../src/modules/reservations/reservations.module.js';

describe('Chances Engine & Concurrency', () => {
  beforeEach(() => {
    state.campaign.totalChances = 100;
    state.sessions.length = 0;
    state.orders.length = 0;
    state.participations.length = 0;
  });

  it('handles 25 concurrent reservation requests with zero duplicate numbers', async () => {
    const requests = Array.from({ length: 25 }, () =>
      createReservationSession({ campaignId: 'camp_1', comboId: 'combo_1' }),
    );

    const results = await Promise.all(requests);
    expect(results).toHaveLength(25);

    const allNumbers = results.flatMap((r) => r.numbers);
    expect(allNumbers).toHaveLength(100);
    expect(new Set(allNumbers).size).toBe(100);
    for (const num of allNumbers) {
      expect(num).toMatch(/^\d{5}$/);
    }

    // 26th request must fail because totalChances (100) is exhausted
    await expect(
      createReservationSession({ campaignId: 'camp_1', comboId: 'combo_1' }),
    ).rejects.toThrow('No hay suficientes chances disponibles');
  });

  it('allows regenerating up to 5 times and blocks the 6th attempt', async () => {
    const session = await createReservationSession({
      campaignId: 'camp_1',
      comboId: 'combo_1',
    });

    for (let i = 1; i <= 5; i++) {
      const res = await regenerateReservationNumbers({
        sessionId: session.sessionId,
        sessionToken: session.sessionToken,
      });
      expect(res.regenerationCount).toBe(i);
      expect(res.remainingChanges).toBe(5 - i);
      expect(res.numbers).toHaveLength(4);
    }

    await expect(
      regenerateReservationNumbers({
        sessionId: session.sessionId,
        sessionToken: session.sessionToken,
      }),
    ).rejects.toThrow('límite de 5 cambios');
  });

  it('releases expired PENDING_PAYMENT orders but NEVER releases UNDER_REVIEW orders', async () => {
    const pastDate = new Date(Date.now() - 60_000);
    state.orders.push(
      { id: 'ord_pending', status: 'PENDING_PAYMENT', expiresAt: pastDate },
      { id: 'ord_review', status: 'UNDER_REVIEW', expiresAt: pastDate },
    );
    state.participations.push(
      {
        id: 'p1',
        campaignId: 'camp_1',
        reservationSessionId: null,
        orderId: 'ord_pending',
        number: '00123',
        status: 'RESERVED',
        reservedUntil: pastDate,
      },
      {
        id: 'p2',
        campaignId: 'camp_1',
        reservationSessionId: null,
        orderId: 'ord_review',
        number: '00456',
        status: 'RESERVED',
        reservedUntil: null,
      },
    );

    const res = await releaseExpiredReservations('camp_1');
    expect(res.releasedOrders).toBe(1);
    expect(state.participations.find((p) => p.id === 'p1')?.status).toBe('RELEASED');
    expect(state.participations.find((p) => p.id === 'p2')?.status).toBe('RESERVED');
  });
});
