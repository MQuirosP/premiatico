import crypto from 'node:crypto';
import type { z } from 'zod';
import {
  CampaignDrawMode,
  CampaignStatus,
  ParticipationStatus,
  PrizeAmountScope,
  PrizeCategory,
  PrizeDrawWeightMode,
  WinnerSourceType,
  isCampaignEditLocked,
  isCampaignEvaluationClosed,
} from '../../core/domain-constants.js';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { getCampaignNumberDigits } from '../fichas/fichas.service.js';
import { sendPrizeWinnerEmail } from '../notifications/notifications.service.js';
import {
  markDrawWinnerContacted,
  markDrawWinnerReverted,
  recordDrawWinner,
} from '../winners/winners.module.js';
import {
  buildCustomerAggregates,
  getOrderIneligibilityReason,
  getPrizeEligibilityPool,
  type OrderForEligibility,
  type PrizeEligibilityRules,
} from './prize-eligibility.js';
import type {
  createDailyPrizeSeriesSchema,
  createPrizeSchema,
  drawRandomPrizeWinnerSchema,
  evaluatePrizeWinnerSchema,
  updatePrizeSchema,
} from './prizes.schema.js';

function resolvePrizeTypeForCampaign(
  drawMode: CampaignDrawMode,
  requested?: PrizeCategory,
): PrizeCategory {
  if (drawMode === CampaignDrawMode.SINGLE_WINNER) {
    if (requested === PrizeCategory.MAIN) {
      throw new ConflictError(
        'En campañas de ganador único, los sorteos adicionales deben ser de tipo Sorteo Flash.',
      );
    }
    return PrizeCategory.FLASH;
  }
  return requested ?? PrizeCategory.MAIN;
}

function buildEligibilityData(input: {
  minOrderAmount?: number | null;
  amountScope?: PrizeAmountScope;
  minTickets?: number | null;
  purchaseFrom?: string | null;
  purchaseUntil?: string | null;
  requiredComboId?: string | null;
  orderChannel?: z.infer<typeof createPrizeSchema>['orderChannel'];
  drawWeightMode?: PrizeDrawWeightMode;
}) {
  const purchaseFrom = input.purchaseFrom ? new Date(input.purchaseFrom) : null;
  const purchaseUntil = input.purchaseUntil ? new Date(input.purchaseUntil) : null;
  if (purchaseFrom && purchaseUntil && purchaseUntil <= purchaseFrom) {
    throw new ValidationError('La fecha de cierre de la ventana de compra debe ser posterior al inicio.');
  }

  return {
    minOrderAmount: input.minOrderAmount ?? null,
    amountScope: input.amountScope ?? PrizeAmountScope.PER_ORDER,
    minTickets: input.minTickets ?? null,
    purchaseFrom,
    purchaseUntil,
    requiredComboId: input.requiredComboId?.trim() || null,
    orderChannel: input.orderChannel ?? null,
    drawWeightMode: input.drawWeightMode ?? PrizeDrawWeightMode.PER_TICKET,
  };
}

async function getExcludedOrderIds(
  campaignId: string,
  currentPrizeId: string,
  allowDuplicateOrder: boolean,
): Promise<string[]> {
  if (allowDuplicateOrder) return [];
  const priorWins = await prisma.campaignPrize.findMany({
    where: {
      campaignId,
      id: { not: currentPrizeId },
      winningOrderId: { not: null },
    },
    select: { winningOrderId: true },
  });
  return priorWins.map((w) => w.winningOrderId).filter((id): id is string => Boolean(id));
}

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
  if (isCampaignEditLocked(campaign.status)) {
    throw new ConflictError('No se pueden agregar premios a una campaña cerrada o completada');
  }

  const prizeType = resolvePrizeTypeForCampaign(campaign.drawMode, input.prizeType);
  const eligibilityData = buildEligibilityData(input);
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
          prizeType,
          name: prizeName,
          description: input.description,
          estimatedValue: input.estimatedValue ?? null,
          ...eligibilityData,
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
      prizeType,
      count: created.length,
      name: input.name,
      drawReference,
    },
  });

  return created;
}

export async function createDailyPrizeSeries(
  input: z.infer<typeof createDailyPrizeSeriesSchema>,
  actorId: string,
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    select: { id: true, status: true, drawMode: true, _count: { select: { prizes: true } } },
  });
  if (!campaign) {
    throw new NotFoundError('Campaña no encontrada');
  }
  if (isCampaignEditLocked(campaign.status)) {
    throw new ConflictError('No se pueden agregar premios a una campaña cerrada o completada');
  }

  const prizeType = resolvePrizeTypeForCampaign(campaign.drawMode, input.prizeType);
  const eligibilityData = buildEligibilityData(input);

  const startMs = new Date(`${input.startDate}T00:00:00-06:00`).getTime();
  const endMs = new Date(`${input.endDate}T00:00:00-06:00`).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    throw new ValidationError('La fecha final debe ser igual o posterior a la fecha inicial');
  }

  const totalDays = Math.floor((endMs - startMs) / 86_400_000) + 1;
  if (totalDays > 60) {
    throw new ValidationError('Máximo 60 sorteos diarios por serie');
  }

  const drawReference = input.drawReference?.trim() || null;
  const startPosition = campaign._count.prizes;

  const created = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (let i = 0; i < totalDays; i += 1) {
      const dayUtc = new Date(startMs + i * 86_400_000);
      // Reconstruir YYYY-MM-DD en CR (UTC-6)
      const crDate = new Date(dayUtc.getTime() - 6 * 3600_000);
      const yyyy = crDate.getUTCFullYear();
      const mm = String(crDate.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(crDate.getUTCDate()).padStart(2, '0');
      const drawAt = new Date(`${yyyy}-${mm}-${dd}T${input.drawTime}:00-06:00`);
      const prize = await tx.campaignPrize.create({
        data: {
          campaignId: input.campaignId,
          prizeType,
          name: `${input.name} (${dd}/${mm})`,
          description: input.description,
          estimatedValue: input.estimatedValue ?? null,
          ...eligibilityData,
          position: startPosition + i,
          drawAt,
          drawReference,
        },
      });
      rows.push(prize);
    }
    return rows;
  });

  await recordAuditLog({
    actorId,
    action: 'PRIZES_DAILY_SERIES_CREATED',
    entityType: 'CampaignPrize',
    entityId: created[0]!.id,
    metadata: {
      campaignId: input.campaignId,
      prizeType,
      count: created.length,
      startDate: input.startDate,
      endDate: input.endDate,
      drawTime: input.drawTime,
      minOrderAmount: input.minOrderAmount ?? null,
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
      ...(input.minOrderAmount !== undefined ? { minOrderAmount: input.minOrderAmount } : {}),
      ...(input.amountScope !== undefined ? { amountScope: input.amountScope } : {}),
      ...(input.minTickets !== undefined ? { minTickets: input.minTickets } : {}),
      ...(input.purchaseFrom !== undefined
        ? { purchaseFrom: input.purchaseFrom ? new Date(input.purchaseFrom) : null }
        : {}),
      ...(input.purchaseUntil !== undefined
        ? { purchaseUntil: input.purchaseUntil ? new Date(input.purchaseUntil) : null }
        : {}),
      ...(input.requiredComboId !== undefined
        ? { requiredComboId: input.requiredComboId?.trim() || null }
        : {}),
      ...(input.orderChannel !== undefined ? { orderChannel: input.orderChannel } : {}),
      ...(input.drawWeightMode !== undefined ? { drawWeightMode: input.drawWeightMode } : {}),
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

function assertPrizeEvaluatable(prize: {
  prizeType: PrizeCategory;
  drawAt: Date | null;
  campaign: { drawMode: CampaignDrawMode; status: CampaignStatus };
}): void {
  if (
    prize.campaign.drawMode !== CampaignDrawMode.MULTI_PRIZE &&
    prize.prizeType !== PrizeCategory.FLASH
  ) {
    throw new ConflictError('Esta campaña es de sorteo único; evaluá el ganador único global.');
  }
  if (isCampaignEvaluationClosed(prize.campaign.status)) {
    throw new ConflictError('No se puede evaluar una campaña ya completada o cancelada');
  }
  assertPrizeDrawTimeReached(prize.drawAt);
}

async function syncCampaignStatusAfterPrizeEvaluation(
  campaignId: string,
  drawMode: CampaignDrawMode,
  currentStatus: CampaignStatus,
  campaignEndAt: Date,
): Promise<void> {
  // En campañas SINGLE_WINNER los sorteos FLASH son dinámicas intermedias: nunca cierran la campaña principal.
  if (drawMode !== CampaignDrawMode.MULTI_PRIZE) {
    return;
  }

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

  // Si aún quedan premios pendientes y las ventas siguen abiertas (endAt > now),
  // la campaña se mantiene ACTIVE para no interrumpir compras durante sorteos diarios.
  if (currentStatus === CampaignStatus.ACTIVE && campaignEndAt <= new Date()) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.CLOSED },
    });
  }
}

export async function getPrizeEligibleSummary(
  prizeId: string,
  allowDuplicateOrder = false,
) {
  const prize = await prisma.campaignPrize.findUnique({
    where: { id: prizeId },
    select: {
      id: true,
      campaignId: true,
      minOrderAmount: true,
      amountScope: true,
      minTickets: true,
      purchaseFrom: true,
      purchaseUntil: true,
      requiredComboId: true,
      orderChannel: true,
      drawWeightMode: true,
    },
  });

  if (!prize) {
    throw new NotFoundError('Premio o sorteo no encontrado');
  }

  const excludedOrderIds = await getExcludedOrderIds(
    prize.campaignId,
    prize.id,
    allowDuplicateOrder,
  );
  const pool = await getPrizeEligibilityPool(prize, excludedOrderIds);

  return {
    prizeId: prize.id,
    totalConfirmedCount: pool.totalConfirmedCount,
    eligibleTicketsCount: pool.eligibleParticipations.length,
    eligibleCustomersCount: pool.eligibleCustomers.length,
    excludedCount: pool.excludedCount,
    drawWeightMode: prize.drawWeightMode,
    eligibleCustomers: pool.eligibleCustomers.slice(0, 100),
  };
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
        select: {
          id: true,
          title: true,
          totalFichas: true,
          status: true,
          drawMode: true,
          endAt: true,
        },
      },
    },
  });

  if (!prize) {
    throw new NotFoundError('Premio o sorteo no encontrado');
  }
  assertPrizeEvaluatable(prize);

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
          customerId: true,
          totalAmount: true,
          confirmedAt: true,
          createdAt: true,
          channel: true,
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          items: {
            select: { comboId: true, comboNameSnapshot: true, fichaQuantitySnapshot: true },
          },
        },
      },
    },
  });

  if (match?.order) {
    const excludedOrderIds = await getExcludedOrderIds(
      prize.campaignId,
      prize.id,
      Boolean(input.allowDuplicateOrder),
    );
    const rules: PrizeEligibilityRules = prize;
    const customerAggregates =
      prize.amountScope === PrizeAmountScope.CUSTOMER_TOTAL
        ? buildCustomerAggregates(
            (await getPrizeEligibilityPool(rules, [])).eligibleParticipations
              .map((p) => p.order)
              .filter((o): o is OrderForEligibility => Boolean(o)),
            rules,
          )
        : new Map();

    const ineligibilityReason = getOrderIneligibilityReason(
      match.order as OrderForEligibility,
      rules,
      customerAggregates,
      new Set(excludedOrderIds),
    );

    if (ineligibilityReason) {
      throw new ConflictError(
        `El número ${rawNumber} (pedido ${match.order.publicReference}) no es elegible para este premio: ${ineligibilityReason}.`,
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

  await recordDrawWinner({
    campaignId: prize.campaignId,
    prizeId: prize.id,
    orderId: match?.order?.id ?? null,
    sourceType:
      prize.prizeType === PrizeCategory.FLASH ? WinnerSourceType.FLASH : WinnerSourceType.PRIZE,
    winningNumber: rawNumber,
    evaluatedAt,
    evaluatedById: actorId,
  });

  await syncCampaignStatusAfterPrizeEvaluation(
    prize.campaignId,
    prize.campaign.drawMode,
    prize.campaign.status,
    prize.campaign.endAt,
  );

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
        select: {
          id: true,
          title: true,
          totalFichas: true,
          status: true,
          drawMode: true,
          endAt: true,
        },
      },
    },
  });

  if (!prize) {
    throw new NotFoundError('Premio o sorteo no encontrado');
  }
  assertPrizeEvaluatable(prize);

  const excludedOrderIds = await getExcludedOrderIds(
    prize.campaignId,
    prize.id,
    Boolean(input.allowDuplicateOrder),
  );
  const eligibilityPool = await getPrizeEligibilityPool(prize, excludedOrderIds);

  if (eligibilityPool.drawPool.length === 0) {
    throw new ConflictError(
      excludedOrderIds.length > 0
        ? 'No quedan fichas ni participantes elegibles con los criterios configurados. Revisá las reglas o activá "Permitir ganador repetido" si aplica.'
        : 'No hay fichas confirmadas que cumplan los criterios de elegibilidad para este sorteo.',
    );
  }

  const selected = eligibilityPool.drawPool[crypto.randomInt(0, eligibilityPool.drawPool.length)]!;
  const digits = getCampaignNumberDigits(prize.campaign.totalFichas);
  const evaluatedAt = new Date();
  const notes = input.notes?.trim() || 'Sorteo aleatorio entre participantes elegibles';

  await prisma.campaignPrize.update({
    where: { id: prizeId },
    data: {
      winningNumber: selected.number,
      winningOrderId: selected.order?.id ?? null,
      winnerEvaluatedAt: evaluatedAt,
      winnerNotes: notes,
    },
  });

  await recordDrawWinner({
    campaignId: prize.campaignId,
    prizeId: prize.id,
    orderId: selected.order?.id ?? null,
    sourceType:
      prize.prizeType === PrizeCategory.FLASH ? WinnerSourceType.FLASH : WinnerSourceType.PRIZE,
    winningNumber: selected.number,
    evaluatedAt,
    evaluatedById: actorId,
  });

  await syncCampaignStatusAfterPrizeEvaluation(
    prize.campaignId,
    prize.campaign.drawMode,
    prize.campaign.status,
    prize.campaign.endAt,
  );

  await recordAuditLog({
    actorId,
    action: 'PRIZE_RANDOM_DRAWN',
    entityType: 'CampaignPrize',
    entityId: prizeId,
    metadata: {
      campaignId: prize.campaignId,
      prizeName: prize.name,
      prizeType: prize.prizeType,
      drawReference: prize.drawReference,
      winningNumber: selected.number,
      eligibleTicketsCount: eligibilityPool.eligibleParticipations.length,
      eligibleCustomersCount: eligibilityPool.eligibleCustomers.length,
      drawWeightMode: prize.drawWeightMode,
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
      campaign: { select: { status: true, drawMode: true } },
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

  await markDrawWinnerReverted({
    campaignId: prize.campaignId,
    prizeId: prize.id,
    actorId,
  });

  if (
    prize.campaign.drawMode === CampaignDrawMode.MULTI_PRIZE &&
    prize.campaign.status === CampaignStatus.COMPLETED
  ) {
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
      description: true,
      estimatedValue: true,
      drawReference: true,
      drawAt: true,
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
  const prizeDetailLabel = prize.description?.trim() || prize.name;
  const formattedValue =
    typeof prize.estimatedValue === 'number' && prize.estimatedValue > 0
      ? `₡${prize.estimatedValue.toLocaleString('es-CR')}`
      : null;
  const formattedDrawDate = prize.drawAt
    ? new Intl.DateTimeFormat('es-CR', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Costa_Rica',
      }).format(prize.drawAt)
    : null;
  const drawMeta = [prize.drawReference?.trim(), formattedDrawDate].filter(Boolean).join(' · ');

  const subject = `¡Felicidades ${fullName}! Ganaste ${prizeDetailLabel} (${prize.name}) en Premiático`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5; max-width: 560px;">
      <h2 style="color: #059669; margin-bottom: 12px;">¡Felicidades, ${escapeHtml(fullName)}!</h2>
      <p style="margin: 0 0 14px;">
        Tu número <strong>${escapeHtml(prize.winningNumber)}</strong> resultó ganador en la campaña
        <strong>${escapeHtml(prize.campaign.title)}</strong>.
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px;">
        <p style="margin: 0 0 6px;"><strong>Premio:</strong> ${escapeHtml(prizeDetailLabel)}${formattedValue ? ` (${escapeHtml(formattedValue)})` : ''}</p>
        <p style="margin: 0 0 6px;"><strong>Sorteo:</strong> ${escapeHtml(prize.name)}${drawMeta ? ` — ${escapeHtml(drawMeta)}` : ''}</p>
        <p style="margin: 0 0 6px;"><strong>Número ganador:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: bold;">${escapeHtml(prize.winningNumber)}</span></p>
        <p style="margin: 0;"><strong>Referencia de pedido:</strong> ${escapeHtml(prize.winningOrder.publicReference)}</p>
      </div>
      <p style="margin: 0 0 14px;">Nuestro equipo se pondrá en contacto con vos para coordinar la entrega del premio.</p>
      <p style="font-size: 12px; color: #64748b; margin: 0;">Premiático Costa Rica</p>
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

  if (delivery.sent) {
    await markDrawWinnerContacted({
      campaignId: prize.campaignId,
      prizeId: prize.id,
      actorId,
    });
  }

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
