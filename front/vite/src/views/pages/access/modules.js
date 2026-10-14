// Módulos do Pub Mail (espelho de back/src/platform-billing/modules.const.ts).
// Usado pelo menu, pelas rotas, pelo dashboard e pelos modais de acesso.
import {
  IconMailBolt,
  IconBrandHipchat,
  IconListLetters,
  IconBrandTelegram,
  IconBrandWhatsapp,
  IconBrandWordpress,
  IconSettings
} from '@tabler/icons-react';

export const ALL_MODULES = ['email', 'webchat', 'quiz', 'telegram', 'whatsapp', 'wordpress', 'settings'];

export const MODULE_DEFS = {
  email: {
    key: 'email',
    label: 'E-mail Marketing',
    description: 'Disparos, construtor, automações e métricas',
    Icon: IconMailBolt,
    color: '#f59e0b'
  },
  webchat: {
    key: 'webchat',
    label: 'Webchat com IA',
    description: 'Chat com IA, funis e vendas por PIX',
    Icon: IconBrandHipchat,
    color: '#377EF0'
  },
  quiz: { key: 'quiz', label: 'Quizzes', description: 'Quizzes, captação e anúncios', Icon: IconListLetters, color: '#a855f7' },
  telegram: {
    key: 'telegram',
    label: 'Telegram',
    description: 'Bots, broadcasts e conteúdo VIP',
    Icon: IconBrandTelegram,
    color: '#2AABEE'
  },
  whatsapp: {
    key: 'whatsapp',
    label: 'WhatsApp',
    description: 'Chat da equipe, bot, CRM, assinaturas e cobranças',
    Icon: IconBrandWhatsapp,
    color: '#25D366'
  },
  wordpress: { key: 'wordpress', label: 'WordPress', description: 'Tradutor Invisível e notificações push', Icon: IconBrandWordpress, color: '#21759b' },
  settings: {
    key: 'settings',
    label: 'Configurações',
    description: 'Conta, domínios, pagamentos e integrações',
    Icon: IconSettings,
    color: '#64748b'
  }
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

// Sub-permissões do módulo WhatsApp (Fase 7, espelho de SUB_PERMISSIONS em modules.const.ts).
// Só valem junto com `whatsapp`; OWNER/ADMIN/SUPER_ADMIN têm todas. Guardadas em `users.modules`;
// `whatsapp:basic` = marcador "nenhuma escolhida" (sem ele o back dá as três).
export const WA_SUB_PERMISSIONS = [
  { key: 'whatsapp:finance', label: 'Cobranças e financeiro', hint: 'Cobranças, cartões salvos e relatório financeiro.' },
  { key: 'whatsapp:crm', label: 'Clientes, produtos e assinaturas', hint: 'Lista de clientes, catálogo, assinaturas, cupons e unidades.' },
  { key: 'whatsapp:settings', label: 'Configurações do WhatsApp', hint: 'Números, fluxo do bot, etiquetas, respostas rápidas e modelos.' }
];
export const WA_SUB_KEYS = WA_SUB_PERMISSIONS.map((p) => p.key);
export const WA_SUB_MARKER = 'whatsapp:basic';
export const permissionLabel = (p) => WA_SUB_PERMISSIONS.find((x) => x.key === p)?.label || p;
