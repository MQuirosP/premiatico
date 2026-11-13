import { z } from 'zod';

export const createPrizeSchema = z.object({
  campaignId: z.string().min(1),
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().min(5).max(3000),
  estimatedValue: z.coerce.number().int().nonnegative().optional().nullable(),
  imageKey: z.string().trim().max(300).optional().nullable(),
  position: z.coerce.number().int().min(0).default(0),
  drawAt: z.string().datetime().optional().nullable(),
  drawReference: z.string().trim().max(160).optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
});

export const updatePrizeSchema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().min(5).max(3000).optional(),
  estimatedValue: z.coerce.number().int().nonnegative().optional().nullable(),
  imageKey: z.string().trim().max(300).optional().nullable(),
  position: z.coerce.number().int().min(0).optional(),
  drawAt: z.string().datetime().optional().nullable(),
  drawReference: z.string().trim().max(160).optional().nullable(),
});

export const prizeIdSchema = z.object({ id: z.string().min(1) });

export const evaluatePrizeWinnerSchema = z.object({
  winningNumber: z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, 'El número ganador debe contener solo dígitos'),
  notes: z.string().trim().max(500).optional(),
  allowDuplicateOrder: z.boolean().optional().default(false),
});
