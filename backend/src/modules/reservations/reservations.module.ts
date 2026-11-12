import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { validate } from '../../middlewares/validate.js';
import { allocateRandomNumbers, releaseExpiredReservations } from '../chances/chances.service.js';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const createReservationSchema = z.object({
  campaignId: z.string().min(1),
  comboId: z.string().min(1),
});

const regenerateSchema = z.object({
  sessionToken: z.string().min(16),
});

const sessionIdParamSchema = z.object({
  id: z.string().min(1),
});

export async function createReservationSession(input: {
  campaignId: string;
  comboId: string;
}) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  return prisma.$transaction(async (tx) => {
    await releaseExpiredReservations(input.campaignId, tx);

    // Serialize capacity checks per campaign
    await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${input.campaignId} FOR UPDATE`;

    const campaign = await tx.campaign.findUnique({
      where: { id: input.campaignId },
    });

    if (!campaign || campaign.status !== 'ACTIVE' || campaign.endAt <= new Date()) {
      throw new ConflictError('La campaña no está activa para reservas');
    }

    const combo = await tx.campaignCombo.findFirst({
      where: {
        id: input.comboId,
        campaignId: input.campaignId,
        isActive: true,
      },
    });

    if (!combo) {
      throw new NotFoundError('Combo no encontrado o inactivo');
    }

    const expiresAt = new Date(Date.now() + campaign.reservationMinutes * 60_000);

    const session = await tx.reservationSession.create({
      data: {
        campaignId: campaign.id,
        comboId: combo.id,
        sessionTokenHash: tokenHash,
        regenerationCount: 0,
        expiresAt,
        status: 'ACTIVE',
      },
    });

    const numbers = await allocateRandomNumbers({
      tx,
      campaignId: campaign.id,
      totalChances: campaign.totalChances,
      quantity: combo.chanceQuantity,
      reservationSessionId: session.id,
      reservedUntil: expiresAt,
    });

    return {
      sessionId: session.id,
      sessionToken: rawToken,
      campaignId: campaign.id,
      comboId: combo.id,
      comboName: combo.name,
      price: combo.price,
      passQuantity: combo.passQuantity,
      chanceQuantity: combo.chanceQuantity,
      numbers,
      regenerationCount: 0,
      maxNumberChanges: campaign.maxNumberChanges,
      remainingChanges: campaign.maxNumberChanges,
      expiresAt,
    };
  });
}

export async function regenerateReservationNumbers(input: {
  sessionId: string;
  sessionToken: string;
}) {
  const tokenHash = hashToken(input.sessionToken);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ReservationSession" WHERE id = ${input.sessionId} FOR UPDATE`;

    const session = await tx.reservationSession.findUnique({
      where: { id: input.sessionId },
      include: {
        campaign: true,
        combo: true,
      },
    });

    if (!session) {
      throw new NotFoundError('Sesión de reserva no encontrada');
    }

    if (session.sessionTokenHash !== tokenHash) {
      throw new UnauthorizedError('Token de sesión inválido');
    }

    if (session.status !== 'ACTIVE' || session.expiresAt <= new Date()) {
      throw new ConflictError('La sesión de reserva ha expirado o ya fue utilizada');
    }

    if (session.campaign.status !== 'ACTIVE') {
      throw new ConflictError('La campaña ya no está activa');
    }

    if (session.regenerationCount >= session.campaign.maxNumberChanges) {
      throw new ConflictError(
        `Alcanzaste el límite de ${session.campaign.maxNumberChanges} cambios de números`,
      );
    }

    await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${session.campaignId} FOR UPDATE`;

    const currentRows = await tx.participation.findMany({
      where: {
        reservationSessionId: session.id,
        status: 'RESERVED',
      },
      select: { number: true },
    });
    const previousNumbers = new Set(currentRows.map((r) => r.number));

    await tx.participation.updateMany({
      where: {
        reservationSessionId: session.id,
        status: 'RESERVED',
      },
      data: {
        status: 'RELEASED',
        reservedUntil: null,
      },
    });

    const nextRegenCount = session.regenerationCount + 1;
    await tx.reservationSession.update({
      where: { id: session.id },
      data: { regenerationCount: nextRegenCount },
    });

    const numbers = await allocateRandomNumbers({
      tx,
      campaignId: session.campaignId,
      totalChances: session.campaign.totalChances,
      quantity: session.combo.chanceQuantity,
      reservationSessionId: session.id,
      reservedUntil: session.expiresAt,
      excludeNumbers: previousNumbers,
    });

    return {
      sessionId: session.id,
      numbers,
      regenerationCount: nextRegenCount,
      maxNumberChanges: session.campaign.maxNumberChanges,
      remainingChanges: Math.max(0, session.campaign.maxNumberChanges - nextRegenCount),
      expiresAt: session.expiresAt,
    };
  });
}

export const publicReservationsRouter = Router();

publicReservationsRouter.post(
  '/',
  validate({ body: createReservationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body as z.infer<typeof createReservationSchema>;
      const reservation = await createReservationSession(data);
      res.status(201).json({ success: true, data: reservation });
    } catch (error) {
      next(error);
    }
  },
);

publicReservationsRouter.post(
  '/:id/regenerate',
  validate({ params: sessionIdParamSchema, body: regenerateSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { sessionToken } = req.body as z.infer<typeof regenerateSchema>;
      const result = await regenerateReservationNumbers({
        sessionId: req.params.id,
        sessionToken,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);
