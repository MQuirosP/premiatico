import { Router } from 'express';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';
import { validate } from '../../middlewares/validate.js';
import {
  closeCampaignController,
  createCampaignController,
  deleteCampaignController,
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
  updateCampaignSchema,
} from './campaigns.schema.js';

export const publicCampaignsRouter = Router();
publicCampaignsRouter.get('/', listPublicCampaignsController);
publicCampaignsRouter.get(
  '/:slug',
  validate({ params: campaignSlugParamSchema }),
  getPublicCampaignBySlugController,
);

export const adminCampaignsRouter = Router();
adminCampaignsRouter.use(requireAdminAuth);
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
adminCampaignsRouter.delete(
  '/:id',
  validate({ params: campaignIdParamSchema }),
  deleteCampaignController,
);
