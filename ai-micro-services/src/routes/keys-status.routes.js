import { Router } from 'express';
import { authMiddleware } from '../utils/auth.middleware.js';
import { getKeysStatus } from '../controllers/keys-status.controller.js';

const router = Router();

// POST porque mandamos o bundle de chaves no body (não cabe em querystring
// e não queremos elas em logs de URL).
router.post('/ia-keys-status', authMiddleware, getKeysStatus);

export default router;
