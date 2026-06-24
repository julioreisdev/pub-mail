export const authMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validKey = process.env.IA_SERVICE_KEY;

    if (!apiKey || apiKey !== validKey) {
        return res.status(401).json({
            success: false,
            message: 'Acesso negado. Chave de API inválida ou ausente.'
        });
    }

    next();
};