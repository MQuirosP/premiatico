import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';
import { validate } from '../../middlewares/validate.js';
import {
  approvePaymentSchema,
  paymentIdParamSchema,
  rejectPaymentSchema,
} from './admin-payments.schema.js';
import { approvePayment, listAdminPayments, rejectPayment } from './admin-payments.service.js';

export const adminPaymentsRouter = Router();
adminPaymentsRouter.use(requireAdminAuth);

adminPaymentsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
    const payments = await listAdminPayments(statusFilter);
    res.status(200).json({ success: true, data: { payments } });
  } catch (error) {
    next(error);
  }
});

adminPaymentsRouter.post(
  '/:id/approve',
  validate({ params: paymentIdParamSchema, body: approvePaymentSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { reviewNotes } = req.body as z.infer<typeof approvePaymentSchema>;
      const payment = await approvePayment({
        paymentId: req.params.id,
        adminId: req.admin!.id,
        reviewNotes,
      });
      res.status(200).json({ success: true, data: { payment } });
    } catch (error) {
      next(error);
    }
  },
);

adminPaymentsRouter.post(
  '/:id/reject',
  validate({ params: paymentIdParamSchema, body: rejectPaymentSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { rejectionReason, reviewNotes } = req.body as z.infer<typeof rejectPaymentSchema>;
      const payment = await rejectPayment({
        paymentId: req.params.id,
        adminId: req.admin!.id,
        rejectionReason,
        reviewNotes,
      });
      res.status(200).json({ success: true, data: { payment } });
    } catch (error) {
      next(error);
    }
  },
);
