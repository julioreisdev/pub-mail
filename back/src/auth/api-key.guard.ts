import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

// Compara em tempo constante (A-80). Tamanhos diferentes => false sem vazar
// quanto do segredo bateu.
function safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length || ba.length === 0) return false;
    return timingSafeEqual(ba, bb);
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
    private readonly logger = new Logger(ApiKeyGuard.name);

    constructor(private configService: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        // Vamos esperar que o micro-serviço envie a chave no header 'x-api-key'
        const rawHeader = request.headers['x-api-key'];
        const apiKeyHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

        // Pega a chave real do seu .env
        const validApiKey = this.configService.get<string>('EMAIL_SERVICE_KEY');

        // Não configurada => nega (401), sem virar 500 nem aceitar tudo.
        if (!validApiKey) {
            this.logger.error('EMAIL_SERVICE_KEY não está configurada no .env do NestJS — rota protegida negada.');
            throw new UnauthorizedException('Chave de API inválida ou ausente');
        }

        if (typeof apiKeyHeader !== 'string' || !safeEqual(apiKeyHeader, validApiKey)) {
            throw new UnauthorizedException('Chave de API inválida ou ausente');
        }

        return true; // Passou na verificação!
    }
}
