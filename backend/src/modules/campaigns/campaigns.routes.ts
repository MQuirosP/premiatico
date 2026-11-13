import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { ValidationError } from '../../core/errors.js';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';
import { validate } from '../../middlewares/validate.js';
import { getSignedDownloadUrl, r2KeyBuilders, uploadObject } from '../storage/storage.service.js';
import {
  closeCampaignController,
  createCampaignController,
  deleteCampaignController,
  evaluateCampaignWinnerController,
  getAdminCampaignByIdController,
  getPublicCampaignBySlugController,
  listAdminCampaignsController,
  listPublicCampaignsController,
  pauseCampaignController,
  publishCampaignController,
  updateCampaignController,
} from './campaigns.controller.js';
import {
  campaignIdParamSchema,
  campaignSlugParamSchema,
  createCampaignSchema,
  evaluateWinnerSchema,
  updateCampaignSchema,
} from './campaigns.schema.js';

export const publicCampaignsRouter = Router();
publicCampaignsRouter.get('/', listPublicCampaignsController);
publicCampaignsRouter.get(
  '/:slug',
  validate({ params: campaignSlugParamSchema }),
  getPublicCampaignBySlugController,
);

const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export const adminCampaignsRouter = Router();
adminCampaignsRouter.use(requireAdminAuth);
adminCampaignsRouter.post(
  '/cover-upload',
  coverUpload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        throw new ValidationError('Debés adjuntar una imagen de portada');
      }
      const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
      if (!allowed.has(file.mimetype)) {
        throw new ValidationError('Formato de imagen inválido. Usá JPG, PNG o WEBP');
      }
      const key = r2KeyBuilders.campaignImage('cover', file.originalname);
      await uploadObject({ key, body: file.buffer, contentType: file.mimetype });
      const signed = await getSignedDownloadUrl({ key, expiresInSeconds: 3600 }).catch(() => null);
      res.status(201).json({ success: true, data: { key, url: signed?.downloadUrl ?? null } });
    } catch (error) {
      next(error);
    }
  },
);
adminCampaignsRouter.get('/', listAdminCampaignsController);
adminCampaignsRouter.post(
  '/',
  validate({ body: createCampaignSchema }),
  createCampaignController,
);
adminCampaignsRouter.get(
  '/:id',
  validate({ params: campaignIdParamSchema }),
  getAdminCampaignByIdController,
);
adminCampaignsRouter.patch(
  '/:id',
  validate({ params: campaignIdParamSchema, body: updateCampaignSchema }),
  updateCampaignController,
);
adminCampaignsRouter.post(
  '/:id/publish',
  validate({ params: campaignIdParamSchema }),
  publishCampaignController,
);
adminCampaignsRouter.post(
  '/:id/pause',
  validate({ params: campaignIdParamSchema }),
  pauseCampaignController,
);
adminCampaignsRouter.post(
  '/:id/close',
  validate({ params: campaignIdParamSchema }),
  closeCampaignController,
);
adminCampaignsRouter.post(
  '/:id/evaluate-winner',
  validate({ params: campaignIdParamSchema, body: evaluateWinnerSchema }),
  evaluateCampaignWinnerController,
);
adminCampaignsRouter.delete(
  '/:id',
  validate({ params: campaignIdParamSchema }),
  deleteCampaignController,
);
