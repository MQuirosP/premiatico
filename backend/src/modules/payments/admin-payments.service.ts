import { env } from '../../core/env.js';
import { ConflictError, NotFoundError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { prisma } from '../../core/prisma.js';
import { recordAuditLog } from '../audit/audit.service.js';
import {
  buildPaymentConfirmedEmailHtml,
  generateStampedChanceCards,
  type StampedChanceCard,
} from '../notifications/chance-card.service.js';
import { sendOrderNotification } from '../notifications/notifications.service.js';
import { getObjectBuffer, getSignedDownloadUrl } from '../storage/storage.service.js';

export async function listAdminPayments(statusFilter?: string) {
  const payments = await prisma.payment.findMany({
    where: statusFilter ? { status: statusFilter as never } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      order: {
        include: {
          customer: { select: { fullName: true, email: true, phone: true } },
          campaign: { select: { title: true, slug: true } },
          items: { select: { comboNameSnapshot: true, chanceQuantitySnapshot: true } },
          participations: {
            where: { status: { in: ['RESERVED', 'CONFIRMED'] } },
            orderBy: { number: 'asc' },
            select: { number: true, status: true },
          },
        },
      },
      proofs: true,
    },
  });

  return Promise.all(
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
}

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
            items: true,
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
      throw new ConflictError(`No se puede aprobar un pago en estado ${payment.status}`);
    }

    if (payment.order.status !== 'UNDER_REVIEW') {
      throw new ConflictError(`El pedido se encuentra en estado ${payment.order.status}`);
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
      confirmedAt: now,
    };
  });

  const allNumbers = (result.order.participations ?? []).map((p) => p.number);
  const orderItems = result.order.items ?? [];
  const passSnapshots = orderItems.flatMap((item) =>
    Array.isArray(item.passesSnapshotJson)
      ? (item.passesSnapshotJson as Array<{
          digitalPassId?: string;
          name?: string;
          fileKey?: string;
          mimeType?: string;
        }>)
      : [],
  );

  const digitalPassIds = [
    ...new Set(
      passSnapshots
        .map((p) => p.digitalPassId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const dbPasses =
    digitalPassIds.length > 0 && typeof prisma.digitalPass?.findMany === 'function'
      ? await prisma.digitalPass.findMany({
          where: { id: { in: digitalPassIds } },
          select: { id: true, name: true, fileKey: true, mimeType: true },
        })
      : [];

  const passLabel =
    dbPasses.map((p) => p.name).join(', ') ||
    passSnapshots
      .map((p) => p.name)
      .filter((name): name is string => Boolean(name))
      .join(', ') ||
    'tu pase digital';
  const totalPasses = orderItems.reduce(
    (sum, item) => sum + item.passQuantitySnapshot * item.quantity,
    0,
  );

  const imagePass =
    dbPasses.find((p) => p.mimeType.startsWith('image/')) ??
    passSnapshots.find(
      (p) =>
        p.fileKey &&
        (p.mimeType?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(p.fileKey)),
    );

  let cards: StampedChanceCard[] = [];
  if (env.RESEND_API_KEY && imagePass?.fileKey && allNumbers.length > 0) {
    try {
      const templateBuffer = await getObjectBuffer(imagePass.fileKey);
      cards = await generateStampedChanceCards({
        templateBuffer,
        numbers: allNumbers,
        maxCards: 25,
      });
    } catch (error) {
      logger.warn(
        { err: error, orderId: result.order.id, fileKey: imagePass.fileKey },
        'Could not generate stamped chance images from R2 template; using text badges fallback',
      );
    }
  }

  const corsOrigins = env.CORS_ORIGIN.split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const frontendBaseUrl =
    env.FRONTEND_URL?.replace(/\/+$/, '') ||
    corsOrigins.find((o) => o.includes('workers.dev')) ||
    corsOrigins[0] ||
    'http://localhost:3000';
  const orderLookupUrl = `${frontendBaseUrl}/pedido?ref=${encodeURIComponent(result.order.publicReference)}`;

  await sendOrderNotification({
    orderId: result.order.id,
    type: 'PAYMENT_CONFIRMED',
    recipientEmail: result.order.customer.email,
    subject: `Tus pases están listos — Pedido ${result.order.publicReference}`,
    html: buildPaymentConfirmedEmailHtml({
      customerName: result.order.customer.fullName,
      campaignTitle: result.order.campaign.title,
      publicReference: result.order.publicReference,
      confirmedAt: result.confirmedAt,
      passLabel,
      totalPasses,
      totalChances: allNumbers.length,
      orderLookupUrl,
      cards,
      allNumbers,
    }),
    attachments: cards.map((card) => ({
      filename: card.filename,
      content: card.base64,
      content_id: card.contentId,
    })),
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
      throw new ConflictError(`No se puede rechazar un pago en estado ${payment.status}`);
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
