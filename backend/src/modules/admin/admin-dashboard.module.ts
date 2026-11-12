import { Router, type NextFunction, type Request, type Response } from 'express';
import { prisma } from '../../core/prisma.js';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';

export const adminDashboardRouter = Router();
adminDashboardRouter.use(requireAdminAuth);

adminDashboardRouter.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      activeCampaigns,
      todayOrders,
      confirmedSalesAgg,
      pendingPayments,
      confirmedChances,
    ] = await Promise.all([
      prisma.campaign.count({ where: { status: 'ACTIVE' } }),
      prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.order.aggregate({
        where: { status: 'CONFIRMED' },
        _sum: { totalAmount: true },
      }),
      prisma.payment.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.participation.count({ where: { status: 'CONFIRMED' } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        activeCampaigns,
        todayOrders,
        confirmedSalesTotal: confirmedSalesAgg._sum.totalAmount ?? 0,
        pendingPayments,
        confirmedChances,
      },
    });
  } catch (error) {
    next(error);
  }
});

adminDashboardRouter.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;

    const orders = await prisma.order.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(search
          ? {
              OR: [
                { publicReference: { contains: search, mode: 'insensitive' } },
                { customer: { fullName: { contains: search, mode: 'insensitive' } } },
                { customer: { email: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        customer: { select: { fullName: true, email: true, phone: true } },
        campaign: { select: { title: true, slug: true } },
        payments: { select: { id: true, status: true, amount: true } },
        _count: { select: { participations: true } },
      },
    });

    res.status(200).json({ success: true, data: { orders } });
  } catch (error) {
    next(error);
  }
});

adminDashboardRouter.get('/customers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        _count: { select: { orders: true } },
      },
    });
    res.status(200).json({ success: true, data: { customers } });
  } catch (error) {
    next(error);
  }
});

adminDashboardRouter.get('/audit', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        actor: { select: { name: true, email: true } },
      },
    });
    res.status(200).json({ success: true, data: { logs } });
  } catch (error) {
    next(error);
  }
});
