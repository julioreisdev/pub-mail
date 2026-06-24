import express from 'express';
import router from './router.js';

const app = express();

// Middleware para entender o JSON (payload gigante do NestJS)
app.use(express.json({ limit: '50mb' }));

// Usa as rotas definidas no router.js
app.use('/', router);

export default app;