import { generateEmailTemplate } from '../services/email.service.js';

const normalizeApiKeys = (raw) => {
    if (Array.isArray(raw)) {
        return raw.map((k) => String(k || '').trim()).filter((k) => k.length > 0);
    }
    if (typeof raw === 'string') {
        return raw
            .split(/[,\n]/)
            .map((k) => k.trim())
            .filter((k) => k.length > 0);
    }
    return [];
};

export const createEmailTemplate = async (req, res) => {
    try {
        const { prompt, groq_api_keys } = req.body;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                message: 'O campo "prompt" é obrigatório no corpo da requisição.'
            });
        }

        const apiKeys = normalizeApiKeys(groq_api_keys);
        if (apiKeys.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nenhuma chave da Groq foi enviada. Configure em Conta & Domínios > Integrações.'
            });
        }

        const template = await generateEmailTemplate(prompt, apiKeys);

        return res.status(200).json({
            success: true,
            data: template
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Erro interno no servidor.'
        });
    }
};
