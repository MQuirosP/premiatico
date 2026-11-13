import { CampaignStatus, LegalApprovalStatus } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { getSignedDownloadUrl } from '../storage/storage.service.js';
import type { CreateCampaignInput, UpdateCampaignInput } from './campaigns.schema.js';

async function resolveCoverImageUrl(coverImageKey: string | null): Promise<string | null> {
  if (!coverImageKey) return null;
  const signed = await getSignedDownloadUrl({
    key: coverImageKey,
    expiresInSeconds: 3600,
  }).catch(() => null);
  return signed?.downloadUrl ?? null;
}

export interface CampaignProgress {
  totalChances: number;
  confirmedChances: number;
  reservedChances: number;
  availableChances: number;
  soldPercentage: number;
}

export async function getCampaignProgress(campaignId: string, totalChances: number): Promise<CampaignProgress> {
  const now = new Date();
  const [confirmedChances, reservedChances] = await Promise.all([
    prisma.participation.count({
      where: {
        campaignId,
        status: 'CONFIRMED',
      },
    }),
    prisma.participation.count({
      where: {
        campaignId,
        status: 'RESERVED',
        OR: [
          { reservedUntil: null },
          { reservedUntil: { gt: now } },
        ],
      },
    }),
  ]);

  const rawPercentage = totalChances > 0 ? (confirmedChances / totalChances) * 100 : 0;
  const soldPercentage = Math.min(100, Math.floor(rawPercentage * 100) / 100);
  const availableChances = Math.max(0, totalChances - confirmedChances - reservedChances);

  return {
    totalChances,
    confirmedChances,
    reservedChances,
    availableChances,
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
      prizes: { orderBy: { position: 'asc' } },
      combos: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  return Promise.all(
    campaigns.map(async (campaign) => {
      const [progress, coverImageUrl] = await Promise.all([
        getCampaignProgress(campaign.id, campaign.totalChances),
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

export async function getPublicCampaignBySlug(slug: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    include: {
      prizes: { orderBy: { position: 'asc' } },
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
    },
  });

  if (!campaign || campaign.status !== CampaignStatus.ACTIVE) {
    throw new NotFoundError('Campaña no encontrada o no disponible');
  }

  const [progress, coverImageUrl] = await Promise.all([
    getCampaignProgress(campaign.id, campaign.totalChances),
    resolveCoverImageUrl(campaign.coverImageKey),
  ]);
  return {
    ...campaign,
    coverImageUrl,
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
      progress: await getCampaignProgress(campaign.id, campaign.totalChances),
    })),
  );
}

export async function getAdminCampaignById(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      prizes: { orderBy: { position: 'asc' } },
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
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          items: {
            select: {
              comboNameSnapshot: true,
              passQuantitySnapshot: true,
              chanceQuantitySnapshot: true,
            },
          },
          participations: {
            where: { status: { in: ['RESERVED', 'CONFIRMED'] } },
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
    getCampaignProgress(campaign.id, campaign.totalChances),
    resolveCoverImageUrl(campaign.coverImageKey),
  ]);
  return { ...campaign, coverImageUrl, progress };
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
    ? (input.legalApprovalStatus ?? 'PENDING')
    : 'NOT_REQUIRED';

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
      totalChances: input.totalChances,
      maxNumberChanges: input.maxNumberChanges,
      reservationMinutes: input.reservationMinutes,
      paymentWindowMinutes: input.paymentWindowMinutes,
      reviewSlaHours: input.reviewSlaHours,
      requiresLegalApproval: input.requiresLegalApproval,
      legalApprovalStatus,
      legalApprovalReference: input.legalApprovalReference ?? null,
      terms: input.terms,
      coverImageKey: input.coverImageKey ?? null,
    },
  });

  await recordAuditLog({
    actorId,
    action: 'CAMPAIGN_CREATED',
    entityType: 'Campaign',
    entityId: campaign.id,
    metadata: { slug: campaign.slug, totalChances: campaign.totalChances },
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

  if (existing.status === CampaignStatus.CLOSED || existing.status === CampaignStatus.COMPLETED) {
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
      status: { in: ['RESERVED', 'CONFIRMED'] },
    },
  });

  if (
    existing.status === CampaignStatus.ACTIVE &&
    activeParticipations > 0 &&
    ((input.totalChances !== undefined && input.totalChances < activeParticipations) ||
      (input.maxNumberChanges !== undefined && input.maxNumberChanges !== existing.maxNumberChanges))
  ) {
    throw new ConflictError(
      'No se pueden modificar parámetros críticos mientras existan chances reservados o confirmados',
    );
  }

  if (input.totalChances !== undefined && input.totalChances < activeParticipations) {
    throw new ConflictError(
      `El total de chances no puede ser menor a los ${activeParticipations} chances ya asignados`,
    );
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data: {
      ...input,
    },
  });

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
