import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';


@Injectable()
export class PrismaService extends PrismaClient implements  OnModuleDestroy, OnModuleInit {

    constructor() {
        // Pool POR INSTÂNCIA. Rodamos 4 instâncias (cluster mode via systemd
        // template), cada uma com seu próprio pool. 4 × 50 = 200 conns
        // efetivas contra MySQL max=800 — folga grande.
        // Em dev/single-instance, override via DATABASE_POOL_LIMIT.
        const connectionLimit = Number(process.env.DATABASE_POOL_LIMIT) || 50;
        const connectTimeout = Number(process.env.DATABASE_CONNECT_TIMEOUT) || 10_000;
        const acquireTimeout = Number(process.env.DATABASE_ACQUIRE_TIMEOUT) || 30_000;
        const adapter = new PrismaMariaDb({
             host: process.env.DATABASE_HOST,
             user: process.env.DATABASE_USER,
             password: process.env.DATABASE_PASS,
             database: process.env.DATABASE_NAME,
             port: Number(process.env.DATABASE_PORT),
             allowPublicKeyRetrieval: true,
             ssl: false,
             connectionLimit,
             connectTimeout,
             acquireTimeout,
        });

        super({ adapter });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

}
