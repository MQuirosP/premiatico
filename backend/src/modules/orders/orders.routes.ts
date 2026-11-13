import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import {
  createOrderSchema,
  customerOrderLookupSchema,
  orderLookupParamsSchema,
  orderLookupQuerySchema,
} from './orders.schema.js';
import {
  createOrderFromSession,
  getPublicOrderByReference,
  lookupPublicOrdersByCustomer,
} from './orders.service.js';

export const publicOrdersRouter = Router();

publicOrdersRouter.post(
  '/',
  validate({ body: createOrderSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body as z.infer<typeof createOrderSchema>;
      const result = await createOrderFromSession(data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

publicOrdersRouter.post(
  '/lookup',
  validate({ body: customerOrderLookupSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { identifier } = req.body as z.infer<typeof customerOrderLookupSchema>;
      const orders = await lookupPublicOrdersByCustomer(identifier);
      res.status(200).json({ success: true, data: { orders } });
    } catch (error) {
      next(error);
    }
  },
);

publicOrdersRouter.get(
  '/:publicReference',
  validate({ params: orderLookupParamsSchema, query: orderLookupQuerySchema }),
  async (req: Request<{ publicReference: string }>, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query as z.infer<typeof orderLookupQuerySchema>;
      const order = await getPublicOrderByReference(req.params.publicReference, token);
      res.status(200).json({ success: true, data: { order } });
    } catch (error) {
      next(error);
    }
  },
);
