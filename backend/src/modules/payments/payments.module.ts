import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors.js';
import { prisma } from '../../core/prisma.js';
import { validate } from '../../middlewares/validate.js';
import { hashToken } from '../reservations/reservations.module.js';
import { r2KeyBuilders, uploadObject } from '../storage/storage.service.js';

const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROOF_BYTES },
});

function hasValidMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (mimeType === 'application/pdf') {
    return buffer.subarray(0, 4).toString('ascii') === '%PDF';
  }
  return false;
}

const proofParamsSchema = z.object({
  publicReference: z.string().trim().min(5).max(30),
});

const proofBodySchema = z.object({
  accessToken: z.string().min(16),
});

export const publicPaymentsRouter = Router();

publicPaymentsRouter.post(
  '/orders/:publicReference/proof',
  upload.single('proof'),
  validate({ params: proofParamsSchema, body: proofBodySchema }),
  async (req: Request<{ publicReference: string }>, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        throw new ValidationError('Debés adjuntar el comprobante SINPE (JPG, PNG, WEBP o PDF)');
      }

      if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !hasValidMagicBytes(file.buffer, file.mimetype)) {
        throw new ValidationError('Formato de comprobante no permitido o archivo inválido');
      }

      const { accessToken } = req.body as z.infer<typeof proofBodySchema>;
      const accessTokenHash = hashToken(accessToken);

      const order = await prisma.order.findUnique({
        where: { publicReference: req.params.publicReference },
        include: {
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      if (!order || order.accessTokenHash !== accessTokenHash) {
        throw new NotFoundError('Pedido no encontrado');
      }

      if (order.status !== 'PENDING_PAYMENT') {
        throw new ConflictError('Este pedido ya no admite adjuntar comprobantes');
      }

      if (order.expiresAt <= new Date()) {
        throw new ConflictError('El tiempo para adjuntar el comprobante expiró');
      }

      const payment = order.payments[0];
      if (!payment || payment.status !== 'PENDING') {
        throw new ConflictError('El pago no está en estado pendiente');
      }

      const storageKey = r2KeyBuilders.paymentProof(payment.id, file.originalname);
      await uploadObject({
        key: storageKey,
        body: file.buffer,
        contentType: file.mimetype,
      });

      const updated = await prisma.$transaction(async (tx) => {
        const proof = await tx.paymentProof.create({
          data: {
            paymentId: payment.id,
            storageKey,
            mimeType: file.mimetype,
            fileSize: file.size,
          },
        });

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'UNDER_REVIEW' },
        });

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'UNDER_REVIEW' },
        });

        // Protect chances from automatic expiration while under manual review
        await tx.participation.updateMany({
          where: {
            orderId: order.id,
            status: 'RESERVED',
          },
          data: {
            reservedUntil: null,
          },
        });

        return proof;
      });

      res.status(201).json({
        success: true,
        data: {
          message: 'Comprobante recibido. Estamos verificando tu pago.',
          orderStatus: 'UNDER_REVIEW',
          proofId: updated.id,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
