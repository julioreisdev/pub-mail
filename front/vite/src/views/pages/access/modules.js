// Módulos do Pub Mail (espelho de back/src/platform-billing/modules.const.ts).
// Usado pelo menu, pelas rotas, pelo dashboard e pelos modais de acesso.
import { IconMailBolt, IconBrandHipchat, IconListLetters, IconBrandTelegram, IconSettings } from '@tabler/icons-react';

export const ALL_MODULES = ['email', 'webchat', 'quiz', 'telegram', 'settings'];

export const MODULE_DEFS = {
  email: { key: 'email', label: 'E-mail Marketing', description: 'Projetos, templates, automações e analytics', Icon: IconMailBolt, color: '#f59e0b' },
  webchat: { key: 'webchat', label: 'Webchat com IA', description: 'Chat com IA, funis e vendas por PIX', Icon: IconBrandHipchat, color: '#377EF0' },
  quiz: { key: 'quiz', label: 'Quizzes', description: 'Quizzes, captação e anúncios', Icon: IconListLetters, color: '#a855f7' },
  telegram: { key: 'telegram', label: 'Telegram', description: 'Bots, broadcasts e conteúdo VIP', Icon: IconBrandTelegram, color: '#2AABEE' },
  settings: { key: 'settings', label: 'Configurações', description: 'Conta, domínios, integrações e chaves', Icon: IconSettings, color: '#64748b' }
};

export const formatBRL = (cents) => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
};

// "R$ 97,00 a cada 30 dias" / "R$ 497,00 · pagamento único" / "Gratuito"
export function planLabel(access) {
  if (!access) return '';
  if (!access.price_cents) return 'Acesso gratuito';
  if (access.lifetime || access.period_days == null) return `${formatBRL(access.price_cents)} · pagamento único (vitalício)`;
  return `${formatBRL(access.price_cents)} a cada ${access.period_days} dias`;
}
