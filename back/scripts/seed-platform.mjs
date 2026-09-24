#!/usr/bin/env node
// Seed de instalação do zero (banco limpo). Gera o SQL (idempotente) que:
//  1) cria o singleton system_settings (id=1) com IP de borda + e-mail do certbot;
//  2) cria a organização OCULTA do desenvolvedor (hidden=1) + carteira + usuário SUPER_ADMIN.
// Nada de senha no código: tudo vem de variáveis de ambiente. Uso:
//   SEED_ADMIN_EMAIL=dev@empresa.com SEED_ADMIN_PASSWORD='...' SEED_EDGE_IP=1.2.3.4 SEED_CERTBOT_EMAIL=ops@empresa.com \
//     node scripts/seed-platform.mjs | mysql -u pubmail -p"$DB_PASS" -h 127.0.0.1 pubmail
import bcrypt from 'bcryptjs';

const need = (k) => { const v = process.env[k]; if (!v) { console.error(`Falta ${k}`); process.exit(1); } return v; };
const email = need('SEED_ADMIN_EMAIL').toLowerCase().trim();
const password = need('SEED_ADMIN_PASSWORD');
const orgName = process.env.SEED_ORG_NAME || 'SuperAdmin';
const adminName = process.env.SEED_ADMIN_NAME || 'Super Admin';
const edgeIp = process.env.SEED_EDGE_IP || '';
const certbotEmail = process.env.SEED_CERTBOT_EMAIL || '';
if (password.length < 8) { console.error('SEED_ADMIN_PASSWORD: mínimo 8 caracteres'); process.exit(1); }
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
const hash = bcrypt.hashSync(password, 12);

console.log(`
-- system_settings: só infra da plataforma
INSERT INTO system_settings (id, webchat_edge_ip, certbot_email, created_at, updated_at)
VALUES (1, NULLIF(${q(edgeIp)}, ''), NULLIF(${q(certbotEmail)}, ''), NOW(), NOW())
ON DUPLICATE KEY UPDATE
  webchat_edge_ip = COALESCE(NULLIF(${q(edgeIp)}, ''), webchat_edge_ip),
  certbot_email  = COALESCE(NULLIF(${q(certbotEmail)}, ''), certbot_email);

-- organização oculta do desenvolvedor (invisível na API admin para as demais orgs)
SET @org := (SELECT id FROM organizations WHERE name = ${q(orgName)} AND hidden = 1 LIMIT 1);
SET @org := IFNULL(@org, UUID());
INSERT INTO organizations (id, name, status, hidden, created_at, updated_at)
SELECT @org, ${q(orgName)}, 1, 1, NOW(), NOW() FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE id = @org);
INSERT INTO wallets (id, organization_id, balance, status)
SELECT UUID(), @org, 0, 'ACTIVE' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE organization_id = @org);

-- usuário SUPER_ADMIN (senha bcrypt 12; se já existir, atualiza senha/role e invalida sessões)
INSERT INTO users (id, organization_id, name, email, password_hash, role, active)
VALUES (UUID(), @org, ${q(adminName)}, ${q(email)}, ${q(hash)}, 'SUPER_ADMIN', 1)
ON DUPLICATE KEY UPDATE organization_id = @org, password_hash = VALUES(password_hash), role = 'SUPER_ADMIN', active = 1, refresh_token = NULL;

SELECT 'seed-platform OK' AS result;
`);
