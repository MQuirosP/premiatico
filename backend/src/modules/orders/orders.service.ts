import crypto from 'node:crypto';
import { z } from 'zod';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { hashToken } from '../reservations/reservations.module.js';
import { getSignedDownloadUrl } from '../storage/storage.service.js';
import type { createOrderSchema } from './orders.schema.js';

function generatePublicReference(): string {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `PRM-${code}`;
}

const publicOrderInclude = {
  campaign: { select: { id: true, title: true, slug: true } },
  items: true,
  participations: {
    where: { status: { in: ['RESERVED' as const, 'CONFIRMED' as const] } },
    orderBy: { number: 'asc' as const },
    select: { number: true, status: true },
  },
  payments: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      method: true,
      amount: true,
      status: true,
      rejectionReason: true,
    },
  },
};

async function formatPublicOrder(order: {
  publicReference: string;
  status: string;
  totalAmount: number;
  expiresAt: Date;
  confirmedAt: Date | null;
  campaign: { id: string; title: string; slug: string };
  items: Array<{
    comboNameSnapshot: string;
    passQuantitySnapshot: number;
    chanceQuantitySnapshot: number;
    totalPrice: number;
    passesSnapshotJson: unknown;
  }>;
  participations: Array<{ number: string; status: string }>;
  payments: Array<{
    id: string;
    method: string;
    amount: number;
    status: string;
    rejectionReason: string | null;
  }>;
}) {
  const passDownloads: Array<{ name: string; downloadUrl: string }> = [];
  if (order.status === 'CONFIRMED') {
    for (const item of order.items) {
      const snapshot = item.passesSnapshotJson as Array<{
        name: string;
        fileKey: string;
      }>;
      if (Array.isArray(snapshot)) {
        for (const p of snapshot) {
          const signed = await getSignedDownloadUrl({
            key: p.fileKey,
            expiresInSeconds: 600,
            downloadFileName: p.name,
          }).catch(() => null);
          if (signed) {
            passDownloads.push({ name: p.name, downloadUrl: signed.downloadUrl });
          }
        }
      }
    }
  }

  return {
    publicReference: order.publicReference,
    status: order.status,
    totalAmount: order.totalAmount,
    expiresAt: order.expiresAt,
    confirmedAt: order.confirmedAt,
    campaign: order.campaign,
    items: order.items.map((i) => ({
      comboName: i.comboNameSnapshot,
      passQuantity: i.passQuantitySnapshot,
      chanceQuantity: i.chanceQuantitySnapshot,
      totalPrice: i.totalPrice,
    })),
    chances: order.participations,
    payment: order.payments[0] ?? null,
    passDownloads,
  };
}

export async function createOrderFromSession(input: z.infer<typeof createOrderSchema>) {
  const sessionTokenHash = hashToken(input.sessionToken);
  const rawAccessToken = crypto.randomBytes(24).toString('hex');
  const accessTokenHash = hashToken(rawAccessToken);
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.trim();
  const normalizedName = input.fullName.trim();

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ReservationSession" WHERE id = ${input.sessionId} FOR UPDATE`;

    const session = await tx.reservationSession.findUnique({
      where: { id: input.sessionId },
      include: {
        campaign: true,
        combo: {
          include: {
            passItems: {
              include: { digitalPass: true },
            },
          },
        },
        order: true,
      },
    });

    if (!session) {
      throw new NotFoundError('Sesión de reserva no encontrada');
    }
    if (session.sessionTokenHash !== sessionTokenHash) {
      throw new UnauthorizedError('Token de sesión inválido');
    }
    if (session.order) {
      throw new ConflictError('Esta sesión de reserva ya generó un pedido');
    }
    if (session.status !== 'ACTIVE' || session.expiresAt <= new Date()) {
      throw new ConflictError('La sesión de reserva ha expirado');
    }
    if (session.campaign.status !== 'ACTIVE' || session.campaign.endAt <= new Date()) {
      throw new ConflictError('La campaña ya no está disponible para compras');
    }

    const participations = await tx.participation.findMany({
      where: {
        reservationSessionId: session.id,
        status: 'RESERVED',
      },
      orderBy: { number: 'asc' },
    });

    if (participations.length !== session.combo.chanceQuantity) {
      throw new ConflictError('Los chances reservados no coinciden con el combo seleccionado');
    }

    let customer = await tx.customer.findFirst({
      where: { email: normalizedEmail, phone: normalizedPhone },
    });

    if (!customer) {
      customer = await tx.customer.create({
        data: {
          fullName: normalizedName,
          email: normalizedEmail,
          phone: normalizedPhone,
        },
      });
    }

    const orderExpiresAt = new Date(
      Date.now() + session.campaign.paymentWindowMinutes * 60_000,
    );

    const passesSnapshot = session.combo.passItems.map((item) => ({
      digitalPassId: item.digitalPass.id,
      name: item.digitalPass.name,
      fileKey: item.digitalPass.fileKey,
      quantity: item.quantity,
    }));

    const order = await tx.order.create({
      data: {
        publicReference: generatePublicReference(),
        accessTokenHash,
        customerId: customer.id,
        campaignId: session.campaignId,
        reservationSessionId: session.id,
        status: 'PENDING_PAYMENT',
        totalAmount: session.combo.price,
        expiresAt: orderExpiresAt,
        items: {
          create: {
            comboId: session.combo.id,
            comboNameSnapshot: session.combo.name,
            quantity: 1,
            unitPrice: session.combo.price,
            passQuantitySnapshot: session.combo.passQuantity,
            chanceQuantitySnapshot: session.combo.chanceQuantity,
            totalPrice: session.combo.price,
            passesSnapshotJson: passesSnapshot,
          },
        },
        payments: {
          create: {
            method: 'SINPE_MOVIL',
            amount: session.combo.price,
            status: 'PENDING',
          },
        },
      },
      include: {
        items: true,
        payments: true,
        campaign: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    await tx.reservationSession.update({
      where: { id: session.id },
      data: { status: 'CONVERTED' },
    });

    await tx.participation.updateMany({
      where: {
        reservationSessionId: session.id,
        status: 'RESERVED',
      },
      data: {
        orderId: order.id,
        reservedUntil: orderExpiresAt,
      },
    });

    return {
      orderId: order.id,
      publicReference: order.publicReference,
      accessToken: rawAccessToken,
      status: order.status,
      totalAmount: order.totalAmount,
      expiresAt: order.expiresAt,
      campaign: order.campaign,
      numbers: participations.map((p) => p.number),
      sinpeInstructions: {
        method: 'SINPE Móvil',
        amount: order.totalAmount,
        referenceNote: order.publicReference,
        instructions:
          'Realizá la transferencia SINPE Móvil por el monto exacto indicando tu referencia de pedido y adjuntá el comprobante antes del vencimiento.',
      },
    };
  });
}

export async function getPublicOrderByReference(publicReference: string, accessToken: string) {
  const tokenHash = hashToken(accessToken);

  const order = await prisma.order.findUnique({
    where: { publicReference },
    include: publicOrderInclude,
  });

  if (!order || order.accessTokenHash !== tokenHash) {
    // Anti-enumeration: identical error for missing order or invalid token
    throw new NotFoundError('Pedido no encontrado');
  }

  return formatPublicOrder(order);
}

export async function lookupPublicOrdersByCustomer(identifier: string) {
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes('@');
  const now = new Date();

  const customerWhere = isEmail
    ? { email: z.string().email('Correo electrónico inválido').toLowerCase().parse(trimmed) }
    : {
        phone: z
          .string()
          .regex(/^[0-9+\-\s]{8,20}$/, 'Teléfono inválido (formato Costa Rica: 8 dígitos)')
          .parse(trimmed),
      };

  const orders = await prisma.order.findMany({
    where: {
      customer: customerWhere,
      campaign: {
        status: 'ACTIVE',
        endAt: { gt: now },
        OR: [{ drawAt: null }, { drawAt: { gt: now } }],
      },
    },
    orderBy: { createdAt: 'desc' },
    include: publicOrderInclude,
  });

  return Promise.all(orders.map((order) => formatPublicOrder(order)));
}
