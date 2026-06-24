import express from 'express';
import { receivePayload } from './controller.js';

const router = express.Router();

// O NestJS vai bater num POST /send
router.post('/send', receivePayload);

export default router;