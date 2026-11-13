import { Router, type NextFunction, type Request, type Response } from 'express';
import { prisma } from '../../core/prisma.js';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';

export const adminDashboardRouter = Router();

adminDashboardRouter.get(
  '/dashboard',
  requireAdminAuth,
  async (_req: Request, res: Response, next: NextFunction) => {
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

adminDashboardRouter.get(
  '/orders',
  requireAdminAuth,
  async (req: Request, res: Response, next: NextFunction) => {
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

adminDashboardRouter.get(
  '/customers',
  requireAdminAuth,
  async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        _count: { select: { orders: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            id: true,
            publicReference: true,
            status: true,
            campaign: { select: { title: true } },
            items: { select: { comboNameSnapshot: true } },
            participations: {
              where: { status: { in: ['RESERVED', 'CONFIRMED'] } },
              orderBy: { number: 'asc' },
              select: { number: true, status: true },
            },
          },
        },
      },
    });
    res.status(200).json({ success: true, data: { customers } });
  } catch (error) {
    next(error);
  }
});

adminDashboardRouter.get(
  '/audit',
  requireAdminAuth,
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawLimit = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.trunc(rawLimit))) : 20;
    const cursor = typeof req.query.cursor === 'string' && req.query.cursor.trim()
      ? req.query.cursor.trim()
      : undefined;

    const rows = await prisma.auditLog.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        actor: { select: { name: true, email: true } },
      },
    });

    const hasMore = rows.length > limit;
    const logs = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (logs[logs.length - 1]?.id ?? null) : null;

    res.status(200).json({ success: true, data: { logs, nextCursor, hasMore } });
  } catch (error) {
    next(error);
  }
});
