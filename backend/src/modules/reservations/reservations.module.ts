import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { validate } from '../../middlewares/validate.js';
import { allocateRandomNumbers, releaseExpiredReservations } from '../fichas/fichas.service.js';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface InverseOffer {
  sourceNumber: string;
  inverseNumber: string;
}

export interface InverseAddition {
  sourceNumber: string;
  inverseNumber: string;
}

function reverseNumberString(num: string): string {
  return num.split('').reverse().join('');
}

async function computeAvailableInverses(params: {
  tx: Prisma.TransactionClient;
  campaignId: string;
  totalFichas: number;
  enableInverseNumbers: boolean;
  numbers: string[];
}): Promise<InverseOffer[]> {
  const { tx, campaignId, totalFichas, enableInverseNumbers, numbers } = params;
  if (!enableInverseNumbers || numbers.length === 0) {
    return [];
  }

  const maxPool = Math.min(100000, Math.max(10, totalFichas));
  const ownSet = new Set(numbers);
  const candidates: InverseOffer[] = [];
  const seenInverses = new Set<string>();

  for (const sourceNumber of numbers) {
    const inverseNumber = reverseNumberString(sourceNumber);
    if (inverseNumber === sourceNumber) continue;
    if (ownSet.has(inverseNumber)) continue;
    if (seenInverses.has(inverseNumber)) continue;
    const numericVal = Number.parseInt(inverseNumber, 10);
    if (Number.isNaN(numericVal) || numericVal < 0 || numericVal >= maxPool) continue;
    seenInverses.add(inverseNumber);
    candidates.push({ sourceNumber, inverseNumber });
  }

  if (candidates.length === 0) {
    return [];
  }

  const takenRows = await tx.participation.findMany({
    where: {
      campaignId,
      status: { in: ['RESERVED', 'CONFIRMED'] },
      number: { in: candidates.map((c) => c.inverseNumber) },
    },
    select: { number: true },
  });
  const takenSet = new Set(takenRows.map((r) => r.number));

  return candidates.filter((c) => !takenSet.has(c.inverseNumber));
}

const createReservationSchema = z.object({
  campaignId: z.string().min(1),
  comboId: z.string().min(1),
});

const tokenBodySchema = z.object({
  sessionToken: z.string().min(16),
});

const addInverseSchema = z.object({
  sessionToken: z.string().min(16),
  sourceNumber: z.string().trim().min(2).max(5),
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
        packageCount: 1,
        expiresAt,
        status: 'ACTIVE',
      },
    });

    const numbers = await allocateRandomNumbers({
      tx,
      campaignId: campaign.id,
      totalFichas: campaign.totalFichas,
      quantity: combo.fichaQuantity,
      reservationSessionId: session.id,
      reservedUntil: expiresAt,
    });

    const availableInverses = await computeAvailableInverses({
      tx,
      campaignId: campaign.id,
      totalFichas: campaign.totalFichas,
      enableInverseNumbers: campaign.enableInverseNumbers,
      numbers,
    });

    return {
      sessionId: session.id,
      sessionToken: rawToken,
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      comboId: combo.id,
      comboName: combo.name,
      unitPrice: combo.price,
      unitPassQuantity: combo.passQuantity,
      unitFichaQuantity: combo.fichaQuantity,
      packageCount: 1,
      price: combo.price,
      passQuantity: combo.passQuantity,
      fichaQuantity: combo.fichaQuantity,
      numbers,
      enableInverseNumbers: campaign.enableInverseNumbers,
      availableInverses,
      inverseAdditions: [] as InverseAddition[],
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
      data: {
        regenerationCount: nextRegenCount,
        packageCount: 1,
        inverseAdditionsJson: Prisma.JsonNull,
      },
    });

    const numbers = await allocateRandomNumbers({
      tx,
      campaignId: session.campaignId,
      totalFichas: session.campaign.totalFichas,
      quantity: session.combo.fichaQuantity,
      reservationSessionId: session.id,
      reservedUntil: session.expiresAt,
      excludeNumbers: previousNumbers,
    });

    const availableInverses = await computeAvailableInverses({
      tx,
      campaignId: session.campaignId,
      totalFichas: session.campaign.totalFichas,
      enableInverseNumbers: session.campaign.enableInverseNumbers,
      numbers,
    });

    return {
      sessionId: session.id,
      packageCount: 1,
      price: session.combo.price,
      passQuantity: session.combo.passQuantity,
      fichaQuantity: session.combo.fichaQuantity,
      numbers,
      enableInverseNumbers: session.campaign.enableInverseNumbers,
      availableInverses,
      inverseAdditions: [] as InverseAddition[],
      regenerationCount: nextRegenCount,
      maxNumberChanges: session.campaign.maxNumberChanges,
      remainingChanges: Math.max(0, session.campaign.maxNumberChanges - nextRegenCount),
      expiresAt: session.expiresAt,
    };
  });
}

export async function addInversePackageToSession(input: {
  sessionId: string;
  sessionToken: string;
  sourceNumber: string;
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

    if (!session.campaign.enableInverseNumbers) {
      throw new ConflictError('Esta campaña no tiene habilitados los números inversos');
    }

    await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${session.campaignId} FOR UPDATE`;
    await releaseExpiredReservations(session.campaignId, tx);

    const currentRows = await tx.participation.findMany({
      where: {
        reservationSessionId: session.id,
        status: 'RESERVED',
      },
      select: { number: true },
    });
    const currentNumbers = currentRows.map((r) => r.number);

    if (!currentNumbers.includes(input.sourceNumber)) {
      throw new ValidationError('El número seleccionado no pertenece a tu reserva actual');
    }

    const inverseNumber = reverseNumberString(input.sourceNumber);
    const maxPool = Math.min(100000, Math.max(10, session.campaign.totalFichas));
    const numericInverse = Number.parseInt(inverseNumber, 10);

    if (
      inverseNumber === input.sourceNumber ||
      Number.isNaN(numericInverse) ||
      numericInverse < 0 ||
      numericInverse >= maxPool
    ) {
      throw new ConflictError('El número seleccionado no tiene un inverso válido disponible');
    }

    const existingInverse = await tx.participation.findFirst({
      where: {
        campaignId: session.campaignId,
        number: inverseNumber,
        status: { in: ['RESERVED', 'CONFIRMED'] },
      },
      select: { id: true },
    });

    if (existingInverse) {
      throw new ConflictError(`El número inverso ${inverseNumber} ya no está disponible`);
    }

    const activeCount = await tx.participation.count({
      where: {
        campaignId: session.campaignId,
        status: { in: ['RESERVED', 'CONFIRMED'] },
      },
    });

    if (activeCount + session.combo.fichaQuantity > session.campaign.totalFichas) {
      throw new ConflictError('No hay suficientes fichas disponibles para agregar otro paquete');
    }

    await tx.participation.create({
      data: {
        campaignId: session.campaignId,
        reservationSessionId: session.id,
        number: inverseNumber,
        status: 'RESERVED',
        reservedUntil: session.expiresAt,
      },
    });

    const extraNeeded = Math.max(0, session.combo.fichaQuantity - 1);
    if (extraNeeded > 0) {
      await allocateRandomNumbers({
        tx,
        campaignId: session.campaignId,
        totalFichas: session.campaign.totalFichas,
        quantity: extraNeeded,
        reservationSessionId: session.id,
        reservedUntil: session.expiresAt,
      });
    }

    const existingAdditions = Array.isArray(session.inverseAdditionsJson)
      ? (session.inverseAdditionsJson as unknown as InverseAddition[])
      : [];
    const nextAdditions: InverseAddition[] = [
      ...existingAdditions,
      { sourceNumber: input.sourceNumber, inverseNumber },
    ];
    const nextPackageCount = session.packageCount + 1;

    await tx.reservationSession.update({
      where: { id: session.id },
      data: {
        packageCount: nextPackageCount,
        inverseAdditionsJson: nextAdditions as unknown as Prisma.InputJsonValue,
      },
    });

    const updatedRows = await tx.participation.findMany({
      where: {
        reservationSessionId: session.id,
        status: 'RESERVED',
      },
      orderBy: { number: 'asc' },
      select: { number: true },
    });
    const updatedNumbers = updatedRows.map((r) => r.number);

    const availableInverses = await computeAvailableInverses({
      tx,
      campaignId: session.campaignId,
      totalFichas: session.campaign.totalFichas,
      enableInverseNumbers: session.campaign.enableInverseNumbers,
      numbers: updatedNumbers,
    });

    return {
      sessionId: session.id,
      packageCount: nextPackageCount,
      price: session.combo.price * nextPackageCount,
      passQuantity: session.combo.passQuantity * nextPackageCount,
      fichaQuantity: session.combo.fichaQuantity * nextPackageCount,
      numbers: updatedNumbers,
      enableInverseNumbers: session.campaign.enableInverseNumbers,
      availableInverses,
      inverseAdditions: nextAdditions,
      regenerationCount: session.regenerationCount,
      maxNumberChanges: session.campaign.maxNumberChanges,
      remainingChanges: Math.max(0, session.campaign.maxNumberChanges - session.regenerationCount),
      expiresAt: session.expiresAt,
    };
  });
}

export async function cancelReservationSession(input: {
  sessionId: string;
  sessionToken: string;
}) {
  const tokenHash = hashToken(input.sessionToken);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ReservationSession" WHERE id = ${input.sessionId} FOR UPDATE`;

    const session = await tx.reservationSession.findUnique({
      where: { id: input.sessionId },
    });

    if (!session) {
      throw new NotFoundError('Sesión de reserva no encontrada');
    }

    if (session.sessionTokenHash !== tokenHash) {
      throw new UnauthorizedError('Token de sesión inválido');
    }

    if (session.status === 'ACTIVE') {
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

      await tx.reservationSession.update({
        where: { id: session.id },
        data: { status: 'CANCELLED' },
      });
    }

    return { cancelled: true };
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
  validate({ params: sessionIdParamSchema, body: tokenBodySchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { sessionToken } = req.body as z.infer<typeof tokenBodySchema>;
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

publicReservationsRouter.post(
  '/:id/add-inverse',
  validate({ params: sessionIdParamSchema, body: addInverseSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { sessionToken, sourceNumber } = req.body as z.infer<typeof addInverseSchema>;
      const result = await addInversePackageToSession({
        sessionId: req.params.id,
        sessionToken,
        sourceNumber,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

publicReservationsRouter.post(
  '/:id/cancel',
  validate({ params: sessionIdParamSchema, body: tokenBodySchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { sessionToken } = req.body as z.infer<typeof tokenBodySchema>;
      const result = await cancelReservationSession({
        sessionId: req.params.id,
        sessionToken,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);
