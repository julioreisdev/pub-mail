import app from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`🚀 AI Micro-service rodando na porta ${PORT}`);
    console.log(`🔒 Endpoint disponível: POST http://localhost:${PORT}/api/ia-email-template`);
    console.log(`🔒 Endpoint disponível: POST http://localhost:${PORT}/api/ia-webchat/reply`);
});
