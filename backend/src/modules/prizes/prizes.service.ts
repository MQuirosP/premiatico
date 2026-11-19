import crypto from 'node:crypto';
import type { z } from 'zod';
import {
  CampaignDrawMode,
  CampaignStatus,
  ParticipationStatus,
  isCampaignEditLocked,
  isCampaignEvaluationClosed,
} from '../../core/domain-constants.js';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { getCampaignNumberDigits } from '../fichas/fichas.service.js';
import { sendPrizeWinnerEmail } from '../notifications/notifications.service.js';
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
    select: { id: true, status: true, drawMode: true, _count: { select: { prizes: true } } },
  });
  if (!campaign) {
    throw new NotFoundError('Campaña no encontrada');
  }
  if (campaign.drawMode !== CampaignDrawMode.MULTI_PRIZE) {
    throw new ConflictError(
      'Esta campaña es de sorteo único; cambiá la modalidad a múltiples premios para agregar sorteos individuales.',
    );
  }
  if (isCampaignEditLocked(campaign.status)) {
    throw new ConflictError('No se pueden agregar premios a una campaña cerrada o completada');
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
  const existing = await prisma.campaignPrize.findUnique({
    where: { id },
    include: { campaign: { select: { status: true } } },
  });
  if (!existing) {
    throw new NotFoundError('Premio no encontrado');
  }
  if (isCampaignEditLocked(existing.campaign.status)) {
    throw new ConflictError('No se pueden editar premios de una campaña cerrada o completada');
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

  if (isCampaignEditLocked(existing.campaign.status)) {
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

async function syncMultiPrizeCampaignStatus(
  campaignId: string,
  currentStatus: CampaignStatus,
): Promise<void> {
  const pendingPrizes = await prisma.campaignPrize.count({
    where: { campaignId, winnerEvaluatedAt: null },
  });

  if (pendingPrizes === 0) {
    if (currentStatus !== CampaignStatus.COMPLETED) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.COMPLETED },
      });
    }
    return;
  }

  if (currentStatus === CampaignStatus.ACTIVE) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.CLOSED },
    });
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
        select: { id: true, title: true, totalFichas: true, status: true, drawMode: true },
      },
    },
  });

  if (!prize) {
    throw new NotFoundError('Premio o sorteo no encontrado');
  }
  if (prize.campaign.drawMode !== CampaignDrawMode.MULTI_PRIZE) {
    throw new ConflictError('Esta campaña es de sorteo único; evaluá el ganador único global.');
  }
  if (isCampaignEvaluationClosed(prize.campaign.status)) {
    throw new ConflictError('No se puede evaluar una campaña ya completada o cancelada');
  }

  assertPrizeDrawTimeReached(prize.drawAt);

  const digits = getCampaignNumberDigits(prize.campaign.totalFichas);
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
    numericValue >= prize.campaign.totalFichas
  ) {
    throw new ValidationError(
      `El número ganador debe estar dentro del rango permitido (0 a ${String(prize.campaign.totalFichas - 1).padStart(digits, '0')})`,
    );
  }

  const match = await prisma.participation.findFirst({
    where: {
      campaignId: prize.campaignId,
      number: rawNumber,
      status: ParticipationStatus.CONFIRMED,
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

  await syncMultiPrizeCampaignStatus(prize.campaignId, prize.campaign.status);

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
        select: { id: true, title: true, totalFichas: true, status: true, drawMode: true },
      },
    },
  });

  if (!prize) {
    throw new NotFoundError('Premio o sorteo no encontrado');
  }
  if (prize.campaign.drawMode !== CampaignDrawMode.MULTI_PRIZE) {
    throw new ConflictError('Esta campaña es de sorteo único; evaluá el ganador único global.');
  }
  if (isCampaignEvaluationClosed(prize.campaign.status)) {
    throw new ConflictError('No se puede evaluar una campaña ya completada o cancelada');
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
      status: ParticipationStatus.CONFIRMED,
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
        ? 'No quedan fichas confirmadas elegibles sin haber ganado otro premio. Activá "Permitir ganador repetido" si aplica.'
        : 'No hay fichas confirmadas en esta campaña para sortear.',
    );
  }

  const selected = eligibleParticipations[crypto.randomInt(0, eligibleParticipations.length)]!;
  const digits = getCampaignNumberDigits(prize.campaign.totalFichas);
  const evaluatedAt = new Date();
  const notes = input.notes?.trim() || 'Sorteo aleatorio entre fichas confirmadas';

  await prisma.campaignPrize.update({
    where: { id: prizeId },
    data: {
      winningNumber: selected.number,
      winningOrderId: selected.order?.id ?? null,
      winnerEvaluatedAt: evaluatedAt,
      winnerNotes: notes,
    },
  });

  await syncMultiPrizeCampaignStatus(prize.campaignId, prize.campaign.status);

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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function resetPrizeEvaluation(prizeId: string, actorId: string) {
  const prize = await prisma.campaignPrize.findUnique({
    where: { id: prizeId },
    select: {
      id: true,
      campaignId: true,
      name: true,
      winningNumber: true,
      winningOrderId: true,
      winnerEvaluatedAt: true,
      campaign: { select: { status: true } },
    },
  });

  if (!prize) {
    throw new NotFoundError('Premio o sorteo no encontrado');
  }

  if (!prize.winnerEvaluatedAt && !prize.winningNumber && !prize.winningOrderId) {
    throw new ConflictError('Este premio aún no ha sido evaluado');
  }

  await prisma.campaignPrize.update({
    where: { id: prizeId },
    data: {
      winningNumber: null,
      winningOrderId: null,
      winnerEvaluatedAt: null,
      winnerNotes: null,
    },
  });

  if (prize.campaign.status === CampaignStatus.COMPLETED) {
    await prisma.campaign.update({
      where: { id: prize.campaignId },
      data: { status: CampaignStatus.CLOSED },
    });
  }

  await recordAuditLog({
    actorId,
    action: 'PRIZE_EVALUATION_RESET',
    entityType: 'CampaignPrize',
    entityId: prizeId,
    metadata: {
      campaignId: prize.campaignId,
      prizeName: prize.name,
      previousWinningNumber: prize.winningNumber,
      previousWinningOrderId: prize.winningOrderId,
      previousEvaluatedAt: prize.winnerEvaluatedAt?.toISOString() ?? null,
    },
  });

  return { reset: true };
}

export async function notifyPrizeWinnerByEmail(
  prizeId: string,
  actorId: string,
  forceResend = false,
) {
  const prize = await prisma.campaignPrize.findUnique({
    where: { id: prizeId },
    select: {
      id: true,
      campaignId: true,
      name: true,
      winningNumber: true,
      winnerEvaluatedAt: true,
      campaign: { select: { title: true } },
      winningOrder: {
        select: {
          id: true,
          publicReference: true,
          customer: { select: { fullName: true, email: true } },
        },
      },
    },
  });

  if (!prize) {
    throw new NotFoundError('Premio o sorteo no encontrado');
  }

  if (!prize.winnerEvaluatedAt || !prize.winningNumber) {
    throw new ConflictError('Este premio aún no tiene una evaluación registrada');
  }

  if (!prize.winningOrder) {
    throw new ConflictError('El número ganador quedó desierto y no tiene un cliente ganador para notificar');
  }

  const { fullName, email } = prize.winningOrder.customer;
  if (!email) {
    throw new ConflictError('El cliente ganador no tiene correo electrónico registrado');
  }
  const subject = `¡Felicidades ${fullName}! Ganaste ${prize.name} en Premiático`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="color: #059669;">¡Felicidades, ${escapeHtml(fullName)}!</h2>
      <p>Tu número <strong>${escapeHtml(prize.winningNumber)}</strong> resultó ganador del premio <strong>${escapeHtml(prize.name)}</strong> en la campaña <strong>${escapeHtml(prize.campaign.title)}</strong>.</p>
      <p><strong>Referencia de pedido:</strong> ${escapeHtml(prize.winningOrder.publicReference)}</p>
      <p>Nuestro equipo se pondrá en contacto con vos para coordinar la entrega del premio.</p>
      <p style="font-size: 12px; color: #64748b;">Premiático Costa Rica</p>
    </div>
  `.trim();

  const baseKey = `PRIZE_WINNER:${prize.id}:${prize.winningNumber}:${prize.winningOrder.id}`;
  const delivery = await sendPrizeWinnerEmail({
    orderId: prize.winningOrder.id,
    recipientEmail: email,
    subject,
    html,
    idempotencyKey: forceResend ? `${baseKey}:resend:${Date.now()}` : baseKey,
  });

  await recordAuditLog({
    actorId,
    action: 'PRIZE_WINNER_EMAIL_NOTIFIED',
    entityType: 'CampaignPrize',
    entityId: prizeId,
    metadata: {
      campaignId: prize.campaignId,
      orderId: prize.winningOrder.id,
      recipientEmail: email,
      winningNumber: prize.winningNumber,
      sent: delivery.sent,
      skippedReason: delivery.skippedReason ?? null,
      errorMessage: delivery.errorMessage ?? null,
    },
  });

  return {
    ...delivery,
    recipientEmail: email,
  };
}
