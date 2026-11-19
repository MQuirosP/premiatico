import { z } from 'zod';
import {
  CampaignDrawMode,
  campaignDrawModeSchema,
  legalApprovalStatusSchema,
} from '../../core/domain-constants.js';

export const CAMPAIGN_THEME_COLORS = [
  'classic',
  'ocean',
  'emerald',
  'crimson',
  'violet',
  'gold',
  'magenta',
] as const;

export const createCampaignSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener letras minúsculas, números y guiones')
    .min(3)
    .max(80),
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(5000),
  category: z.string().trim().min(2).max(60),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  drawAt: z.coerce.date().optional().nullable(),
  drawReference: z.string().trim().max(160).optional().nullable(),
  totalFichas: z.coerce.number().int().min(1).max(100000),
  maxNumberChanges: z.coerce.number().int().min(0).max(20).default(5),
  enableInverseNumbers: z.boolean().default(false),
  themeColor: z.enum(CAMPAIGN_THEME_COLORS).default('classic'),
  countdownTitle: z.string().trim().max(120).optional().nullable(),
  drawMode: campaignDrawModeSchema.default(CampaignDrawMode.SINGLE_WINNER),
  reservationMinutes: z.coerce.number().int().min(5).max(120).default(15),
  paymentWindowMinutes: z.coerce.number().int().min(10).max(1440).default(60),
  reviewSlaHours: z.coerce.number().int().min(1).max(168).default(24),
  requiresLegalApproval: z.boolean().default(true),
  legalApprovalStatus: legalApprovalStatusSchema.optional(),
  legalApprovalReference: z.string().trim().max(120).optional().nullable(),
  terms: z.string().trim().min(10).max(10000),
  coverImageKey: z.string().trim().max(300).optional().nullable(),
  galleryImages: z
    .array(
      z.object({
        imageKey: z.string().trim().min(1).max(300),
        isCover: z.boolean().default(false),
      }),
    )
    .max(7, 'Máximo 7 fotos por campaña')
    .optional(),
}).refine((data) => data.endAt > data.startAt, {
  message: 'La fecha de cierre debe ser posterior a la fecha de inicio',
  path: ['endAt'],
});

export const updateCampaignSchema = z.object({
  title: z.string().trim().min(3).max(140).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  category: z.string().trim().min(2).max(60).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  drawAt: z.coerce.date().optional().nullable(),
  drawReference: z.string().trim().max(160).optional().nullable(),
  totalFichas: z.coerce.number().int().min(1).max(100000).optional(),
  maxNumberChanges: z.coerce.number().int().min(0).max(20).optional(),
  enableInverseNumbers: z.boolean().optional(),
  themeColor: z.enum(CAMPAIGN_THEME_COLORS).optional(),
  countdownTitle: z.string().trim().max(120).optional().nullable(),
  drawMode: campaignDrawModeSchema.optional(),
  reservationMinutes: z.coerce.number().int().min(5).max(120).optional(),
  paymentWindowMinutes: z.coerce.number().int().min(10).max(1440).optional(),
  reviewSlaHours: z.coerce.number().int().min(1).max(168).optional(),
  requiresLegalApproval: z.boolean().optional(),
  legalApprovalStatus: legalApprovalStatusSchema.optional(),
  legalApprovalReference: z.string().trim().max(120).optional().nullable(),
  terms: z.string().trim().min(10).max(10000).optional(),
  coverImageKey: z.string().trim().max(300).optional().nullable(),
  galleryImages: z
    .array(
      z.object({
        imageKey: z.string().trim().min(1).max(300),
        isCover: z.boolean().default(false),
      }),
    )
    .max(7, 'Máximo 7 fotos por campaña')
    .optional(),
});

export const campaignIdParamSchema = z.object({
  id: z.string().min(1),
});

export const campaignSlugParamSchema = z.object({
  slug: z.string().min(1),
});

export const evaluateWinnerSchema = z.object({
  winningNumber: z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, 'El número ganador debe contener solo dígitos'),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type EvaluateWinnerInput = z.infer<typeof evaluateWinnerSchema>;
