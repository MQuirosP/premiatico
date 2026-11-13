import crypto from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { generateStampedPassImage } from '../notifications/chance-card.service.js';
import { hashToken } from '../reservations/reservations.module.js';
import { getObjectBuffer, getSignedDownloadUrl } from '../storage/storage.service.js';
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
  const latestPayment = order.payments[0] ?? null;
  const passDownloads: Array<{ name: string; downloadUrl: string }> = [];
  if (order.status === 'CONFIRMED' && latestPayment?.status === 'APPROVED') {
    for (const item of order.items) {
      const snapshot = item.passesSnapshotJson as Array<{
        name: string;
        fileKey: string;
      }>;
      if (Array.isArray(snapshot)) {
        for (const p of snapshot) {
          const ext = path.posix.extname(p.fileKey);
          const baseName =
            ext && p.name.toLowerCase().endsWith(ext.toLowerCase())
              ? p.name.slice(0, -ext.length)
              : p.name;
          const downloadFileName = `${baseName}_${order.publicReference}${ext}`;
          const signed = await getSignedDownloadUrl({
            key: p.fileKey,
            expiresInSeconds: 600,
            downloadFileName,
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
      mimeType: item.digitalPass.mimeType,
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

export async function getStampedPassForPublicOrder(
  publicReference: string,
  chanceNumber?: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const order = await prisma.order.findUnique({
    where: { publicReference },
    include: publicOrderInclude,
  });

  if (!order) {
    throw new NotFoundError('Pedido no encontrado');
  }

  const latestPayment = order.payments[0] ?? null;
  if (order.status !== 'CONFIRMED' || latestPayment?.status !== 'APPROVED') {
    throw new ConflictError('El pase estará disponible cuando el pago sea aprobado');
  }

  if (chanceNumber) {
    const ownsChance = order.participations.some(
      (p) => p.status === 'CONFIRMED' && p.number === chanceNumber,
    );
    if (!ownsChance) {
      throw new NotFoundError('Chance no encontrado en este pedido');
    }
  }

  const passSnapshots = order.items.flatMap((item) =>
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
      passSnapshots.map((p) => p.digitalPassId).filter((id): id is string => Boolean(id)),
    ),
  ];

  const dbPasses =
    digitalPassIds.length > 0
      ? await prisma.digitalPass.findMany({
          where: { id: { in: digitalPassIds } },
          select: { id: true, name: true, fileKey: true, mimeType: true },
        })
      : [];

  const imagePass =
    dbPasses.find((p) => p.mimeType.startsWith('image/')) ??
    passSnapshots.find(
      (p) =>
        p.fileKey &&
        (p.mimeType?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(p.fileKey)),
    );

  if (!imagePass?.fileKey) {
    throw new NotFoundError('Este pedido no tiene un pase de imagen configurable');
  }

  const templateBuffer = await getObjectBuffer(imagePass.fileKey);
  const stampText = chanceNumber || order.publicReference;
  const buffer = await generateStampedPassImage({
    templateBuffer,
    text: stampText,
  });

  const safeLabel = (imagePass.name || 'Pase').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const filename = chanceNumber
    ? `${safeLabel}_${order.publicReference}_${chanceNumber}.png`
    : `${safeLabel}_${order.publicReference}.png`;

  return { buffer, filename };
}
