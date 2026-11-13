import { z } from 'zod';

export const createOrderSchema = z.object({
  sessionId: z.string().min(1),
  sessionToken: z.string().min(16),
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().email('Correo electrónico inválido').toLowerCase(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{8,20}$/, 'Teléfono inválido (formato Costa Rica: 8 dígitos)'),
});

export const orderLookupParamsSchema = z.object({
  publicReference: z.string().trim().min(5).max(30),
});

export const orderLookupQuerySchema = z.object({
  token: z.string().min(16),
});

export const customerOrderLookupSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(5, 'Ingresá tu correo electrónico o número de teléfono')
    .max(120),
});
