import { Router } from 'express';
import { createEmailTemplate } from '../controllers/email.controller.js';
import { authMiddleware } from '../utils/auth.middleware.js';

const router = Router();

router.post('/ia-email-template', authMiddleware, createEmailTemplate);

export default router;