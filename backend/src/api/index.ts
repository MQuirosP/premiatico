import { Router } from 'express';
import { rateLimit } from '../middlewares/rateLimit.js';
import { verifyTurnstile } from '../middlewares/turnstile.js';
import { adminDashboardRouter } from '../modules/admin/admin-dashboard.module.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import {
  adminCampaignsRouter,
  publicCampaignsRouter,
} from '../modules/campaigns/campaigns.routes.js';
import { adminCombosRouter } from '../modules/combos/combos.module.js';
import { publicOrdersRouter } from '../modules/orders/orders.module.js';
import { adminPassesRouter } from '../modules/passes/passes.module.js';
import { adminPaymentsRouter } from '../modules/payments/admin-payments.module.js';
import { publicPaymentsRouter } from '../modules/payments/payments.module.js';
import { adminPrizesRouter } from '../modules/prizes/prizes.module.js';
import { publicReservationsRouter } from '../modules/reservations/reservations.module.js';
import { adminStorageRouter } from '../modules/storage/storage.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: 'premiatico-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

// Public endpoints
apiRouter.use('/campaigns', publicCampaignsRouter);
apiRouter.use(
  '/reservations',
  rateLimit({ keyPrefix: 'reservations', windowSeconds: 60, maxRequests: 30 }),
  verifyTurnstile,
  publicReservationsRouter,
);
apiRouter.use(
  '/orders',
  rateLimit({ keyPrefix: 'orders', windowSeconds: 60, maxRequests: 20 }),
  publicOrdersRouter,
);
apiRouter.use(
  '/payments',
  rateLimit({ keyPrefix: 'payments', windowSeconds: 60, maxRequests: 15 }),
  publicPaymentsRouter,
);

// Admin endpoints
apiRouter.use('/admin/auth', authRouter);
apiRouter.use('/admin', adminDashboardRouter);
apiRouter.use('/admin/campaigns', adminCampaignsRouter);
apiRouter.use('/admin/prizes', adminPrizesRouter);
apiRouter.use('/admin/passes', adminPassesRouter);
apiRouter.use('/admin/combos', adminCombosRouter);
apiRouter.use('/admin/payments', adminPaymentsRouter);
apiRouter.use('/admin/storage', adminStorageRouter);
