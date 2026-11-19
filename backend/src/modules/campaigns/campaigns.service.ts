import {
  ACTIVE_PARTICIPATION_STATUSES,
  CampaignDrawMode,
  CampaignStatus,
  LegalApprovalStatus,
  ParticipationStatus,
  isCampaignEditLocked,
  isCampaignEvaluationClosed,
} from '../../core/domain-constants.js';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { getCampaignNumberDigits } from '../fichas/fichas.service.js';
import { deleteObject, getSignedDownloadUrl } from '../storage/storage.service.js';
import type {
  CreateCampaignInput,
  EvaluateWinnerInput,
  UpdateCampaignInput,
} from './campaigns.schema.js';

async function resolveCoverImageUrl(coverImageKey: string | null): Promise<string | null> {
  if (!coverImageKey) return null;
  const signed = await getSignedDownloadUrl({
    key: coverImageKey,
    expiresInSeconds: 3600,
  }).catch(() => null);
  return signed?.downloadUrl ?? null;
}

function normalizeGalleryInput(
  galleryImages: Array<{ imageKey: string; isCover: boolean }> | undefined,
  fallbackCoverKey?: string | null,
): {
  coverImageKey: string | null;
  items: Array<{ imageKey: string; isCover: boolean; sortOrder: number }>;
} {
  if (galleryImages !== undefined) {
    const seen = new Set<string>();
    const deduped = galleryImages
      .filter((img) => {
        if (!img.imageKey || seen.has(img.imageKey)) return false;
        seen.add(img.imageKey);
        return true;
      })
      .slice(0, 7);

    if (deduped.length === 0) {
      return { coverImageKey: null, items: [] };
    }

    const coverIndex = Math.max(
      0,
      deduped.findIndex((img) => img.isCover),
    );
    const items = deduped.map((img, idx) => ({
      imageKey: img.imageKey,
      isCover: idx === coverIndex,
      sortOrder: idx,
    }));
    return {
      coverImageKey: items[coverIndex]?.imageKey ?? null,
      items,
    };
  }

  if (fallbackCoverKey) {
    return {
      coverImageKey: fallbackCoverKey,
      items: [{ imageKey: fallbackCoverKey, isCover: true, sortOrder: 0 }],
    };
  }

  return { coverImageKey: null, items: [] };
}

async function resolveGalleryImages(
  images: Array<{ id: string; imageKey: string; isCover: boolean; sortOrder: number }>,
  fallbackCoverKey: string | null,
  fallbackCoverUrl: string | null,
) {
  if (images.length === 0) {
    if (!fallbackCoverKey) return [];
    return [
      {
        id: 'cover',
        key: fallbackCoverKey,
        url: fallbackCoverUrl,
        isCover: true,
        sortOrder: 0,
      },
    ];
  }

  return Promise.all(
    images.map(async (img) => ({
      id: img.id,
      key: img.imageKey,
      url:
        img.imageKey === fallbackCoverKey && fallbackCoverUrl
          ? fallbackCoverUrl
          : await resolveCoverImageUrl(img.imageKey),
      isCover: img.isCover,
      sortOrder: img.sortOrder,
    })),
  );
}

export interface CampaignProgress {
  totalFichas: number;
  confirmedFichas: number;
  reservedFichas: number;
  availableFichas: number;
  soldPercentage: number;
}

export async function getCampaignProgress(campaignId: string, totalFichas: number): Promise<CampaignProgress> {
  const now = new Date();
  const [confirmedFichas, reservedFichas] = await Promise.all([
    prisma.participation.count({
      where: {
        campaignId,
        status: ParticipationStatus.CONFIRMED,
      },
    }),
    prisma.participation.count({
      where: {
        campaignId,
        status: ParticipationStatus.RESERVED,
        OR: [
          { reservedUntil: null },
          { reservedUntil: { gt: now } },
        ],
      },
    }),
  ]);

  const rawPercentage = totalFichas > 0 ? (confirmedFichas / totalFichas) * 100 : 0;
  const soldPercentage = Math.min(100, Math.floor(rawPercentage * 100) / 100);
  const availableFichas = Math.max(0, totalFichas - confirmedFichas - reservedFichas);

  return {
    totalFichas,
    confirmedFichas,
    reservedFichas,
    availableFichas,
    soldPercentage,
  };
}

export async function listPublicCampaigns() {
  const now = new Date();
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: CampaignStatus.ACTIVE,
      endAt: { gt: now },
      OR: [{ drawAt: null }, { drawAt: { gt: now } }],
    },
    orderBy: { startAt: 'asc' },
    include: {
      prizes: {
        orderBy: [{ position: 'asc' }, { drawAt: 'asc' }],
        select: {
          id: true,
          campaignId: true,
          prizeType: true,
          name: true,
          description: true,
          estimatedValue: true,
          minOrderAmount: true,
          amountScope: true,
          minTickets: true,
          purchaseFrom: true,
          purchaseUntil: true,
          imageKey: true,
          position: true,
          drawAt: true,
          drawReference: true,
          winningNumber: true,
          winnerEvaluatedAt: true,
        },
      },
      combos: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  return Promise.all(
    campaigns.map(async (campaign) => {
      const [progress, coverImageUrl] = await Promise.all([
        getCampaignProgress(campaign.id, campaign.totalFichas),
        resolveCoverImageUrl(campaign.coverImageKey),
      ]);
      return {
        ...campaign,
        coverImageUrl,
        progress,
      };
    }),
  );
}

export async function listRecentPublicWinners(limit = 5) {
  const [campaignWins, prizeWins] = await Promise.all([
    prisma.campaign.findMany({
      where: {
        winnerEvaluatedAt: { not: null },
        winningOrderId: { not: null },
        winningNumber: { not: null },
      },
      orderBy: { winnerEvaluatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        drawReference: true,
        winningNumber: true,
        winnerEvaluatedAt: true,
      },
    }),
    prisma.campaignPrize.findMany({
      where: {
        winnerEvaluatedAt: { not: null },
        winningOrderId: { not: null },
        winningNumber: { not: null },
      },
      orderBy: { winnerEvaluatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        estimatedValue: true,
        prizeType: true,
        drawReference: true,
        winningNumber: true,
        winnerEvaluatedAt: true,
        campaign: { select: { title: true, slug: true } },
      },
    }),
  ]);

  const combined = [
    ...campaignWins.map((c) => ({
      id: `campaign-${c.id}`,
      sourceType: 'CAMPAIGN' as const,
      campaignTitle: c.title,
      campaignSlug: c.slug,
      prizeName: c.title,
      prizeDescription: null as string | null,
      estimatedValue: null as number | null,
      drawReference: c.drawReference,
      winningNumber: c.winningNumber!,
      evaluatedAt: c.winnerEvaluatedAt!,
    })),
    ...prizeWins.map((p) => ({
      id: `prize-${p.id}`,
      sourceType: p.prizeType === 'FLASH' ? ('FLASH' as const) : ('PRIZE' as const),
      campaignTitle: p.campaign.title,
      campaignSlug: p.campaign.slug,
      prizeName: p.name,
      prizeDescription: p.description,
      estimatedValue: p.estimatedValue,
      drawReference: p.drawReference,
      winningNumber: p.winningNumber!,
      evaluatedAt: p.winnerEvaluatedAt!,
    })),
  ];

  return combined
    .sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime())
    .slice(0, limit);
}

export async function getPublicCampaignBySlug(slug: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    include: {
      prizes: {
        orderBy: [{ position: 'asc' }, { drawAt: 'asc' }],
        select: {
          id: true,
          campaignId: true,
          prizeType: true,
          name: true,
          description: true,
          estimatedValue: true,
          minOrderAmount: true,
          amountScope: true,
          minTickets: true,
          purchaseFrom: true,
          purchaseUntil: true,
          imageKey: true,
          position: true,
          drawAt: true,
          drawReference: true,
          winningNumber: true,
          winnerEvaluatedAt: true,
        },
      },
      combos: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          passItems: {
            include: {
              digitalPass: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
            },
          },
        },
      },
      images: {
        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!campaign || campaign.status !== CampaignStatus.ACTIVE) {
    throw new NotFoundError('Campaña no encontrada o no disponible');
  }

  const [progress, coverImageUrl] = await Promise.all([
    getCampaignProgress(campaign.id, campaign.totalFichas),
    resolveCoverImageUrl(campaign.coverImageKey),
  ]);
  const galleryImages = await resolveGalleryImages(
    campaign.images,
    campaign.coverImageKey,
    coverImageUrl,
  );
  return {
    ...campaign,
    coverImageUrl,
    galleryImages,
    progress,
  };
}

export async function listAdminCampaigns() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      combos: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
      },
      _count: {
        select: {
          prizes: true,
          combos: true,
          orders: true,
        },
      },
    },
  });

  return Promise.all(
    campaigns.map(async (campaign) => ({
      ...campaign,
      progress: await getCampaignProgress(campaign.id, campaign.totalFichas),
    })),
  );
}

export async function getAdminCampaignById(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      prizes: {
        orderBy: [{ position: 'asc' }, { drawAt: 'asc' }],
        include: {
          winningOrder: {
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
      },
      combos: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
        include: {
          passItems: {
            include: {
              digitalPass: true,
            },
          },
        },
      },
      images: {
        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          items: {
            select: {
              comboNameSnapshot: true,
              passQuantitySnapshot: true,
              fichaQuantitySnapshot: true,
            },
          },
          participations: {
            where: { status: { in: ACTIVE_PARTICIPATION_STATUSES } },
            orderBy: { number: 'asc' },
            select: { number: true, status: true },
          },
        },
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError('Campaña no encontrada');
  }

  const [progress, coverImageUrl] = await Promise.all([
    getCampaignProgress(campaign.id, campaign.totalFichas),
    resolveCoverImageUrl(campaign.coverImageKey),
  ]);
  const galleryImages = await resolveGalleryImages(
    campaign.images,
    campaign.coverImageKey,
    coverImageUrl,
  );

  const numberDigits = getCampaignNumberDigits(campaign.totalFichas);
  let winnerResult: {
    winningNumber: string;
    digits: number;
    evaluatedAt: Date;
    notes: string | null;
    winner: {
      orderId: string;
      publicReference: string;
      totalAmount: number;
      confirmedAt: Date | null;
      comboNames: string[];
      customer: {
        fullName: string;
        email: string | null;
        phone: string;
      };
    } | null;
  } | null = null;

  if (campaign.winningNumber && campaign.winnerEvaluatedAt) {
    let matchedOrder = campaign.winningOrderId
      ? campaign.orders.find((o) => o.id === campaign.winningOrderId) ?? null
      : null;

    if (!matchedOrder && campaign.winningOrderId) {
      const dbOrder = await prisma.order.findUnique({
        where: { id: campaign.winningOrderId },
        select: {
          id: true,
          publicReference: true,
          totalAmount: true,
          confirmedAt: true,
          customer: { select: { fullName: true, email: true, phone: true } },
          items: {
            select: {
              comboNameSnapshot: true,
              passQuantitySnapshot: true,
              fichaQuantitySnapshot: true,
            },
          },
          participations: {
            where: { status: { in: ACTIVE_PARTICIPATION_STATUSES } },
            select: { number: true, status: true },
          },
        },
      });
      if (dbOrder) {
        matchedOrder = dbOrder as (typeof campaign.orders)[number];
      }
    }

    winnerResult = {
      winningNumber: campaign.winningNumber,
      digits: numberDigits,
      evaluatedAt: campaign.winnerEvaluatedAt,
      notes: campaign.winnerNotes ?? null,
      winner: matchedOrder
        ? {
            orderId: matchedOrder.id,
            publicReference: matchedOrder.publicReference,
            totalAmount: matchedOrder.totalAmount,
            confirmedAt: matchedOrder.confirmedAt,
            comboNames: matchedOrder.items.map((i) => i.comboNameSnapshot),
            customer: matchedOrder.customer,
          }
        : null,
    };
  }

  return { ...campaign, coverImageUrl, galleryImages, numberDigits, winnerResult, progress };
}

export async function createCampaign(input: CreateCampaignInput, actorId: string) {
  const existing = await prisma.campaign.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });

  if (existing) {
    throw new ConflictError('Ya existe una campaña con ese slug');
  }

  const legalApprovalStatus: LegalApprovalStatus = input.requiresLegalApproval
    ? (input.legalApprovalStatus ?? LegalApprovalStatus.PENDING)
    : LegalApprovalStatus.NOT_REQUIRED;

  const normalizedGallery = normalizeGalleryInput(input.galleryImages, input.coverImageKey);

  const campaign = await prisma.campaign.create({
    data: {
      slug: input.slug,
      title: input.title,
      description: input.description,
      category: input.category,
      startAt: input.startAt,
      endAt: input.endAt,
      drawAt: input.drawAt ?? null,
      drawReference: input.drawReference ?? null,
      totalFichas: input.totalFichas,
      maxNumberChanges: input.maxNumberChanges,
      enableInverseNumbers: input.enableInverseNumbers,
      themeColor: input.themeColor,
      countdownTitle: input.countdownTitle?.trim() || null,
      drawMode: input.drawMode,
      reservationMinutes: input.reservationMinutes,
      paymentWindowMinutes: input.paymentWindowMinutes,
      reviewSlaHours: input.reviewSlaHours,
      requiresLegalApproval: input.requiresLegalApproval,
      legalApprovalStatus,
      legalApprovalReference: input.legalApprovalReference ?? null,
      terms: input.terms,
      coverImageKey: normalizedGallery.coverImageKey,
      ...(normalizedGallery.items.length > 0
        ? {
            images: {
              create: normalizedGallery.items,
            },
          }
        : {}),
    },
  });

  await recordAuditLog({
    actorId,
    action: 'CAMPAIGN_CREATED',
    entityType: 'Campaign',
    entityId: campaign.id,
    metadata: { slug: campaign.slug, totalFichas: campaign.totalFichas },
  });

  return campaign;
}

export async function updateCampaign(
  id: string,
  input: UpdateCampaignInput,
  actorId: string,
) {
  const existing = await prisma.campaign.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Campaña no encontrada');
  }

  if (isCampaignEditLocked(existing.status)) {
    throw new ConflictError('No se puede modificar una campaña cerrada o completada');
  }

  const nextStart = input.startAt ?? existing.startAt;
  const nextEnd = input.endAt ?? existing.endAt;
  if (nextEnd <= nextStart) {
    throw new ValidationError('La fecha de cierre debe ser posterior a la fecha de inicio');
  }

  const activeParticipations = await prisma.participation.count({
    where: {
      campaignId: id,
      status: { in: ACTIVE_PARTICIPATION_STATUSES },
    },
  });

  if (
    existing.status === CampaignStatus.ACTIVE &&
    activeParticipations > 0 &&
    ((input.totalFichas !== undefined && input.totalFichas < activeParticipations) ||
      (input.maxNumberChanges !== undefined && input.maxNumberChanges !== existing.maxNumberChanges))
  ) {
    throw new ConflictError(
      'No se pueden modificar parámetros críticos mientras existan fichas reservadas o confirmadas',
    );
  }

  if (input.totalFichas !== undefined && input.totalFichas < activeParticipations) {
    throw new ConflictError(
      `El total de fichas no puede ser menor a los ${activeParticipations} fichas ya asignados`,
    );
  }

  const { galleryImages, ...scalarInput } = input;
  let removedKeys: string[] = [];

  if (scalarInput.drawMode && scalarInput.drawMode !== existing.drawMode) {
    if (existing.winningNumber || existing.winnerEvaluatedAt) {
      throw new ConflictError(
        'No se puede cambiar la modalidad de sorteo porque ya se evaluó el ganador',
      );
    }
    const evaluatedPrizesCount = await prisma.campaignPrize.count({
      where: { campaignId: id, winnerEvaluatedAt: { not: null } },
    });
    if (evaluatedPrizesCount > 0) {
      throw new ConflictError(
        'No se puede cambiar la modalidad de sorteo porque ya existen premios evaluados',
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (
      scalarInput.drawMode === CampaignDrawMode.SINGLE_WINNER &&
      existing.drawMode === CampaignDrawMode.MULTI_PRIZE
    ) {
      await tx.campaignPrize.deleteMany({
        where: { campaignId: id, winnerEvaluatedAt: null },
      });
    }
    let coverImageKeyPatch: string | null | undefined = scalarInput.coverImageKey;

    if (galleryImages !== undefined) {
      const prevImages = await tx.campaignImage.findMany({
        where: { campaignId: id },
        select: { imageKey: true },
      });
      const normalized = normalizeGalleryInput(galleryImages, null);
      coverImageKeyPatch = normalized.coverImageKey;

      const nextKeys = new Set(normalized.items.map((item) => item.imageKey));
      removedKeys = prevImages
        .map((img) => img.imageKey)
        .filter((key) => !nextKeys.has(key));
      if (existing.coverImageKey && !nextKeys.has(existing.coverImageKey)) {
        removedKeys.push(existing.coverImageKey);
      }

      await tx.campaignImage.deleteMany({ where: { campaignId: id } });
      if (normalized.items.length > 0) {
        await tx.campaignImage.createMany({
          data: normalized.items.map((item) => ({
            campaignId: id,
            imageKey: item.imageKey,
            isCover: item.isCover,
            sortOrder: item.sortOrder,
          })),
        });
      }
    }

    return tx.campaign.update({
      where: { id },
      data: {
        ...scalarInput,
        ...(coverImageKeyPatch !== undefined ? { coverImageKey: coverImageKeyPatch } : {}),
      },
    });
  });

  if (removedKeys.length > 0) {
    await Promise.all(
      Array.from(new Set(removedKeys)).map((key) => deleteObject(key).catch(() => undefined)),
    );
  }

  await recordAuditLog({
    actorId,
    action: 'CAMPAIGN_UPDATED',
    entityType: 'Campaign',
    entityId: id,
    metadata: { fields: Object.keys(input) },
  });

  return updated;
}

export async function publishCampaign(id: string, actorId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      combos: { where: { isActive: true } },
    },
  });

  if (!campaign) {
    throw new NotFoundError('Campaña no encontrada');
  }

  if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.PAUSED) {
    throw new ConflictError(`No se puede publicar una campaña en estado ${campaign.status}`);
  }

  if (campaign.requiresLegalApproval && campaign.legalApprovalStatus !== LegalApprovalStatus.APPROVED) {
    throw new ConflictError(
      'No se puede activar comercialmente la campaña sin autorización legal registrada (APPROVED)',
    );
  }

  if (campaign.combos.length === 0) {
    throw new ConflictError('La campaña debe tener al menos un combo activo antes de publicarse');
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data: {
      status: CampaignStatus.ACTIVE,
      publishedAt: campaign.publishedAt ?? new Date(),
    },
  });

  await recordAuditLog({
    actorId,
    action: 'CAMPAIGN_PUBLISHED',
    entityType: 'Campaign',
    entityId: id,
    metadata: { legalApprovalReference: campaign.legalApprovalReference },
  });

  return updated;
}

export async function pauseCampaign(id: string, actorId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    throw new NotFoundError('Campaña no encontrada');
  }
  if (campaign.status !== CampaignStatus.ACTIVE) {
    throw new ConflictError('Solo se pueden pausar campañas activas');
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data: { status: CampaignStatus.PAUSED },
  });

  await recordAuditLog({
    actorId,
    action: 'CAMPAIGN_PAUSED',
    entityType: 'Campaign',
    entityId: id,
  });

  return updated;
}

export async function closeCampaign(id: string, actorId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    throw new NotFoundError('Campaña no encontrada');
  }
  if (campaign.status === CampaignStatus.CLOSED || campaign.status === CampaignStatus.COMPLETED) {
    throw new ConflictError('La campaña ya se encuentra cerrada');
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data: { status: CampaignStatus.CLOSED },
  });

  await recordAuditLog({
    actorId,
    action: 'CAMPAIGN_CLOSED',
    entityType: 'Campaign',
    entityId: id,
  });

  return updated;
}

export async function deleteCampaign(id: string, actorId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          orders: true,
          participations: true,
          reservationSessions: true,
        },
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError('Campaña no encontrada');
  }

  const hasActivity =
    campaign.status !== CampaignStatus.DRAFT ||
    campaign._count.orders > 0 ||
    campaign._count.participations > 0 ||
    campaign._count.reservationSessions > 0;

  if (hasActivity) {
    throw new ConflictError(
      'Solo se pueden eliminar permanentemente campañas en borrador sin actividad. Si ya fue activada, podés pausarla o cerrarla.',
    );
  }

  await prisma.campaign.delete({ where: { id } });

  await recordAuditLog({
    actorId,
    action: 'CAMPAIGN_DELETED',
    entityType: 'Campaign',
    entityId: id,
    metadata: { slug: campaign.slug, title: campaign.title },
  });

  return { deleted: true };
}

function assertCampaignDrawTimeReached(drawAt: Date | null, endAt: Date): void {
  const now = new Date();
  const target = drawAt ?? endAt;
  if (target > now) {
    const formatted = new Intl.DateTimeFormat('es-CR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Costa_Rica',
    }).format(target);
    throw new ConflictError(
      `Este sorteo está programado para el ${formatted} y aún no se puede evaluar.`,
    );
  }
}

export async function evaluateCampaignWinner(
  id: string,
  input: EvaluateWinnerInput,
  actorId: string,
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      totalFichas: true,
      status: true,
      drawMode: true,
      drawAt: true,
      endAt: true,
    },
  });

  if (!campaign) {
    throw new NotFoundError('Campaña no encontrada');
  }

  if (campaign.drawMode !== CampaignDrawMode.SINGLE_WINNER) {
    throw new ConflictError(
      'Esta campaña está configurada con múltiples premios; evaluá cada premio individualmente.',
    );
  }

  if (isCampaignEvaluationClosed(campaign.status)) {
    throw new ConflictError('No se puede evaluar una campaña ya completada o cancelada');
  }

  assertCampaignDrawTimeReached(campaign.drawAt, campaign.endAt);

  const digits = getCampaignNumberDigits(campaign.totalFichas);
  const rawNumber = input.winningNumber.trim();

  if (rawNumber.length !== digits) {
    throw new ValidationError(
      `El número ganador para esta campaña debe tener exactamente ${digits} dígitos`,
    );
  }

  const numericValue = Number(rawNumber);
  if (!Number.isInteger(numericValue) || numericValue < 0 || numericValue >= campaign.totalFichas) {
    throw new ValidationError(
      `El número ganador debe estar dentro del rango permitido (0 a ${String(campaign.totalFichas - 1).padStart(digits, '0')})`,
    );
  }

  const match = await prisma.participation.findFirst({
    where: {
      campaignId: id,
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

  const evaluatedAt = new Date();
  const notes = input.notes?.trim() || null;

  await prisma.campaign.update({
    where: { id },
    data: {
      winningNumber: rawNumber,
      winningOrderId: match?.order?.id ?? null,
      winnerEvaluatedAt: evaluatedAt,
      winnerNotes: notes,
      status: CampaignStatus.COMPLETED,
    },
  });

  await recordAuditLog({
    actorId,
    action: 'CAMPAIGN_WINNER_EVALUATED',
    entityType: 'Campaign',
    entityId: id,
    metadata: {
      winningNumber: rawNumber,
      digits,
      matched: Boolean(match?.order),
      orderReference: match?.order?.publicReference ?? null,
    },
  });

  return {
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

export async function resetCampaignWinnerEvaluation(id: string, actorId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      drawMode: true,
      endAt: true,
      winningNumber: true,
      winningOrderId: true,
      winnerEvaluatedAt: true,
    },
  });

  if (!campaign) {
    throw new NotFoundError('Campaña no encontrada');
  }

  if (campaign.drawMode !== CampaignDrawMode.SINGLE_WINNER) {
    throw new ConflictError('Esta campaña usa múltiples premios; revertí cada premio individualmente.');
  }

  if (!campaign.winnerEvaluatedAt && !campaign.winningNumber && !campaign.winningOrderId) {
    throw new ConflictError('Esta campaña aún no tiene una evaluación de ganador registrada');
  }

  const nextStatus =
    campaign.status === CampaignStatus.COMPLETED
      ? campaign.endAt > new Date()
        ? CampaignStatus.ACTIVE
        : CampaignStatus.CLOSED
      : campaign.status;

  await prisma.campaign.update({
    where: { id },
    data: {
      winningNumber: null,
      winningOrderId: null,
      winnerEvaluatedAt: null,
      winnerNotes: null,
      status: nextStatus,
    },
  });

  await recordAuditLog({
    actorId,
    action: 'CAMPAIGN_EVALUATION_RESET',
    entityType: 'Campaign',
    entityId: id,
    metadata: {
      previousWinningNumber: campaign.winningNumber,
      previousWinningOrderId: campaign.winningOrderId,
      previousEvaluatedAt: campaign.winnerEvaluatedAt?.toISOString() ?? null,
      restoredStatus: nextStatus,
    },
  });

  return { reset: true, status: nextStatus };
}
