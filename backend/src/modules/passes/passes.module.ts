import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { NotFoundError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';
import { validate } from '../../middlewares/validate.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { getSignedUploadUrl, r2KeyBuilders } from '../storage/storage.service.js';

const createPassSchema = z.object({
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().min(5).max(2000),
  fileKey: z.string().trim().min(3).max(300),
  mimeType: z.string().trim().min(3).max(100),
  fileSize: z.coerce.number().int().positive().max(100 * 1024 * 1024),
  isActive: z.boolean().default(true),
});

const updatePassSchema = createPassSchema.partial();
const passIdSchema = z.object({ id: z.string().min(1) });

const signedUploadSchema = z.object({
  passId: z.string().min(1).default('new'),
  fileName: z.string().trim().min(1).max(120),
  contentType: z.string().trim().min(3).max(100),
});

export const adminPassesRouter = Router();
adminPassesRouter.use(requireAdminAuth);

adminPassesRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const passes = await prisma.digitalPass.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data: { passes } });
  } catch (error) {
    next(error);
  }
});

adminPassesRouter.post(
  '/signed-upload',
  validate({ body: signedUploadSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { passId, fileName, contentType } = req.body as z.infer<typeof signedUploadSchema>;
      const key = r2KeyBuilders.passFile(passId, fileName);
      const signed = await getSignedUploadUrl({ key, contentType });
      res.status(200).json({ success: true, data: signed });
    } catch (error) {
      next(error);
    }
  },
);

adminPassesRouter.post(
  '/',
  validate({ body: createPassSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body as z.infer<typeof createPassSchema>;
      const pass = await prisma.digitalPass.create({ data });

      await recordAuditLog({
        actorId: req.admin!.id,
        action: 'PASS_CREATED',
        entityType: 'DigitalPass',
        entityId: pass.id,
        metadata: { name: pass.name },
      });

      res.status(201).json({ success: true, data: { pass } });
    } catch (error) {
      next(error);
    }
  },
);

adminPassesRouter.patch(
  '/:id',
  validate({ params: passIdSchema, body: updatePassSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.digitalPass.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError('Pase digital no encontrado');

      const pass = await prisma.digitalPass.update({
        where: { id: req.params.id },
        data: req.body as z.infer<typeof updatePassSchema>,
      });

      await recordAuditLog({
        actorId: req.admin!.id,
        action: 'PASS_UPDATED',
        entityType: 'DigitalPass',
        entityId: pass.id,
      });

      res.status(200).json({ success: true, data: { pass } });
    } catch (error) {
      next(error);
    }
  },
);

adminPassesRouter.delete(
  '/:id',
  validate({ params: passIdSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.digitalPass.findUnique({
        where: { id: req.params.id },
        include: {
          _count: { select: { comboItems: true } },
        },
      });
      if (!existing) throw new NotFoundError('Pase digital no encontrado');

      const isReferenced = existing._count.comboItems > 0;

      if (isReferenced) {
        await prisma.digitalPass.update({
          where: { id: existing.id },
          data: { isActive: false },
        });
      } else {
        await prisma.digitalPass.delete({ where: { id: existing.id } });
      }

      await recordAuditLog({
        actorId: req.admin!.id,
        action: isReferenced ? 'PASS_DEACTIVATED' : 'PASS_DELETED',
        entityType: 'DigitalPass',
        entityId: existing.id,
        metadata: { name: existing.name },
      });

      res.status(200).json({
        success: true,
        data: { deleted: !isReferenced, deactivated: isReferenced },
      });
    } catch (error) {
      next(error);
    }
  },
);
