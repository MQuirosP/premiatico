import crypto from 'node:crypto';
import type { z } from 'zod';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { getCampaignNumberDigits } from '../chances/chances.service.js';
import type {
  createPrizeSchema,
  drawRandomPrizeWinnerSchema,
  evaluatePrizeWinnerSchema,
  updatePrizeSchema,
} from './prizes.schema.js';

export async function createCampaignPrizes(
  input: z.infer<typeof createPrizeSchema>,
  actorId: string,
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    select: { id: true, _count: { select: { prizes: true } } },
  });
  if (!campaign) {
    throw new NotFoundError('Campaña no encontrada');
  }

  const quantity = input.quantity ?? 1;
  const startPosition = input.position > 0 ? input.position : campaign._count.prizes;
  const drawAtDate = input.drawAt ? new Date(input.drawAt) : null;
  const drawReference = input.drawReference?.trim() || null;

  const created = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (let i = 0; i < quantity; i += 1) {
      const prizeName = quantity > 1 ? `${input.name} #${i + 1}` : input.name;
      const prize = await tx.campaignPrize.create({
        data: {
          campaignId: input.campaignId,
          name: prizeName,
          description: input.description,
          estimatedValue: input.estimatedValue ?? null,
          imageKey: input.imageKey ?? null,
          position: startPosition + i,
          drawAt: drawAtDate,
          drawReference,
        },
      });
      rows.push(prize);
    }
    return rows;
  });

  await recordAuditLog({
    actorId,
    action: quantity > 1 ? 'PRIZES_BATCH_CREATED' : 'PRIZE_CREATED',
    entityType: 'CampaignPrize',
    entityId: created[0]!.id,
    metadata: {
      campaignId: input.campaignId,
      count: created.length,
      name: input.name,
      drawReference,
    },
  });

  return created;
}

export async function updateCampaignPrize(
  id: string,
  input: z.infer<typeof updatePrizeSchema>,
  actorId: string,
) {
  const existing = await prisma.campaignPrize.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Premio no encontrado');
  }

  const prize = await prisma.campaignPrize.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.estimatedValue !== undefined ? { estimatedValue: input.estimatedValue } : {}),
      ...(input.imageKey !== undefined ? { imageKey: input.imageKey } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.drawAt !== undefined
        ? { drawAt: input.drawAt ? new Date(input.drawAt) : null }
        : {}),
      ...(input.drawReference !== undefined
        ? { drawReference: input.drawReference?.trim() || null }
        : {}),
    },
  });

  await recordAuditLog({
    actorId,
    action: 'PRIZE_UPDATED',
    entityType: 'CampaignPrize',
    entityId: prize.id,
  });

  return prize;
}

export async function deleteCampaignPrize(id: string, actorId: string) {
  const existing = await prisma.campaignPrize.findUnique({
    where: { id },
    include: { campaign: { select: { status: true } } },
  });
  if (!existing) {
    throw new NotFoundError('Premio no encontrado');
  }

  if (existing.campaign.status === 'CLOSED' || existing.campaign.status === 'COMPLETED') {
    throw new ConflictError('No se puede eliminar un premio de una campaña cerrada o completada');
  }

  await prisma.campaignPrize.delete({ where: { id } });

  await recordAuditLog({
    actorId,
    action: 'PRIZE_DELETED',
    entityType: 'CampaignPrize',
    entityId: id,
  });
}

function assertPrizeDrawTimeReached(drawAt: Date | null): void {
  if (drawAt && drawAt > new Date()) {
    throw new ConflictError(
      `Este sorteo está programado para el ${drawAt.toLocaleString('es-CR')} y aún no se puede evaluar.`,
    );
  }
}

export async function evaluatePrizeWinner(
  prizeId: string,
  input: z.infer<typeof evaluatePrizeWinnerSchema>,
  actorId: string,
) {
  const prize = await prisma.campaignPrize.findUnique({
    where: { id: prizeId },
    include: {
      campaign: {
        select: { id: true, title: true, totalChances: true },
      },
    },
  });

  if (!prize) {
    throw new NotFoundError('Premio o sorteo no encontrado');
  }

  assertPrizeDrawTimeReached(prize.drawAt);

  const digits = getCampaignNumberDigits(prize.campaign.totalChances);
  const rawNumber = input.winningNumber.trim();

  if (rawNumber.length !== digits) {
    throw new ValidationError(
      `El número ganador para esta campaña debe tener exactamente ${digits} dígitos`,
    );
  }

  const numericValue = Number(rawNumber);
  if (
    !Number.isInteger(numericValue) ||
    numericValue < 0 ||
    numericValue >= prize.campaign.totalChances
  ) {
    throw new ValidationError(
      `El número ganador debe estar dentro del rango permitido (0 a ${String(prize.campaign.totalChances - 1).padStart(digits, '0')})`,
    );
  }

  const match = await prisma.participation.findFirst({
    where: {
      campaignId: prize.campaignId,
      number: rawNumber,
      status: 'CONFIRMED',
    },
    include: {
      order: {
        select: {
          id: true,
          publicReference: true,
          totalAmount: true,
          confirmedAt: true,
          customer: { select: { fullName: true, email: true, phone: true } },
          items: { select: { comboNameSnapshot: true } },
        },
      },
    },
  });

  if (match?.order && !input.allowDuplicateOrder) {
    const priorWin = await prisma.campaignPrize.findFirst({
      where: {
        campaignId: prize.campaignId,
        id: { not: prize.id },
        winningOrderId: match.order.id,
      },
      select: { name: true, winningNumber: true },
    });
    if (priorWin) {
      throw new ConflictError(
        `El pedido ${match.order.publicReference} ya resultó ganador en "${priorWin.name}" (número ${priorWin.winningNumber}). Marcá "Permitir ganador repetido" si las reglas de la campaña lo autorizan.`,
      );
    }
  }

  const evaluatedAt = new Date();
  const notes = input.notes?.trim() || null;

  await prisma.campaignPrize.update({
    where: { id: prizeId },
    data: {
      winningNumber: rawNumber,
      winningOrderId: match?.order?.id ?? null,
      winnerEvaluatedAt: evaluatedAt,
      winnerNotes: notes,
    },
  });

  await recordAuditLog({
    actorId,
    action: 'PRIZE_WINNER_EVALUATED',
    entityType: 'CampaignPrize',
    entityId: prizeId,
    metadata: {
      campaignId: prize.campaignId,
      prizeName: prize.name,
      drawReference: prize.drawReference,
      winningNumber: rawNumber,
      digits,
      matched: Boolean(match?.order),
      orderReference: match?.order?.publicReference ?? null,
    },
  });

  return {
    prizeId: prize.id,
    prizeName: prize.name,
    drawReference: prize.drawReference,
    winningNumber: rawNumber,
    digits,
    evaluatedAt,
    notes,
    winner: match?.order
      ? {
          orderId: match.order.id,
          publicReference: match.order.publicReference,
          totalAmount: match.order.totalAmount,
          confirmedAt: match.order.confirmedAt,
          comboNames: match.order.items.map((i) => i.comboNameSnapshot),
          customer: match.order.customer,
        }
      : null,
  };
}

export async function drawRandomPrizeWinner(
  prizeId: string,
  input: z.infer<typeof drawRandomPrizeWinnerSchema>,
  actorId: string,
) {
  const prize = await prisma.campaignPrize.findUnique({
    where: { id: prizeId },
    include: {
      campaign: {
        select: { id: true, title: true, totalChances: true },
      },
    },
  });

  if (!prize) {
    throw new NotFoundError('Premio o sorteo no encontrado');
  }

  assertPrizeDrawTimeReached(prize.drawAt);

  let excludedOrderIds: string[] = [];
  if (!input.allowDuplicateOrder) {
    const priorWins = await prisma.campaignPrize.findMany({
      where: {
        campaignId: prize.campaignId,
        id: { not: prize.id },
        winningOrderId: { not: null },
      },
      select: { winningOrderId: true },
    });
    excludedOrderIds = priorWins
      .map((w) => w.winningOrderId)
      .filter((id): id is string => Boolean(id));
  }

  const eligibleParticipations = await prisma.participation.findMany({
    where: {
      campaignId: prize.campaignId,
      status: 'CONFIRMED',
      ...(excludedOrderIds.length > 0 ? { orderId: { notIn: excludedOrderIds } } : {}),
    },
    include: {
      order: {
        select: {
          id: true,
          publicReference: true,
          totalAmount: true,
          confirmedAt: true,
          customer: { select: { fullName: true, email: true, phone: true } },
          items: { select: { comboNameSnapshot: true } },
        },
      },
    },
  });

  if (eligibleParticipations.length === 0) {
    throw new ConflictError(
      excludedOrderIds.length > 0
        ? 'No quedan chances confirmados elegibles sin haber ganado otro premio. Activá "Permitir ganador repetido" si aplica.'
        : 'No hay chances confirmados en esta campaña para sortear.',
    );
  }

  const selected = eligibleParticipations[crypto.randomInt(0, eligibleParticipations.length)]!;
  const digits = getCampaignNumberDigits(prize.campaign.totalChances);
  const evaluatedAt = new Date();
  const notes = input.notes?.trim() || 'Sorteo aleatorio entre chances confirmados';

  await prisma.campaignPrize.update({
    where: { id: prizeId },
    data: {
      winningNumber: selected.number,
      winningOrderId: selected.order?.id ?? null,
      winnerEvaluatedAt: evaluatedAt,
      winnerNotes: notes,
    },
  });

  await recordAuditLog({
    actorId,
    action: 'PRIZE_RANDOM_DRAWN',
    entityType: 'CampaignPrize',
    entityId: prizeId,
    metadata: {
      campaignId: prize.campaignId,
      prizeName: prize.name,
      drawReference: prize.drawReference,
      winningNumber: selected.number,
      eligiblePoolSize: eligibleParticipations.length,
      orderReference: selected.order?.publicReference ?? null,
    },
  });

  return {
    prizeId: prize.id,
    prizeName: prize.name,
    drawReference: prize.drawReference,
    winningNumber: selected.number,
    digits,
    evaluatedAt,
    notes,
    winner: selected.order
      ? {
          orderId: selected.order.id,
          publicReference: selected.order.publicReference,
          totalAmount: selected.order.totalAmount,
          confirmedAt: selected.order.confirmedAt,
          comboNames: selected.order.items.map((i) => i.comboNameSnapshot),
          customer: selected.order.customer,
        }
      : null,
  };
}
