import { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';

export interface CancelOrderParams {
  orderId?: string;
  publicReference?: string;
  partnerCode?: string;
  actorId?: string | null;
  reason?: string;
  auditAction: 'PARTNER_ORDER_CANCELLED' | 'ADMIN_ORDER_CANCELLED';
}

export interface CancelOrderResult {
  orderId: string;
  publicReference: string;
  status: 'CANCELLED';
}

export async function cancelOrderTransactional(
  params: CancelOrderParams,
): Promise<CancelOrderResult> {
  return prisma.$transaction(async (tx) => {
    const where: Prisma.OrderWhereUniqueInput = params.orderId
      ? { id: params.orderId }
      : { publicReference: params.publicReference! };

    const order = await tx.order.findUnique({
      where,
      include: {
        campaign: {
          select: { id: true, status: true },
        },
      },
    });

    if (params.partnerCode) {
      if (!order || order.channel !== 'PARTNER' || order.partnerCode !== params.partnerCode) {
        throw new NotFoundError('Orden de partner no encontrada');
      }
    } else if (!order) {
      throw new NotFoundError('Orden no encontrada');
    }

    if (order.status === 'CANCELLED') {
      return {
        orderId: order.id,
        publicReference: order.publicReference,
        status: 'CANCELLED' as const,
      };
    }

    if (order.campaign.status !== 'ACTIVE') {
      throw new ConflictError('No se puede anular: la campaña ya no está activa');
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED' },
    });

    await tx.participation.updateMany({
      where: {
        orderId: order.id,
        status: { in: ['RESERVED', 'CONFIRMED'] },
      },
      data: {
        status: 'RELEASED',
        reservedUntil: null,
      },
    });

    const fallbackReason = params.partnerCode
      ? `Anulado por ${params.partnerCode}`
      : 'Anulado desde panel administrativo';

    await tx.payment.updateMany({
      where: {
        orderId: order.id,
        status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] },
      },
      data: {
        status: 'REJECTED',
        rejectionReason: params.reason || fallbackReason,
      },
    });

    await tx.auditLog.create({
      data: {
        ...(params.actorId ? { actorId: params.actorId } : {}),
        action: params.auditAction,
        entityType: 'Order',
        entityId: order.id,
        metadata: {
          partnerCode: params.partnerCode ?? order.partnerCode ?? null,
          channel: order.channel,
          publicReference: order.publicReference,
          reason: params.reason ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      orderId: order.id,
      publicReference: order.publicReference,
      status: 'CANCELLED' as const,
    };
  });
}
