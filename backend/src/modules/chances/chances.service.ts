import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ConflictError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';

export function getCampaignNumberDigits(totalChances: number): number {
  const safeTotal = Math.max(10, Math.min(100000, Math.trunc(totalChances)));
  return Math.min(5, Math.max(2, String(safeTotal - 1).length));
}

export function formatCampaignNumber(n: number, digits: number): string {
  return String(n).padStart(digits, '0');
}

export function formatFiveDigitNumber(n: number): string {
  return formatCampaignNumber(n, 5);
}

export async function releaseExpiredReservations(
  campaignId?: string,
  tx?: Prisma.TransactionClient,
): Promise<{ releasedSessions: number; releasedOrders: number }> {
  const client = tx ?? prisma;
  const now = new Date();

  const expiredSessions = await client.reservationSession.findMany({
    where: {
      ...(campaignId ? { campaignId } : {}),
      status: 'ACTIVE',
      expiresAt: { lte: now },
    },
    select: { id: true },
  });

  if (expiredSessions.length > 0) {
    const sessionIds = expiredSessions.map((s) => s.id);
    await client.participation.updateMany({
      where: {
        reservationSessionId: { in: sessionIds },
        status: 'RESERVED',
      },
      data: {
        status: 'RELEASED',
        reservedUntil: null,
      },
    });
    await client.reservationSession.updateMany({
      where: { id: { in: sessionIds } },
      data: { status: 'EXPIRED' },
    });
  }

  // Only PENDING_PAYMENT orders expire automatically.
  // UNDER_REVIEW orders (with submitted proof) NEVER expire automatically.
  const expiredOrders = await client.order.findMany({
    where: {
      ...(campaignId ? { campaignId } : {}),
      status: 'PENDING_PAYMENT',
      expiresAt: { lte: now },
    },
    select: { id: true },
  });

  if (expiredOrders.length > 0) {
    const orderIds = expiredOrders.map((o) => o.id);
    await client.participation.updateMany({
      where: {
        orderId: { in: orderIds },
        status: 'RESERVED',
      },
      data: {
        status: 'RELEASED',
        reservedUntil: null,
      },
    });
    await client.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: 'EXPIRED' },
    });
    await client.payment.updateMany({
      where: {
        orderId: { in: orderIds },
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        rejectionReason: 'Tiempo de pago expirado',
      },
    });
  }

  return {
    releasedSessions: expiredSessions.length,
    releasedOrders: expiredOrders.length,
  };
}

export async function allocateRandomNumbers(params: {
  tx: Prisma.TransactionClient;
  campaignId: string;
  totalChances: number;
  quantity: number;
  reservationSessionId: string;
  reservedUntil: Date;
  excludeNumbers?: Set<string>;
}): Promise<string[]> {
  const {
    tx,
    campaignId,
    totalChances,
    quantity,
    reservationSessionId,
    reservedUntil,
    excludeNumbers,
  } = params;

  const activeCount = await tx.participation.count({
    where: {
      campaignId,
      status: { in: ['RESERVED', 'CONFIRMED'] },
    },
  });

  if (activeCount + quantity > totalChances) {
    throw new ConflictError('No hay suficientes chances disponibles en esta campaña');
  }

  const activeRows = await tx.participation.findMany({
    where: {
      campaignId,
      status: { in: ['RESERVED', 'CONFIRMED'] },
    },
    select: { number: true },
  });

  const taken = new Set<string>(activeRows.map((r) => r.number));
  const assigned: string[] = [];
  const maxPool = Math.min(100000, Math.max(10, totalChances));
  const digits = getCampaignNumberDigits(totalChances);

  for (let attempt = 0; attempt < 5 && assigned.length < quantity; attempt++) {
    const needed = quantity - assigned.length;
    const candidates = new Set<string>();
    const maxDraws = Math.max(needed * 10, 500);

    for (let draw = 0; draw < maxDraws && candidates.size < needed; draw++) {
      const candidate = formatCampaignNumber(crypto.randomInt(0, maxPool), digits);
      if (taken.has(candidate)) continue;
      if (attempt === 0 && excludeNumbers?.has(candidate) && maxPool - taken.size > quantity) {
        continue;
      }
      candidates.add(candidate);
      taken.add(candidate);
    }

    if (candidates.size === 0) {
      continue;
    }

    const candidateArray = Array.from(candidates);
    const result = await tx.participation.createMany({
      data: candidateArray.map((number) => ({
        campaignId,
        reservationSessionId,
        number,
        status: 'RESERVED',
        reservedUntil,
      })),
      skipDuplicates: true,
    });

    if (result.count === candidateArray.length) {
      assigned.push(...candidateArray);
    } else {
      // Partial collision with concurrent writer: query exact numbers inserted for this session
      const persisted = await tx.participation.findMany({
        where: {
          reservationSessionId,
          status: 'RESERVED',
        },
        select: { number: true },
      });
      assigned.length = 0;
      for (const row of persisted) {
        assigned.push(row.number);
      }
    }
  }

  if (assigned.length < quantity) {
    throw new ConflictError('No se pudieron asignar todos los chances por alta concurrencia. Intentá de nuevo.');
  }

  return assigned.slice(0, quantity).sort();
}
