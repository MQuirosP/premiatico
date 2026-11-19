import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';
import { createMemoryUpload } from '../../middlewares/upload.js';
import { validate } from '../../middlewares/validate.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { generateStampedPassImage } from '../notifications/ficha-card.service.js';
import { generateStickerPreview } from './pass-generator.service.js';
import {
  deleteObject,
  getObjectBuffer,
  getSignedDownloadUrl,
  getSignedUploadUrl,
  r2KeyBuilders,
  uploadObject,
} from '../storage/storage.service.js';

const createPassSchema = z.object({
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().min(5).max(2000),
  kind: z.enum(['PASS', 'FICHA']).default('PASS'),
  fileKey: z.string().trim().min(3).max(300),
  mimeType: z.string().trim().min(3).max(100),
  fileSize: z.coerce.number().int().positive().max(100 * 1024 * 1024),
  isActive: z.boolean().default(true),
});

const updatePassSchema = createPassSchema.partial();
const passIdSchema = z.object({ id: z.string().min(1) });

const signedUploadSchema = z.object({
  passId: z.string().min(1).default('new'),
  fileName: z.string().trim().min(1).max(120),
  contentType: z.string().trim().min(3).max(100),
});

const generatePreviewSchema = z.object({
  tipo: z.enum(['PASS', 'FICHA', 'BOTH']).default('BOTH'),
  tematica: z.string().trim().min(2, 'Describí la temática').max(200),
  colores: z.string().trim().max(120).optional(),
  estilo: z.string().trim().max(160).optional(),
  eslogan: z.string().trim().max(80).optional(),
});

const saveGeneratedSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(2000),
  comboId: z.string().trim().min(1).optional(),
  variants: z
    .array(
      z.object({
        kind: z.enum(['PASS', 'FICHA']),
        base64: z.string().min(100),
      }),
    )
    .min(1)
    .max(2),
});

export const adminPassesRouter = Router();
adminPassesRouter.use(requireAdminAuth);

adminPassesRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const passes = await prisma.digitalPass.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data: { passes } });
  } catch (error) {
    next(error);
  }
});

const passUpload = createMemoryUpload({
  maxFileSizeBytes: 25 * 1024 * 1024,
  allowedMimeTypes: new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  invalidMimeMessage: 'Formato inválido. Usá JPG, PNG, WEBP o PDF',
});

adminPassesRouter.post(
  '/upload',
  passUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    let uploadedKey: string | null = null;
    try {
      const file = req.file;
      if (!file) {
        throw new ValidationError('Debés adjuntar el archivo del pase digital');
      }
      const name =
        typeof req.body?.name === 'string' && req.body.name.trim().length >= 2
          ? req.body.name.trim().slice(0, 140)
          : file.originalname;
      const description =
        typeof req.body?.description === 'string' && req.body.description.trim().length >= 5
          ? req.body.description.trim().slice(0, 2000)
          : `Pase digital: ${name}`;
      const kind = req.body?.kind === 'FICHA' ? 'FICHA' : 'PASS';

      const key = r2KeyBuilders.passFile('catalog', file.originalname);
      await uploadObject({ key, body: file.buffer, contentType: file.mimetype });
      uploadedKey = key;

      const pass = await prisma.digitalPass.create({
        data: {
          name,
          description,
          kind,
          fileKey: key,
          mimeType: file.mimetype,
          fileSize: file.size,
          isActive: true,
        },
      });

      await recordAuditLog({
        actorId: req.admin!.id,
        action: 'PASS_CREATED',
        entityType: 'DigitalPass',
        entityId: pass.id,
        metadata: { name: pass.name, mimeType: pass.mimeType },
      });

      res.status(201).json({ success: true, data: { pass } });
    } catch (error) {
      if (uploadedKey) {
        await deleteObject(uploadedKey).catch(() => undefined);
      }
      next(error);
    }
  },
);

adminPassesRouter.post(
  '/generate-preview',
  validate({ body: generatePreviewSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const preview = await generateStickerPreview(req.body);
      res.status(200).json({ success: true, data: preview });
    } catch (error) {
      next(error);
    }
  },
);

adminPassesRouter.post(
  '/save-generated',
  validate({ body: saveGeneratedSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    const uploadedKeys: string[] = [];
    try {
      const { name, description, comboId, variants } = req.body as z.infer<typeof saveGeneratedSchema>;

      if (comboId) {
        const combo = await prisma.campaignCombo.findUnique({ where: { id: comboId }, select: { id: true } });
        if (!combo) throw new NotFoundError('El combo seleccionado no existe');
      }

      const createdPasses = [];
      for (const variant of variants) {
        const buffer = Buffer.from(variant.base64, 'base64');
        const suffix = variant.kind === 'PASS' ? 'Pase' : 'Ficha';
        const passName = variants.length > 1 ? `${name} (${suffix})` : name;
        const safeSlug = passName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 48);
        const filename = `${safeSlug || 'sticker'}-${variant.kind.toLowerCase()}.png`;
        const key = r2KeyBuilders.passFile('catalog', filename);

        await uploadObject({ key, body: buffer, contentType: 'image/png' });
        uploadedKeys.push(key);

        const pass = await prisma.digitalPass.create({
          data: {
            name: passName,
            description,
            kind: variant.kind,
            fileKey: key,
            mimeType: 'image/png',
            fileSize: buffer.length,
            isActive: true,
          },
        });

        if (comboId) {
          await prisma.comboPassItem.create({
            data: {
              comboId,
              digitalPassId: pass.id,
              quantity: 1,
            },
          });
        }

        await recordAuditLog({
          actorId: req.admin!.id,
          action: 'PASS_CREATED',
          entityType: 'DigitalPass',
          entityId: pass.id,
          metadata: { name: pass.name, kind: pass.kind, generated: true, comboId: comboId ?? null },
        });

        createdPasses.push(pass);
      }

      res.status(201).json({ success: true, data: { passes: createdPasses } });
    } catch (error) {
      await Promise.all(uploadedKeys.map((k) => deleteObject(k).catch(() => undefined)));
      next(error);
    }
  },
);

adminPassesRouter.post(
  '/signed-upload',
  validate({ body: signedUploadSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { passId, fileName, contentType } = req.body as z.infer<typeof signedUploadSchema>;
      const key = r2KeyBuilders.passFile(passId, fileName);
      const signed = await getSignedUploadUrl({ key, contentType });
      res.status(200).json({ success: true, data: signed });
    } catch (error) {
      next(error);
    }
  },
);

adminPassesRouter.post(
  '/',
  validate({ body: createPassSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body as z.infer<typeof createPassSchema>;
      const pass = await prisma.digitalPass.create({ data });

      await recordAuditLog({
        actorId: req.admin!.id,
        action: 'PASS_CREATED',
        entityType: 'DigitalPass',
        entityId: pass.id,
        metadata: { name: pass.name },
      });

      res.status(201).json({ success: true, data: { pass } });
    } catch (error) {
      next(error);
    }
  },
);

adminPassesRouter.patch(
  '/:id',
  validate({ params: passIdSchema, body: updatePassSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.digitalPass.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError('Pase digital no encontrado');

      const pass = await prisma.digitalPass.update({
        where: { id: req.params.id },
        data: req.body as z.infer<typeof updatePassSchema>,
      });

      await recordAuditLog({
        actorId: req.admin!.id,
        action: 'PASS_UPDATED',
        entityType: 'DigitalPass',
        entityId: pass.id,
      });

      res.status(200).json({ success: true, data: { pass } });
    } catch (error) {
      next(error);
    }
  },
);

adminPassesRouter.get(
  '/:id/preview',
  validate({ params: passIdSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.digitalPass.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true, kind: true, fileKey: true, mimeType: true },
      });
      if (!existing) throw new NotFoundError('Pase digital no encontrado');

      const { downloadUrl, expiresInSeconds } = await getSignedDownloadUrl({
        key: existing.fileKey,
        expiresInSeconds: 300,
      });

      res.status(200).json({
        success: true,
        data: {
          url: downloadUrl,
          expiresInSeconds,
          name: existing.name,
          mimeType: existing.mimeType,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

adminPassesRouter.get(
  '/:id/preview-stamped',
  validate({ params: passIdSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.digitalPass.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true, kind: true, fileKey: true, mimeType: true },
      });
      if (!existing) throw new NotFoundError('Pase digital no encontrado');
      if (!existing.mimeType.startsWith('image/')) {
        throw new ValidationError('Solo se puede previsualizar estampado en pases de imagen');
      }

      const defaultText = existing.kind === 'FICHA' ? '12345' : 'PRM-A1B2C3D4';
      const rawNumber =
        typeof req.query.number === 'string' && /^[a-zA-Z0-9-]{1,16}$/.test(req.query.number)
          ? req.query.number
          : defaultText;

      const templateBuffer = await getObjectBuffer(existing.fileKey);
      const buffer = await generateStampedPassImage({
        templateBuffer,
        text: rawNumber,
        resizeTo: 600,
      });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  },
);

adminPassesRouter.delete(
  '/:id',
  validate({ params: passIdSchema }),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.digitalPass.findUnique({
        where: { id: req.params.id },
        include: {
          _count: { select: { comboItems: true } },
        },
      });
      if (!existing) throw new NotFoundError('Pase digital no encontrado');

      const isReferenced = existing._count.comboItems > 0;

      if (isReferenced) {
        await prisma.digitalPass.update({
          where: { id: existing.id },
          data: { isActive: false },
        });
      } else {
        await prisma.digitalPass.delete({ where: { id: existing.id } });
      }

      await recordAuditLog({
        actorId: req.admin!.id,
        action: isReferenced ? 'PASS_DEACTIVATED' : 'PASS_DELETED',
        entityType: 'DigitalPass',
        entityId: existing.id,
        metadata: { name: existing.name },
      });

      res.status(200).json({
        success: true,
        data: { deleted: !isReferenced, deactivated: isReferenced },
      });
    } catch (error) {
      next(error);
    }
  },
);
