import { z } from 'zod';

export const paymentIdParamSchema = z.object({ id: z.string().min(1) });

export const approvePaymentSchema = z.object({
  reviewNotes: z.string().trim().max(500).optional(),
});

export const rejectPaymentSchema = z.object({
  rejectionReason: z.string().trim().min(5).max(300),
  reviewNotes: z.string().trim().max(500).optional(),
});
