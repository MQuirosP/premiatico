import { z } from 'zod';

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(3, 'Ingresá tu usuario o correo').toLowerCase().optional(),
    email: z.string().trim().min(3, 'Ingresá tu usuario o correo').toLowerCase().optional(),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  })
  .refine((data) => Boolean(data.identifier || data.email), {
    message: 'Ingresá tu usuario o correo electrónico',
    path: ['identifier'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
