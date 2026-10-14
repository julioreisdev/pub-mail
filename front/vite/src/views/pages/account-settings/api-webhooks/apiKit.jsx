import { useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconCheck, IconCopy } from '@tabler/icons-react';

// ============================================================================
// Configurações → API e Webhooks (Fase 5): constantes e peças compartilhadas
// (escopos das chaves, eventos dos webhooks, caixa de segredo, bloco de código).
// ============================================================================

export const errMsg = (e, fb) => {
  const m = e?.response?.data?.message ?? e?.message;
  return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};

export const asPage = (r) => {
  if (Array.isArray(r)) return { items: r, total: r.length, page: 1, pages: 1 };
  const items = Array.isArray(r?.items) ? r.items : [];
  return { items, total: r?.total ?? items.length, page: r?.page ?? 1, pages: Math.max(1, r?.pages ?? 1) };
};

export const API_BASE = `${String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/api/v1/whatsapp`;

export const fmtDT = (v) => {
  if (!v) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(v));
  } catch {
    return '—';
  }
};

// ---------------------------------------------------------------- escopos
export const SCOPE_GROUPS = [
  {
    key: 'customers',
    label: 'Clientes',
    scopes: [
      { value: 'customers:read', label: 'Ler' },
      { value: 'customers:write', label: 'Criar e editar' }
    ]
  },
  {
    key: 'subscriptions',
    label: 'Assinaturas',
    scopes: [
      { value: 'subscriptions:read', label: 'Ler' },
      { value: 'subscriptions:write', label: 'Criar, cancelar, pausar e trocar plano' }
    ]
  },
  {
    key: 'charges',
    label: 'Cobranças',
    scopes: [
      { value: 'charges:read', label: 'Ler' },
      { value: 'charges:write', label: 'Criar, reenviar e cancelar' }
    ]
  },
  { key: 'messages', label: 'Mensagens', scopes: [{ value: 'messages:send', label: 'Enviar mensagens' }] },
  { key: 'contacts', label: 'Contatos', scopes: [{ value: 'contacts:write', label: 'Descadastrar / reativar (LGPD)' }] },
  { key: 'entitlements', label: 'Acessos', scopes: [{ value: 'entitlements:read', label: 'Ler' }] },
  { key: 'products', label: 'Produtos', scopes: [{ value: 'products:read', label: 'Ler' }] }
];
export const ALL_SCOPES = SCOPE_GROUPS.flatMap((g) => g.scopes.map((s) => s.value));
export const READ_SCOPES = ALL_SCOPES.filter((s) => s.endsWith(':read'));
export const scopeLabel = (v) => {
  for (const g of SCOPE_GROUPS) {
    const s = g.scopes.find((x) => x.value === v);
    if (s) return `${g.label}: ${s.label.toLowerCase()}`;
  }
  return v;
};

// ---------------------------------------------------------------- eventos
export const MESSAGE_EVENT = 'message.received';
export const EVENT_GROUPS = [
  {
    label: 'Clientes',
    events: [
      { value: 'customer.created', label: 'Cliente criado' },
      { value: 'customer.updated', label: 'Cliente alterado' },
      { value: 'customer.erased', label: 'Dados do cliente apagados (LGPD)' }
    ]
  },
  {
    label: 'Assinaturas',
    events: [
      { value: 'subscription.created', label: 'Criada' },
      { value: 'subscription.activated', label: 'Ativada (1º pagamento)' },
      { value: 'subscription.paid', label: 'Paga' },
      { value: 'subscription.overdue', label: 'Em atraso' },
      { value: 'subscription.paused', label: 'Pausada' },
      { value: 'subscription.resumed', label: 'Retomada' },
      { value: 'subscription.cancel_scheduled', label: 'Cancelamento agendado' },
      { value: 'subscription.canceled', label: 'Cancelada' },
      { value: 'subscription.reactivated', label: 'Reativada' },
      { value: 'subscription.plan_changed', label: 'Troca de plano' }
    ]
  },
  {
    label: 'Cobranças',
    events: [
      { value: 'charge.created', label: 'Criada' },
      { value: 'charge.paid', label: 'Paga' },
      { value: 'charge.expired', label: 'Expirada' },
      { value: 'charge.canceled', label: 'Cancelada' }
    ]
  },
  {
    label: 'Acessos liberados',
    events: [
      { value: 'entitlement.activated', label: 'Liberado' },
      { value: 'entitlement.suspended', label: 'Suspenso' },
      { value: 'entitlement.revoked', label: 'Revogado' },
      { value: 'entitlement.failed', label: 'Falhou' }
    ]
  }
];
export const ALL_EVENTS = EVENT_GROUPS.flatMap((g) => g.events.map((e) => e.value));
export const eventLabel = (v) => {
  if (v === MESSAGE_EVENT) return 'Mensagem recebida';
  if (v === 'ping') return 'Teste (ping)';
  for (const g of EVENT_GROUPS) {
    const e = g.events.find((x) => x.value === v);
    if (e) return `${g.label} · ${e.label}`;
  }
  return v;
};

// ---------------------------------------------------------------- copiar
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ text, label = 'Copiar', size = 16 }) {
  const [done, setDone] = useState(false);
  const run = async () => {
    const ok = await copyText(text);
    if (!ok) {
      toast.error('Não foi possível copiar. Selecione e copie à mão.');
      return;
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return (
    <Tooltip title={done ? 'Copiado!' : label}>
      <IconButton size="small" onClick={run} aria-label={label}>
        {done ? <IconCheck size={size} /> : <IconCopy size={size} />}
      </IconButton>
    </Tooltip>
  );
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** Valor que só aparece UMA vez (chave de API / segredo do webhook). */
export function SecretBox({ value, title, warning }) {
  return (
    <Stack spacing={1.25}>
      {title ? (
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      ) : null}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', minWidth: 0 }}
      >
        <Typography
          component="code"
          sx={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 13, fontWeight: 600, overflowWrap: 'anywhere', userSelect: 'all' }}
        >
          {value}
        </Typography>
        <CopyButton text={value} />
      </Stack>
      <Alert severity="warning" sx={{ borderRadius: 2 }}>
        {warning || 'Copie agora e guarde num lugar seguro: por segurança ela não aparece de novo.'}
      </Alert>
    </Stack>
  );
}

/** Bloco de código com rolagem interna (nunca alarga a página) e botão de copiar. */
export function CodeBlock({ code, maxHeight = 360, sx }) {
  return (
    <Box
      sx={[
        {
          position: 'relative',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'action.hover',
          minWidth: 0,
          maxWidth: '100%'
        },
        ...(Array.isArray(sx) ? sx : [sx])
      ]}
    >
      <Box sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1, bgcolor: 'background.paper', borderRadius: 1.5 }}>
        <CopyButton text={code} size={15} />
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          pr: 5,
          fontFamily: MONO,
          fontSize: 12.5,
          lineHeight: 1.55,
          overflow: 'auto',
          maxHeight,
          // no celular quebra a linha (rolar para o lado deixava o fim do texto embaixo do botão de copiar)
          whiteSpace: { xs: 'pre-wrap', sm: 'pre' },
          overflowWrap: { xs: 'anywhere', sm: 'normal' }
        }}
      >
        {code}
      </Box>
    </Box>
  );
}

export const monoSx = { fontFamily: MONO };
