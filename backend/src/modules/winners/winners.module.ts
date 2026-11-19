import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  WinnerDeliveryStatus,
  WinnerSourceType,
  winnerDeliveryStatusSchema,
} from '../../core/domain-constants.js';
import { NotFoundError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';
import { validate } from '../../middlewares/validate.js';
import { recordAuditLog } from '../audit/audit.service.js';

export async function recordDrawWinner(params: {
  campaignId: string;
  prizeId?: string | null;
  orderId?: string | null;
  sourceType: WinnerSourceType;
  winningNumber: string;
  evaluatedAt: Date;
  evaluatedById: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.drawWinner.updateMany({
      where: {
        campaignId: params.campaignId,
        prizeId: params.prizeId ?? null,
        deliveryStatus: { not: WinnerDeliveryStatus.REVERTED },
      },
      data: {
        deliveryStatus: WinnerDeliveryStatus.REVERTED,
        updatedById: params.evaluatedById,
      },
    });

    return tx.drawWinner.create({
      data: {
        campaignId: params.campaignId,
        prizeId: params.prizeId ?? null,
        orderId: params.orderId ?? null,
        sourceType: params.sourceType,
        winningNumber: params.winningNumber,
        evaluatedAt: params.evaluatedAt,
        evaluatedById: params.evaluatedById,
        deliveryStatus: params.orderId
          ? WinnerDeliveryStatus.PENDING_CONTACT
          : WinnerDeliveryStatus.UNCLAIMED,
      },
    });
  });
}

export async function markDrawWinnerReverted(params: {
  campaignId: string;
  prizeId?: string | null;
  actorId: string;
}) {
  await prisma.drawWinner.updateMany({
    where: {
      campaignId: params.campaignId,
      prizeId: params.prizeId ?? null,
      deliveryStatus: { not: WinnerDeliveryStatus.REVERTED },
    },
    data: {
      deliveryStatus: WinnerDeliveryStatus.REVERTED,
      updatedById: params.actorId,
    },
  });
}

export async function markDrawWinnerContacted(params: {
  campaignId: string;
  prizeId?: string | null;
  actorId: string;
}) {
  await prisma.drawWinner.updateMany({
    where: {
      campaignId: params.campaignId,
      prizeId: params.prizeId ?? null,
      deliveryStatus: WinnerDeliveryStatus.PENDING_CONTACT,
    },
    data: {
      deliveryStatus: WinnerDeliveryStatus.CONTACTED,
      contactedAt: new Date(),
      updatedById: params.actorId,
    },
  });
}

const winnerIdSchema = z.object({ id: z.string().min(1) });
const updateDeliverySchema = z.object({
  deliveryStatus: winnerDeliveryStatusSchema.refine(
    (s) => s !== WinnerDeliveryStatus.REVERTED,
    'Usá la acción de revertir evaluación para revertir un ganador.',
  ),
  deliveryNotes: z.string().trim().max(500).optional().nullable(),
});

export const adminWinnersRouter = Router();
adminWinnersRouter.use(requireAdminAuth);

adminWinnersRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaignId =
      typeof req.query.campaignId === 'string' && req.query.campaignId.trim()
        ? req.query.campaignId.trim()
        : undefined;
    const deliveryStatusParam =
      typeof req.query.deliveryStatus === 'string' && req.query.deliveryStatus.trim()
        ? req.query.deliveryStatus.trim()
        : undefined;
    const includeReverted = req.query.includeReverted === 'true';

    const parsedStatus = deliveryStatusParam
      ? winnerDeliveryStatusSchema.safeParse(deliveryStatusParam)
      : null;

    const winners = await prisma.drawWinner.findMany({
      where: {
        ...(campaignId ? { campaignId } : {}),
        ...(parsedStatus?.success
          ? { deliveryStatus: parsedStatus.data }
          : includeReverted
            ? {}
            : { deliveryStatus: { not: WinnerDeliveryStatus.REVERTED } }),
      },
      orderBy: { evaluatedAt: 'desc' },
      take: 100,
      include: {
        campaign: { select: { id: true, title: true, slug: true, drawReference: true } },
        prize: {
          select: {
            id: true,
            name: true,
            description: true,
            estimatedValue: true,
            drawReference: true,
          },
        },
        order: {
          select: {
            id: true,
            publicReference: true,
            totalAmount: true,
            customer: { select: { fullName: true, phone: true, email: true } },
          },
        },
      },
    });

    res.status(200).json({ success: true, data: { winners } });
  } catch (error) {
    next(error);
  }
});

adminWinnersRouter.patch(
  '/:id/delivery',
  validate({ params: winnerIdSchema, body: updateDeliverySchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.drawWinner.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        throw new NotFoundError('Registro de ganador no encontrado');
      }

      const data = req.body as z.infer<typeof updateDeliverySchema>;
      const now = new Date();
      const updated = await prisma.drawWinner.update({
        where: { id: existing.id },
        data: {
          deliveryStatus: data.deliveryStatus,
          ...(data.deliveryNotes !== undefined
            ? { deliveryNotes: data.deliveryNotes?.trim() || null }
            : {}),
          ...(data.deliveryStatus === WinnerDeliveryStatus.CONTACTED && !existing.contactedAt
            ? { contactedAt: now }
            : {}),
          ...(data.deliveryStatus === WinnerDeliveryStatus.DELIVERED
            ? {
                contactedAt: existing.contactedAt ?? now,
                deliveredAt: now,
              }
            : {}),
          updatedById: req.admin!.id,
        },
      });

      await recordAuditLog({
        actorId: req.admin!.id,
        action: 'WINNER_DELIVERY_UPDATED',
        entityType: 'DrawWinner',
        entityId: updated.id,
        metadata: {
          campaignId: updated.campaignId,
          prizeId: updated.prizeId,
          deliveryStatus: updated.deliveryStatus,
        },
      });

      res.status(200).json({ success: true, data: { winner: updated } });
    } catch (error) {
      next(error);
    }
  },
);
