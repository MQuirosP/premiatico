import { Router, type NextFunction, type Request, type Response } from 'express';
import type { z } from 'zod';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';
import { validate } from '../../middlewares/validate.js';
import {
  createPrizeSchema,
  drawRandomPrizeWinnerSchema,
  evaluatePrizeWinnerSchema,
  prizeIdSchema,
  updatePrizeSchema,
} from './prizes.schema.js';
import {
  createCampaignPrizes,
  deleteCampaignPrize,
  drawRandomPrizeWinner,
  evaluatePrizeWinner,
  notifyPrizeWinnerByEmail,
  resetPrizeEvaluation,
  updateCampaignPrize,
} from './prizes.service.js';

export const adminPrizesRouter = Router();
adminPrizesRouter.use(requireAdminAuth);

adminPrizesRouter.post(
  '/',
  validate({ body: createPrizeSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body as z.infer<typeof createPrizeSchema>;
      const prizes = await createCampaignPrizes(data, req.admin!.id);
      res.status(201).json({
        success: true,
        data: { prize: prizes[0], prizes },
      });
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
      const data = req.body as z.infer<typeof updatePrizeSchema>;
      const prize = await updateCampaignPrize(req.params.id, data, req.admin!.id);
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
      await deleteCampaignPrize(req.params.id, req.admin!.id);
      res.status(200).json({ success: true, data: { deleted: true } });
    } catch (error) {
      next(error);
    }
  },
);

adminPrizesRouter.post(
  '/:id/evaluate-winner',
  validate({ params: prizeIdSchema, body: evaluatePrizeWinnerSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const data = req.body as z.infer<typeof evaluatePrizeWinnerSchema>;
      const result = await evaluatePrizeWinner(req.params.id, data, req.admin!.id);
      res.status(200).json({ success: true, data: { result } });
    } catch (error) {
      next(error);
    }
  },
);

adminPrizesRouter.post(
  '/:id/draw-random',
  validate({ params: prizeIdSchema, body: drawRandomPrizeWinnerSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const data = req.body as z.infer<typeof drawRandomPrizeWinnerSchema>;
      const result = await drawRandomPrizeWinner(req.params.id, data, req.admin!.id);
      res.status(200).json({ success: true, data: { result } });
    } catch (error) {
      next(error);
    }
  },
);

adminPrizesRouter.post(
  '/:id/reset',
  validate({ params: prizeIdSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await resetPrizeEvaluation(req.params.id, req.admin!.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

adminPrizesRouter.post(
  '/:id/notify-email',
  validate({ params: prizeIdSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await notifyPrizeWinnerByEmail(req.params.id, req.admin!.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);
