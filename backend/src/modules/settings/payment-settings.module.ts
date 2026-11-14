import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma.js';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';
import { validate } from '../../middlewares/validate.js';
import { recordAuditLog } from '../audit/audit.service.js';

export interface SinpeReceiverConfig {
  sinpePhone: string;
  sinpeHolderName: string;
  sinpeBankName: string | null;
  sinpeInstructions: string;
  sinpeDetailNotice: string | null;
}

export const DEFAULT_PAYMENT_SETTINGS: SinpeReceiverConfig = {
  sinpePhone: '88887777',
  sinpeHolderName: 'Premiático Costa Rica',
  sinpeBankName: null,
  sinpeInstructions:
    'Realizá la transferencia SINPE Móvil por el monto exacto indicando tu referencia de pedido y adjuntá el comprobante antes del vencimiento.',
  sinpeDetailNotice: 'Colocá tu referencia de pedido en el detalle de la transferencia.',
};

export const updatePaymentSettingsSchema = z.object({
  sinpePhone: z
    .string()
    .trim()
    .regex(/^[0-9\-\s]{8,15}$/, 'Ingresá un número SINPE válido de Costa Rica (8 dígitos)')
    .transform((val) => val.replace(/[\s-]/g, ''))
    .refine((digits) => digits.length === 8, {
      message: 'El número SINPE debe tener exactamente 8 dígitos',
    }),
  sinpeHolderName: z
    .string()
    .trim()
    .min(3, 'Ingresá el nombre del titular (mínimo 3 caracteres)')
    .max(120),
  sinpeBankName: z
    .string()
    .trim()
    .max(80)
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  sinpeInstructions: z
    .string()
    .trim()
    .min(10, 'Las instrucciones deben tener al menos 10 caracteres')
    .max(600),
  sinpeDetailNotice: z
    .string()
    .trim()
    .max(240)
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export async function getPaymentSettings(): Promise<
  SinpeReceiverConfig & { updatedAt: Date | null }
> {
  const row = await prisma.paymentSettings.findUnique({
    where: { id: 'default' },
  });

  if (!row) {
    return {
      ...DEFAULT_PAYMENT_SETTINGS,
      updatedAt: null,
    };
  }

  return {
    sinpePhone: row.sinpePhone,
    sinpeHolderName: row.sinpeHolderName,
    sinpeBankName: row.sinpeBankName,
    sinpeInstructions: row.sinpeInstructions,
    sinpeDetailNotice: row.sinpeDetailNotice,
    updatedAt: row.updatedAt,
  };
}

export async function updatePaymentSettings(
  input: z.infer<typeof updatePaymentSettingsSchema>,
  actorId: string,
) {
  const previous = await prisma.paymentSettings.findUnique({
    where: { id: 'default' },
  });

  const saved = await prisma.paymentSettings.upsert({
    where: { id: 'default' },
    update: {
      sinpePhone: input.sinpePhone,
      sinpeHolderName: input.sinpeHolderName,
      sinpeBankName: input.sinpeBankName ?? null,
      sinpeInstructions: input.sinpeInstructions,
      sinpeDetailNotice: input.sinpeDetailNotice ?? null,
      updatedById: actorId,
    },
    create: {
      id: 'default',
      sinpePhone: input.sinpePhone,
      sinpeHolderName: input.sinpeHolderName,
      sinpeBankName: input.sinpeBankName ?? null,
      sinpeInstructions: input.sinpeInstructions,
      sinpeDetailNotice: input.sinpeDetailNotice ?? null,
      updatedById: actorId,
    },
  });

  await recordAuditLog({
    actorId,
    action: 'PAYMENT_SETTINGS_UPDATED',
    entityType: 'PaymentSettings',
    entityId: saved.id,
    metadata: {
      previous: previous
        ? {
            sinpePhone: previous.sinpePhone,
            sinpeHolderName: previous.sinpeHolderName,
            sinpeBankName: previous.sinpeBankName,
          }
        : null,
      next: {
        sinpePhone: saved.sinpePhone,
        sinpeHolderName: saved.sinpeHolderName,
        sinpeBankName: saved.sinpeBankName,
      },
    },
  });

  return {
    sinpePhone: saved.sinpePhone,
    sinpeHolderName: saved.sinpeHolderName,
    sinpeBankName: saved.sinpeBankName,
    sinpeInstructions: saved.sinpeInstructions,
    sinpeDetailNotice: saved.sinpeDetailNotice,
    updatedAt: saved.updatedAt,
  };
}

export const adminPaymentSettingsRouter = Router();
adminPaymentSettingsRouter.use(requireAdminAuth);

adminPaymentSettingsRouter.get(
  '/payment',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await getPaymentSettings();
      res.status(200).json({ success: true, data: { settings } });
    } catch (error) {
      next(error);
    }
  },
);

adminPaymentSettingsRouter.put(
  '/payment',
  validate({ body: updatePaymentSettingsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof updatePaymentSettingsSchema>;
      const settings = await updatePaymentSettings(body, req.admin!.id);
      res.status(200).json({ success: true, data: { settings } });
    } catch (error) {
      next(error);
    }
  },
);
