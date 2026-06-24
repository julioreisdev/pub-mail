import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 9999;

app.listen(PORT, () => {
    console.log(`🚀 Micro-serviço de E-mail rodando na porta ${PORT}`);
});