import { Router } from 'express';
import { requireAdminAuth } from '../../middlewares/authAdmin.js';
import { validate } from '../../middlewares/validate.js';
import { loginController, logoutController, meController } from './auth.controller.js';
import { loginSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/login', validate({ body: loginSchema }), loginController);
authRouter.post('/logout', requireAdminAuth, logoutController);
authRouter.get('/me', requireAdminAuth, meController);
