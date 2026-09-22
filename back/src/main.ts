import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express'; // <-- Importado para tipagem
import { join } from 'path'; // <-- Importado para resolver caminhos de pastas

async function bootstrap() {
  // Tipamos o app como NestExpressApplication para acessar o useStaticAssets
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Body limit 10mb (era 200mb): webchat + uploads de avatar/logo cabem
  // confortavelmente. Sob tráfego pago, 200mb × N reqs concorrentes podia
  // estourar heap. 10mb cobre todos os casos legítimos.
  const bodyLimit = process.env.HTTP_BODY_LIMIT || '10mb';

  // Guarda o corpo bruto (rawBody) — necessário para verificar a assinatura
  // Svix dos webhooks do Resend (a assinatura é sobre os bytes exatos).
  app.use(
    json({
      limit: bodyLimit,
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // -----------------------
  // Arquivos Estáticos (Uploads públicos)
  // -----------------------
  // CORRIGIDO: process.cwd() força o NestJS a olhar para a raiz absoluta do projeto
  // Nomes de arquivo são UUID (imutáveis) → cache longo p/ carregar instantâneo
  // nas próximas aberturas do e-mail (proxies como o do Gmail respeitam isso).
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    maxAge: '365d',
    immutable: true,
  });

  // -----------------------
  // ValidationPipe (recomendado)
  // -----------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos não declarados no DTO
      forbidNonWhitelisted: true, // dá erro se enviar campo extra
      transform: true, // transforma query params pra number/bool quando DTO usa @Type()
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // -----------------------
  // Swagger
  // -----------------------
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pub Mail')
    .setDescription('Documentação da API')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // -----------------------
  // Listen
  // -----------------------
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}
bootstrap();
