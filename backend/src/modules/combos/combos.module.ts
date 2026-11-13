import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';
import { validate } from '../../middlewares/validate.js';
import { recordAuditLog } from '../audit/audit.service.js';

const comboPassItemSchema = z.object({
  digitalPassId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).default(1),
});

const createComboSchema = z.object({
  campaignId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  price: z.coerce.number().int().positive(),
  passQuantity: z.coerce.number().int().min(1),
  chanceQuantity: z.coerce.number().int().min(1),
  badgeLabel: z.string().trim().max(40).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  passItems: z.array(comboPassItemSchema).optional(),
});

const updateComboSchema = createComboSchema.omit({ campaignId: true }).partial();
const comboIdSchema = z.object({ id: z.string().min(1) });

export const adminCombosRouter = Router();
adminCombosRouter.use(requireAdminAuth);

adminCombosRouter.post(
  '/',
  validate({ body: createComboSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body as z.infer<typeof createComboSchema>;
      const campaign = await prisma.campaign.findUnique({ where: { id: data.campaignId } });
      if (!campaign) throw new NotFoundError('Campaña no encontrada');

      if (data.passItems && data.passItems.length > 0) {
        const passIds = data.passItems.map((item) => item.digitalPassId);
        const foundCount = await prisma.digitalPass.count({
          where: { id: { in: passIds }, isActive: true },
        });
        if (foundCount !== passIds.length) {
          throw new ValidationError('Uno o más pases digitales no existen o están inactivos');
        }
      }

      const combo = await prisma.campaignCombo.create({
        data: {
          campaignId: data.campaignId,
          name: data.name,
          description: data.description ?? null,
          price: data.price,
          passQuantity: data.passQuantity,
          chanceQuantity: data.chanceQuantity,
          badgeLabel: data.badgeLabel ?? null,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
          ...(data.passItems && data.passItems.length > 0
            ? {
                passItems: {
                  create: data.passItems.map((item) => ({
                    digitalPassId: item.digitalPassId,
                    quantity: item.quantity,
                  })),
                },
              }
            : {}),
        },
        include: {
          passItems: { include: { digitalPass: true } },
        },
      });

      await recordAuditLog({
        actorId: req.admin!.id,
        action: 'COMBO_CREATED',
        entityType: 'CampaignCombo',
        entityId: combo.id,
        metadata: { campaignId: data.campaignId, price: combo.price, chanceQuantity: combo.chanceQuantity },
      });

      res.status(201).json({ success: true, data: { combo } });
    } catch (error) {
      next(error);
    }
  },
);

adminCombosRouter.patch(
  '/:id',
  validate({ params: comboIdSchema, body: updateComboSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.campaignCombo.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError('Combo no encontrado');

      const { passItems, ...fields } = req.body as z.infer<typeof updateComboSchema>;

      const combo = await prisma.$transaction(async (tx) => {
        if (passItems !== undefined) {
          await tx.comboPassItem.deleteMany({ where: { comboId: req.params.id } });
          if (passItems.length > 0) {
            await tx.comboPassItem.createMany({
              data: passItems.map((item) => ({
                comboId: req.params.id,
                digitalPassId: item.digitalPassId,
                quantity: item.quantity,
              })),
            });
          }
        }

        return tx.campaignCombo.update({
          where: { id: req.params.id },
          data: fields,
          include: { passItems: { include: { digitalPass: true } } },
        });
      });

      await recordAuditLog({
        actorId: req.admin!.id,
        action: 'COMBO_UPDATED',
        entityType: 'CampaignCombo',
        entityId: combo.id,
      });

      res.status(200).json({ success: true, data: { combo } });
    } catch (error) {
      next(error);
    }
  },
);

adminCombosRouter.delete(
  '/:id',
  validate({ params: comboIdSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.campaignCombo.findUnique({
        where: { id: req.params.id },
        include: {
          _count: {
            select: { orderItems: true, reservationSessions: true },
          },
        },
      });
      if (!existing) throw new NotFoundError('Combo no encontrado');

      const hasHistory =
        existing._count.orderItems > 0 || existing._count.reservationSessions > 0;

      if (hasHistory) {
        await prisma.campaignCombo.update({
          where: { id: existing.id },
          data: { isActive: false },
        });
      } else {
        await prisma.campaignCombo.delete({ where: { id: existing.id } });
      }

      await recordAuditLog({
        actorId: req.admin!.id,
        action: hasHistory ? 'COMBO_DEACTIVATED' : 'COMBO_DELETED',
        entityType: 'CampaignCombo',
        entityId: existing.id,
        metadata: { campaignId: existing.campaignId, name: existing.name },
      });

      res.status(200).json({
        success: true,
        data: { deleted: !hasHistory, deactivated: hasHistory },
      });
    } catch (error) {
      next(error);
    }
  },
);
