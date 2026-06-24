import { Router } from 'express';
import { authMiddleware } from '../utils/auth.middleware.js';
import { createWebchatReply } from '../controllers/webchat.controller.js';

const router = Router();

router.post('/ia-webchat/reply', authMiddleware, createWebchatReply);

export default router;
