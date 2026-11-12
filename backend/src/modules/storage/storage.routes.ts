import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';
import { validate } from '../../middlewares/validate.js';
import { getSignedUploadUrl, r2KeyBuilders } from './storage.service.js';

const imageUploadSchema = z.object({
  scope: z.enum(['campaign', 'prize']),
  entityId: z.string().min(1),
  fileName: z.string().trim().min(1).max(120),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

export const adminStorageRouter = Router();
adminStorageRouter.use(requireAdminAuth);

adminStorageRouter.post(
  '/signed-image-upload',
  validate({ body: imageUploadSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { scope, entityId, fileName, contentType } = req.body as z.infer<
        typeof imageUploadSchema
      >;
      const key =
        scope === 'campaign'
          ? r2KeyBuilders.campaignImage(entityId, fileName)
          : r2KeyBuilders.prizeImage(entityId, fileName);
      const signed = await getSignedUploadUrl({ key, contentType });
      res.status(200).json({ success: true, data: signed });
    } catch (error) {
      next(error);
    }
  },
);
