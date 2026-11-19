import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';
import { validate } from '../../middlewares/validate.js';
import { recordAuditLog } from '../audit/audit.service.js';

export function normalizeCategorySlug(name: string): string {
  return name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function resolveCampaignCategory(input: {
  categoryId?: string | null;
  category?: string | null;
}): Promise<{ categoryId: string; categoryName: string }> {
  if (input.categoryId) {
    const found = await prisma.campaignCategory.findUnique({
      where: { id: input.categoryId },
    });
    if (!found) {
      throw new NotFoundError('Categoría no encontrada');
    }
    return { categoryId: found.id, categoryName: found.name };
  }

  const trimmedName = input.category?.trim() ?? '';
  if (trimmedName.length < 2) {
    throw new ValidationError('Debés seleccionar o indicar una categoría válida');
  }

  const slug = normalizeCategorySlug(trimmedName);
  if (!slug) {
    throw new ValidationError('Nombre de categoría inválido');
  }

  const existing = await prisma.campaignCategory.findUnique({ where: { slug } });
  if (existing) {
    return { categoryId: existing.id, categoryName: existing.name };
  }

  const created = await prisma.campaignCategory.create({
    data: { name: trimmedName, slug, isActive: true, sortOrder: 10 },
  });
  return { categoryId: created.id, categoryName: created.name };
}

const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(60),
  sortOrder: z.coerce.number().int().min(0).optional().default(10),
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const categoryIdSchema = z.object({ id: z.string().min(1) });

export const adminCategoriesRouter = Router();
adminCategoriesRouter.use(requireAdminAuth);

adminCategoriesRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const categories = await prisma.campaignCategory.findMany({
        where: activeOnly ? { isActive: true } : undefined,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { campaigns: true } } },
      });
      res.status(200).json({ success: true, data: { categories } });
    } catch (error) {
      next(error);
    }
  },
);

adminCategoriesRouter.post(
  '/',
  validate({ body: createCategorySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body as z.infer<typeof createCategorySchema>;
      const slug = normalizeCategorySlug(data.name);
      if (!slug) {
        throw new ValidationError('Nombre de categoría inválido');
      }

      const existing = await prisma.campaignCategory.findUnique({ where: { slug } });
      if (existing) {
        throw new ConflictError(
          `Ya existe la categoría "${existing.name}" en el catálogo.`,
        );
      }

      const category = await prisma.campaignCategory.create({
        data: {
          name: data.name,
          slug,
          sortOrder: data.sortOrder,
          isActive: true,
        },
        include: { _count: { select: { campaigns: true } } },
      });

      await recordAuditLog({
        actorId: req.admin!.id,
        action: 'CATEGORY_CREATED',
        entityType: 'CampaignCategory',
        entityId: category.id,
        metadata: { name: category.name, slug: category.slug },
      });

      res.status(201).json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  },
);

adminCategoriesRouter.patch(
  '/:id',
  validate({ params: categoryIdSchema, body: updateCategorySchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.campaignCategory.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        throw new NotFoundError('Categoría no encontrada');
      }

      const data = req.body as z.infer<typeof updateCategorySchema>;
      let nextSlug: string | undefined;
      if (data.name !== undefined) {
        nextSlug = normalizeCategorySlug(data.name);
        if (!nextSlug) throw new ValidationError('Nombre de categoría inválido');
        const collision = await prisma.campaignCategory.findFirst({
          where: { slug: nextSlug, id: { not: existing.id } },
        });
        if (collision) {
          throw new ConflictError(`Ya existe otra categoría equivalente ("${collision.name}").`);
        }
      }

      const category = await prisma.$transaction(async (tx) => {
        const updated = await tx.campaignCategory.update({
          where: { id: existing.id },
          data: {
            ...(data.name !== undefined ? { name: data.name, slug: nextSlug } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
          },
          include: { _count: { select: { campaigns: true } } },
        });

        if (data.name !== undefined && data.name !== existing.name) {
          await tx.campaign.updateMany({
            where: { categoryId: existing.id },
            data: { category: data.name },
          });
        }
        return updated;
      });

      await recordAuditLog({
        actorId: req.admin!.id,
        action: 'CATEGORY_UPDATED',
        entityType: 'CampaignCategory',
        entityId: category.id,
        metadata: { name: category.name, isActive: category.isActive },
      });

      res.status(200).json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  },
);
