#!/usr/bin/env node
// Inicialização do back no Docker de DESENVOLVIMENTO (docker-compose.yml, perfil "app").
//  1) aplica as migrations do Prisma (espera o MySQL aceitar conexões);
//  2) na 1ª vez, cria a organização oculta + usuário SUPER_ADMIN (scripts/seed-platform.mjs),
//     usando SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD — se o usuário já existe, não mexe;
//  3) sobe a API (dist/src/main.js).
// Em Node (e não em .sh) para não quebrar com fim de linha do Windows.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mariadb from 'mariadb';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dbConfig = {
  host: env.DATABASE_HOST || '127.0.0.1',
  port: Number(env.DATABASE_PORT || 3306),
  user: env.DATABASE_USER,
  password: env.DATABASE_PASS,
  database: env.DATABASE_NAME,
  allowPublicKeyRetrieval: true,
};

async function waitForDb() {
  for (let i = 1; i <= 60; i++) {
    try {
      const conn = await mariadb.createConnection(dbConfig);
      await conn.end();
      return;
    } catch (e) {
      if (i === 60) throw e;
      console.log(`[dev-start] aguardando o MySQL (${i}/60): ${e.code || e.message}`);
      await sleep(2000);
    }
  }
}

async function seedOnce() {
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    console.log('[dev-start] SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD vazios: nenhum usuário criado.');
    return;
  }
  const conn = await mariadb.createConnection({ ...dbConfig, multipleStatements: true });
  try {
    const rows = await conn.query('SELECT COUNT(*) AS n FROM users WHERE email = ?', [env.SEED_ADMIN_EMAIL.toLowerCase().trim()]);
    if (Number(rows[0].n) > 0) {
      console.log(`[dev-start] usuário ${env.SEED_ADMIN_EMAIL} já existe.`);
      return;
    }
    const sql = execFileSync('node', [join(root, 'scripts/seed-platform.mjs')], { env, encoding: 'utf8' });
    await conn.query(sql);
    console.log(`[dev-start] SUPER_ADMIN criado: ${env.SEED_ADMIN_EMAIL}`);
  } finally {
    await conn.end();
  }
}

await waitForDb();
console.log('[dev-start] aplicando migrations…');
execFileSync('yarn', ['prisma', 'migrate', 'deploy'], { cwd: root, stdio: 'inherit', env });
await seedOnce();
console.log('[dev-start] subindo a API…');
await import(pathToFileURL(join(root, 'dist/src/main.js')).href);
