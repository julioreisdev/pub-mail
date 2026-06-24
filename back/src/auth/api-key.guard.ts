import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private configService: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        // Vamos esperar que o micro-serviço envie a chave no header 'x-api-key'
        const apiKeyHeader = request.headers['x-api-key'];

        // Pega a chave real do seu .env
        const validApiKey = this.configService.get<string>('EMAIL_SERVICE_KEY');

        if (!validApiKey) {
            throw new Error('Atenção: EMAIL_SERVICE_KEY não está configurada no .env do NestJS!');
        }

        if (apiKeyHeader !== validApiKey) {
            throw new UnauthorizedException('Chave de API inválida ou ausente');
        }

        return true; // Passou na verificação!
    }
}