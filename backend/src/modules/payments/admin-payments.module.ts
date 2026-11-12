import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { ConflictError, NotFoundError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';
import { validate } from '../../middlewares/validate.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { sendOrderNotification } from '../notifications/notifications.service.js';
import { getSignedDownloadUrl } from '../storage/storage.service.js';

const paymentIdParamSchema = z.object({ id: z.string().min(1) });

const approvePaymentSchema = z.object({
  reviewNotes: z.string().trim().max(500).optional(),
});

const rejectPaymentSchema = z.object({
  rejectionReason: z.string().trim().min(5).max(300),
  reviewNotes: z.string().trim().max(500).optional(),
});

export async function approvePayment(params: {
  paymentId: string;
  adminId: string;
  reviewNotes?: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${params.paymentId} FOR UPDATE`;

    const payment = await tx.payment.findUnique({
      where: { id: params.paymentId },
      include: {
        order: {
          include: {
            customer: true,
            campaign: true,
            participations: {
              where: { status: 'RESERVED' },
              orderBy: { number: 'asc' },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Pago no encontrado');
    }

    if (payment.status !== 'UNDER_REVIEW') {
      throw new ConflictError(
        `No se puede aprobar un pago en estado ${payment.status}`,
      );
    }

    if (payment.order.status !== 'UNDER_REVIEW') {
      throw new ConflictError(
        `El pedido se encuentra en estado ${payment.order.status}`,
      );
    }

    const now = new Date();

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'APPROVED',
        reviewedById: params.adminId,
        reviewedAt: now,
        reviewNotes: params.reviewNotes ?? null,
      },
    });

    await tx.order.update({
      where: { id: payment.order.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: now,
      },
    });

    await tx.participation.updateMany({
      where: {
        orderId: payment.order.id,
        status: 'RESERVED',
      },
      data: {
        status: 'CONFIRMED',
        confirmedAt: now,
        reservedUntil: null,
      },
    });

    await recordAuditLog(
      {
        actorId: params.adminId,
        action: 'PAYMENT_APPROVED',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: {
          orderId: payment.order.id,
          publicReference: payment.order.publicReference,
          amount: payment.amount,
        },
      },
      tx,
    );

    return {
      payment: updatedPayment,
      order: payment.order,
    };
  });

  const numbersList = result.order.participations.map((p) => p.number).join(', ');
  await sendOrderNotification({
    orderId: result.order.id,
    type: 'PAYMENT_CONFIRMED',
    recipientEmail: result.order.customer.email,
    subject: `¡Tu compra fue confirmada! — Pedido ${result.order.publicReference}`,
    html: `<p>¡Hola ${result.order.customer.fullName}!</p>
      <p>Tu pago para la campaña <strong>${result.order.campaign.title}</strong> fue confirmado.</p>
      <p><strong>Referencia:</strong> ${result.order.publicReference}</p>
      <p><strong>Tus chances confirmados:</strong> ${numbersList}</p>
      <p>Podés descargar tus pases digitales desde el enlace de consulta de tu pedido en Premiático.</p>`,
  });

  return result.payment;
}

export async function rejectPayment(params: {
  paymentId: string;
  adminId: string;
  rejectionReason: string;
  reviewNotes?: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${params.paymentId} FOR UPDATE`;

    const payment = await tx.payment.findUnique({
      where: { id: params.paymentId },
      include: {
        order: {
          include: {
            customer: true,
            campaign: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Pago no encontrado');
    }

    if (payment.status !== 'UNDER_REVIEW' && payment.status !== 'PENDING') {
      throw new ConflictError(
        `No se puede rechazar un pago en estado ${payment.status}`,
      );
    }

    const now = new Date();

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'REJECTED',
        reviewedById: params.adminId,
        reviewedAt: now,
        rejectionReason: params.rejectionReason,
        reviewNotes: params.reviewNotes ?? null,
      },
    });

    await tx.order.update({
      where: { id: payment.order.id },
      data: {
        status: 'REJECTED',
      },
    });

    await tx.participation.updateMany({
      where: {
        orderId: payment.order.id,
        status: 'RESERVED',
      },
      data: {
        status: 'RELEASED',
        reservedUntil: null,
      },
    });

    await recordAuditLog(
      {
        actorId: params.adminId,
        action: 'PAYMENT_REJECTED',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: {
          orderId: payment.order.id,
          publicReference: payment.order.publicReference,
          reason: params.rejectionReason,
        },
      },
      tx,
    );

    return {
      payment: updatedPayment,
      order: payment.order,
    };
  });

  await sendOrderNotification({
    orderId: result.order.id,
    type: 'PAYMENT_REJECTED',
    recipientEmail: result.order.customer.email,
    subject: `Actualización de tu pedido ${result.order.publicReference} — Premiático`,
    html: `<p>Hola ${result.order.customer.fullName},</p>
      <p>No pudimos confirmar tu pago para el pedido <strong>${result.order.publicReference}</strong>.</p>
      <p><strong>Motivo:</strong> ${params.rejectionReason}</p>
      <p>Los chances asociados fueron liberados. Si creés que hubo un error, contactanos para ayudarte.</p>`,
  });

  return result.payment;
}

export const adminPaymentsRouter = Router();
adminPaymentsRouter.use(requireAdminAuth);

adminPaymentsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
    const payments = await prisma.payment.findMany({
      where: statusFilter ? { status: statusFilter as never } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        order: {
          include: {
            customer: { select: { fullName: true, email: true, phone: true } },
            campaign: { select: { title: true, slug: true } },
          },
        },
        proofs: true,
      },
    });

    const enriched = await Promise.all(
      payments.map(async (p) => ({
        ...p,
        proofs: await Promise.all(
          p.proofs.map(async (proof) => {
            const signed = await getSignedDownloadUrl({
              key: proof.storageKey,
              expiresInSeconds: 300,
            }).catch(() => null);
            return {
              ...proof,
              signedUrl: signed?.downloadUrl ?? null,
            };
          }),
        ),
      })),
    );

    res.status(200).json({ success: true, data: { payments: enriched } });
  } catch (error) {
    next(error);
  }
});

adminPaymentsRouter.post(
  '/:id/approve',
  validate({ params: paymentIdParamSchema, body: approvePaymentSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { reviewNotes } = req.body as z.infer<typeof approvePaymentSchema>;
      const payment = await approvePayment({
        paymentId: req.params.id,
        adminId: req.admin!.id,
        reviewNotes,
      });
      res.status(200).json({ success: true, data: { payment } });
    } catch (error) {
      next(error);
    }
  },
);

adminPaymentsRouter.post(
  '/:id/reject',
  validate({ params: paymentIdParamSchema, body: rejectPaymentSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { rejectionReason, reviewNotes } = req.body as z.infer<typeof rejectPaymentSchema>;
      const payment = await rejectPayment({
        paymentId: req.params.id,
        adminId: req.admin!.id,
        rejectionReason,
        reviewNotes,
      });
      res.status(200).json({ success: true, data: { payment } });
    } catch (error) {
      next(error);
    }
  },
);
