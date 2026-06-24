import express from 'express';
import cors from 'cors';
import compression from 'compression';
import emailRoutes from './routes/email.routes.js';
import webchatRoutes from './routes/webchat.routes.js';
import keysStatusRoutes from './routes/keys-status.routes.js';

const app = express();

app.use(cors());
// gzip nas respostas. Webchat reply pode chegar a alguns KB (com history +
// options); sob tráfego alto isso reduz banda significativamente.
app.use(compression());
// Limite ajustado: webchat payload típico < 100KB. 1MB já cobre casos
// extremos com histórico longo. Default Express é 100kb — apertado pra
// alguns prompts grandes.
app.use(express.json({ limit: '1mb' }));

app.use('/api', emailRoutes);
app.use('/api', webchatRoutes);
app.use('/api', keysStatusRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'AI Microservice' });
});

export default app;