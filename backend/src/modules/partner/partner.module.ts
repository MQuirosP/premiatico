import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { env } from '../../core/env.js';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import {
  allocateRandomNumbers,
  getCampaignNumberDigits,
  releaseExpiredReservations,
} from '../chances/chances.service.js';
import { sendRichOrderEmail } from '../notifications/chance-card.service.js';
import { hashToken } from '../reservations/reservations.module.js';

const createPartnerOrderSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  campaignId: z.string().trim().min(1),
  comboId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(10).default(1),
  includeInverse: z.boolean().optional().default(false),
  customer: z.object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(30),
    email: z.string().trim().email().nullable().optional(),
  }),
  externalContext: z.object({
    bancaId: z.string().trim().min(1).max(100),
    ventanaId: z.string().trim().max(100).nullable().optional(),
    sellerId: z.string().trim().min(1).max(100),
    sellerName: z.string().trim().min(1).max(120),
  }),
});

const cancelPartnerOrderSchema = z.object({
  reason: z.string().trim().max(250).optional(),
  cancelledById: z.string().trim().max(100).optional(),
});

function generatePublicReference(): string {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `PRM-${code}`;
}

function buildTrackingUrl(publicReference: string, accessToken: string): string {
  const baseUrl = (env.FRONTEND_URL ?? 'https://premiatico.mquirosp78.workers.dev').replace(/\/$/, '');
  return `${baseUrl}/pedido?ref=${encodeURIComponent(publicReference)}&token=${encodeURIComponent(accessToken)}`;
}

export const partnerRouter = Router();

partnerRouter.get(
  '/campaigns',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const campaigns = await prisma.campaign.findMany({
        where: {
          status: 'ACTIVE',
          startAt: { lte: now },
          endAt: { gt: now },
        },
        orderBy: { endAt: 'asc' },
        include: {
          combos: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              passQuantity: true,
              chanceQuantity: true,
              badgeLabel: true,
            },
          },
        },
      });

      const enriched = await Promise.all(
        campaigns.map(async (campaign) => {
          const occupied = await prisma.participation.count({
            where: {
              campaignId: campaign.id,
              status: { in: ['RESERVED', 'CONFIRMED'] },
            },
          });
          return {
            id: campaign.id,
            slug: campaign.slug,
            title: campaign.title,
            drawAt: campaign.drawAt,
            drawReference: campaign.drawReference,
            totalChances: campaign.totalChances,
            digits: getCampaignNumberDigits(campaign.totalChances),
            enableInverseNumbers: campaign.enableInverseNumbers,
            remainingChances: Math.max(0, campaign.totalChances - occupied),
            combos: campaign.combos,
          };
        }),
      );

      res.status(200).json({
        success: true,
        data: enriched,
      });
    } catch (err) {
      next(err);
    }
  },
);

partnerRouter.post(
  '/orders',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createPartnerOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        const detail = parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(' | ');
        throw new ValidationError(
          detail ? `Datos de orden inválidos: ${detail}` : 'Datos de orden inválidos',
          parsed.error.flatten(),
        );
      }

      const partnerCode = req.partnerCode!;
      const input = parsed.data;
      const normalizedPhone = input.customer.phone.replace(/\s+/g, '');
      const normalizedEmail = input.customer.email ? input.customer.email.toLowerCase() : null;

      // 1. Idempotency check before locking
      const existingOrder = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: {
          campaign: {
            select: { id: true, title: true, drawAt: true, totalChances: true },
          },
          items: true,
          participations: {
            where: { status: { in: ['RESERVED', 'CONFIRMED'] } },
            orderBy: { number: 'asc' },
            select: { number: true },
          },
        },
      });

      if (existingOrder) {
        if (existingOrder.partnerCode !== partnerCode) {
          throw new ConflictError('La clave de idempotencia pertenece a otro canal');
        }

        const freshAccessToken = crypto.randomBytes(24).toString('hex');
        await prisma.order.update({
          where: { id: existingOrder.id },
          data: { accessTokenHash: hashToken(freshAccessToken) },
        });

        const firstItem = existingOrder.items[0];
        res.status(200).json({
          success: true,
          data: {
            orderId: existingOrder.id,
            publicReference: existingOrder.publicReference,
            accessToken: freshAccessToken,
            trackingUrl: buildTrackingUrl(existingOrder.publicReference, freshAccessToken),
            campaign: {
              id: existingOrder.campaign.id,
              title: existingOrder.campaign.title,
              drawAt: existingOrder.campaign.drawAt,
              totalChances: existingOrder.campaign.totalChances,
              digits: getCampaignNumberDigits(existingOrder.campaign.totalChances),
            },
            combo: {
              id: firstItem?.comboId ?? input.comboId,
              name: firstItem?.comboNameSnapshot ?? 'Combo',
              totalAmount: existingOrder.totalAmount,
            },
            numbers: existingOrder.participations.map((p) => p.number),
            confirmedAt: existingOrder.confirmedAt,
            idempotentReplay: true,
          },
        });
        return;
      }

      const rawAccessToken = crypto.randomBytes(24).toString('hex');
      const accessTokenHash = hashToken(rawAccessToken);
      const now = new Date();

      const created = await prisma.$transaction(async (tx) => {
        await releaseExpiredReservations(input.campaignId, tx);

        // Lock campaign row to serialize concurrent number allocations
        await tx.$executeRaw`SELECT id FROM "Campaign" WHERE id = ${input.campaignId} FOR UPDATE`;

        const campaign = await tx.campaign.findUnique({
          where: { id: input.campaignId },
        });
        if (!campaign) {
          throw new NotFoundError('Campaña no encontrada');
        }
        if (campaign.status !== 'ACTIVE' || campaign.startAt > now || campaign.endAt <= now) {
          throw new ConflictError('La campaña no está activa para ventas en este momento');
        }

        const combo = await tx.campaignCombo.findFirst({
          where: {
            id: input.comboId,
            campaignId: campaign.id,
            isActive: true,
          },
          include: {
            passItems: {
              include: {
                digitalPass: true,
              },
            },
          },
        });
        if (!combo) {
          throw new NotFoundError('Combo no encontrado o inactivo para esta campaña');
        }

        const applyInverse = Boolean(input.includeInverse && campaign.enableInverseNumbers);
        const packageCount = applyInverse ? input.quantity * 2 : input.quantity;
        const totalChancesToAssign = combo.chanceQuantity * packageCount;
        const totalPasses = combo.passQuantity * packageCount;
        const totalAmount = combo.price * packageCount;

        let customer = await tx.customer.findFirst({
          where: normalizedEmail
            ? { phone: normalizedPhone, email: normalizedEmail }
            : { phone: normalizedPhone },
        });
        if (!customer) {
          customer = await tx.customer.create({
            data: {
              fullName: input.customer.fullName,
              phone: normalizedPhone,
              email: normalizedEmail,
            },
          });
        }

        const passesSnapshot = combo.passItems.map((item) => ({
          digitalPassId: item.digitalPass.id,
          name: item.digitalPass.name,
          fileKey: item.digitalPass.fileKey,
          mimeType: item.digitalPass.mimeType,
          quantity: item.quantity * packageCount,
        }));

        const order = await tx.order.create({
          data: {
            publicReference: generatePublicReference(),
            accessTokenHash,
            customerId: customer.id,
            campaignId: campaign.id,
            channel: 'PARTNER',
            partnerCode,
            idempotencyKey: input.idempotencyKey,
            externalBancaId: input.externalContext.bancaId,
            externalVentanaId: input.externalContext.ventanaId ?? null,
            externalSellerId: input.externalContext.sellerId,
            externalSellerName: input.externalContext.sellerName,
            status: 'CONFIRMED',
            totalAmount,
            expiresAt: now,
            confirmedAt: now,
            items: {
              create: {
                comboId: combo.id,
                comboNameSnapshot: combo.name,
                quantity: packageCount,
                unitPrice: combo.price,
                passQuantitySnapshot: totalPasses,
                chanceQuantitySnapshot: totalChancesToAssign,
                totalPrice: totalAmount,
                passesSnapshotJson: passesSnapshot as Prisma.InputJsonValue,
              },
            },
            payments: {
              create: {
                method: 'PARTNER_POS',
                amount: totalAmount,
                status: 'APPROVED',
                reviewedAt: now,
                reviewNotes: `Venta POS ${partnerCode} (${input.externalContext.sellerName})`,
              },
            },
          },
          include: {
            items: {
              select: {
                passQuantitySnapshot: true,
                quantity: true,
                passesSnapshotJson: true,
              },
            },
          },
        });

        let assignedNumbers: string[];
        if (applyInverse) {
          const baseQuantity = combo.chanceQuantity * input.quantity;
          const baseNumbers = await allocateRandomNumbers({
            tx,
            campaignId: campaign.id,
            totalChances: campaign.totalChances,
            quantity: baseQuantity,
            orderId: order.id,
            status: 'CONFIRMED',
            confirmedAt: now,
          });

          const seedNumber = baseNumbers[0];
          const extraExclude = new Set<string>(baseNumbers);
          const inverseNumber = seedNumber ? seedNumber.split('').reverse().join('') : null;

          if (inverseNumber && seedNumber && inverseNumber !== seedNumber) {
            const existingInverse = await tx.participation.findFirst({
              where: {
                campaignId: campaign.id,
                number: inverseNumber,
                status: { in: ['RESERVED', 'CONFIRMED'] },
              },
            });
            if (!existingInverse) {
              await tx.participation.create({
                data: {
                  campaignId: campaign.id,
                  orderId: order.id,
                  number: inverseNumber,
                  status: 'CONFIRMED',
                  confirmedAt: now,
                },
              });
              extraExclude.add(inverseNumber);
              const remaining = Math.max(0, totalChancesToAssign - baseNumbers.length - 1);
              const extraNumbers =
                remaining > 0
                  ? await allocateRandomNumbers({
                      tx,
                      campaignId: campaign.id,
                      totalChances: campaign.totalChances,
                      quantity: remaining,
                      orderId: order.id,
                      status: 'CONFIRMED',
                      confirmedAt: now,
                      excludeNumbers: extraExclude,
                    })
                  : [];
              assignedNumbers = [...baseNumbers, inverseNumber, ...extraNumbers].sort();
            } else {
              const extraNumbers = await allocateRandomNumbers({
                tx,
                campaignId: campaign.id,
                totalChances: campaign.totalChances,
                quantity: totalChancesToAssign - baseNumbers.length,
                orderId: order.id,
                status: 'CONFIRMED',
                confirmedAt: now,
                excludeNumbers: extraExclude,
              });
              assignedNumbers = [...baseNumbers, ...extraNumbers].sort();
            }
          } else {
            const extraNumbers = await allocateRandomNumbers({
              tx,
              campaignId: campaign.id,
              totalChances: campaign.totalChances,
              quantity: totalChancesToAssign - baseNumbers.length,
              orderId: order.id,
              status: 'CONFIRMED',
              confirmedAt: now,
              excludeNumbers: extraExclude,
            });
            assignedNumbers = [...baseNumbers, ...extraNumbers].sort();
          }
        } else {
          assignedNumbers = await allocateRandomNumbers({
            tx,
            campaignId: campaign.id,
            totalChances: campaign.totalChances,
            quantity: totalChancesToAssign,
            orderId: order.id,
            status: 'CONFIRMED',
            confirmedAt: now,
          });
        }

        await tx.auditLog.create({
          data: {
            action: 'PARTNER_ORDER_CREATED',
            entityType: 'Order',
            entityId: order.id,
            metadata: {
              partnerCode,
              publicReference: order.publicReference,
              externalContext: input.externalContext,
              numbersCount: assignedNumbers.length,
            } as Prisma.InputJsonValue,
          },
        });

        return {
          order,
          campaign,
          combo,
          customer,
          assignedNumbers,
        };
      });

      if (created.customer.email) {
        sendRichOrderEmail({
          order: {
            id: created.order.id,
            publicReference: created.order.publicReference,
            totalAmount: created.order.totalAmount,
            customer: {
              fullName: created.customer.fullName,
              email: created.customer.email,
            },
            campaign: { title: created.campaign.title },
            items: created.order.items,
            participations: created.assignedNumbers.map((number) => ({ number })),
          },
          type: 'PAYMENT_CONFIRMED',
          eventDate: created.order.confirmedAt ?? now,
        }).catch(() => {});
      }

      res.status(201).json({
        success: true,
        data: {
          orderId: created.order.id,
          publicReference: created.order.publicReference,
          accessToken: rawAccessToken,
          trackingUrl: buildTrackingUrl(created.order.publicReference, rawAccessToken),
          campaign: {
            id: created.campaign.id,
            title: created.campaign.title,
            drawAt: created.campaign.drawAt,
            totalChances: created.campaign.totalChances,
            digits: getCampaignNumberDigits(created.campaign.totalChances),
          },
          combo: {
            id: created.combo.id,
            name: created.combo.name,
            totalAmount: created.order.totalAmount,
          },
          numbers: created.assignedNumbers,
          confirmedAt: created.order.confirmedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

partnerRouter.post(
  '/orders/:publicReference/cancel',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const publicReference = String(req.params.publicReference ?? '').trim().toUpperCase();
      const parsed = cancelPartnerOrderSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new ValidationError('Datos de anulación inválidos', parsed.error.flatten());
      }

      const partnerCode = req.partnerCode!;

      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { publicReference },
          include: {
            campaign: {
              select: { id: true, status: true },
            },
          },
        });

        if (!order || order.channel !== 'PARTNER' || order.partnerCode !== partnerCode) {
          throw new NotFoundError('Orden de partner no encontrada');
        }

        if (order.status === 'CANCELLED') {
          return { orderId: order.id, publicReference: order.publicReference, status: order.status };
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

        await tx.payment.updateMany({
          where: {
            orderId: order.id,
            status: 'APPROVED',
          },
          data: {
            status: 'REJECTED',
            rejectionReason: parsed.data.reason ?? `Anulado por ${partnerCode}`,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'PARTNER_ORDER_CANCELLED',
            entityType: 'Order',
            entityId: order.id,
            metadata: {
              partnerCode,
              publicReference: order.publicReference,
              reason: parsed.data.reason ?? null,
              cancelledById: parsed.data.cancelledById ?? null,
            } as Prisma.InputJsonValue,
          },
        });

        return {
          orderId: order.id,
          publicReference: order.publicReference,
          status: 'CANCELLED' as const,
        };
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
);
