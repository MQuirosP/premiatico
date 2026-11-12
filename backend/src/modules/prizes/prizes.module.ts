import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { ConflictError, NotFoundError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';
import { validate } from '../../middlewares/validate.js';
import { recordAuditLog } from '../audit/audit.service.js';

const createPrizeSchema = z.object({
  campaignId: z.string().min(1),
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().min(5).max(3000),
  estimatedValue: z.coerce.number().int().nonnegative().optional().nullable(),
  imageKey: z.string().trim().max(300).optional().nullable(),
  position: z.coerce.number().int().min(0).default(0),
});

const updatePrizeSchema = createPrizeSchema.omit({ campaignId: true }).partial();
const prizeIdSchema = z.object({ id: z.string().min(1) });

export const adminPrizesRouter = Router();
adminPrizesRouter.use(requireAdminAuth);

adminPrizesRouter.post(
  '/',
  validate({ body: createPrizeSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body as z.infer<typeof createPrizeSchema>;
      const campaign = await prisma.campaign.findUnique({ where: { id: data.campaignId } });
      if (!campaign) throw new NotFoundError('Campaña no encontrada');

      const prize = await prisma.campaignPrize.create({
        data: {
          campaignId: data.campaignId,
          name: data.name,
          description: data.description,
          estimatedValue: data.estimatedValue ?? null,
          imageKey: data.imageKey ?? null,
          position: data.position,
        },
      });

      await recordAuditLog({
        actorId: req.admin!.id,
        action: 'PRIZE_CREATED',
        entityType: 'CampaignPrize',
        entityId: prize.id,
        metadata: { campaignId: data.campaignId, name: prize.name },
      });

      res.status(201).json({ success: true, data: { prize } });
    } catch (error) {
      next(error);
    }
  },
);

adminPrizesRouter.patch(
  '/:id',
  validate({ params: prizeIdSchema, body: updatePrizeSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.campaignPrize.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError('Premio no encontrado');

      const prize = await prisma.campaignPrize.update({
        where: { id: req.params.id },
        data: req.body as z.infer<typeof updatePrizeSchema>,
      });

      await recordAuditLog({
        actorId: req.admin!.id,
        action: 'PRIZE_UPDATED',
        entityType: 'CampaignPrize',
        entityId: prize.id,
      });

      res.status(200).json({ success: true, data: { prize } });
    } catch (error) {
      next(error);
    }
  },
);

adminPrizesRouter.delete(
  '/:id',
  validate({ params: prizeIdSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.campaignPrize.findUnique({
        where: { id: req.params.id },
        include: { campaign: { select: { status: true } } },
      });
      if (!existing) throw new NotFoundError('Premio no encontrado');

      if (existing.campaign.status === 'CLOSED' || existing.campaign.status === 'COMPLETED') {
        throw new ConflictError('No se puede eliminar un premio de una campaña cerrada o completada');
      }

      await prisma.campaignPrize.delete({ where: { id: req.params.id } });

      await recordAuditLog({
        actorId: req.admin!.id,
        action: 'PRIZE_DELETED',
        entityType: 'CampaignPrize',
        entityId: req.params.id,
      });

      res.status(200).json({ success: true, data: { deleted: true } });
    } catch (error) {
      next(error);
    }
  },
);
