import { enqueueEmailJob } from './service.js';

export async function receivePayload(req, res) {
    try {
        const payload = req.body;

        if (!payload || !payload.dispatchId) {
            return res.status(400).json({ error: 'Payload inválida ou sem dispatchId' });
        }

        if (!payload.resend_api_key || typeof payload.resend_api_key !== 'string' || !payload.resend_api_key.trim()) {
            return res.status(400).json({ error: 'Payload sem resend_api_key. Configure em Conta & Domínios > Integrações.' });
        }

        // Manda para a fila (isso leva apenas milissegundos)
        await enqueueEmailJob(payload);

        // Libera o NestJS para ele não ficar esperando
        return res.status(201).json({ message: 'Payload recebida e enfileirada com sucesso!' });
    } catch (error) {
        console.error('Erro ao enfileirar:', error);
        return res.status(500).json({ error: 'Erro interno no micro-serviço' });
    }
}
