import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconAlarm,
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconChecks,
  IconCircleCheck,
  IconCircleDot,
  IconClockExclamation,
  IconClockHour4,
  IconCopy,
  IconFlame,
  IconHourglass,
  IconLock,
  IconMinus
} from '@tabler/icons-react';

import { get } from 'api/api';
import { errMsg } from '../waShared';

// ============================================================================
// Chamados / protocolos (Fase 6B) — peças compartilhadas: situação, prioridade,
// prazo (SLA, calculado ao vivo a partir de `sla_due_at`), protocolo copiável,
// carga das configurações + responsáveis, textos padrão e erros do back.
// Contrato: docs/whatsapp-assinaturas-contrato.md §10.
// ============================================================================

export const API = '/whatsapp/tickets';

// ----------------------------------------------------------------------------
// Situação, prioridade e prazo
// ----------------------------------------------------------------------------
export const TICKET_STATUS = {
  open: { label: 'Aberto', color: '#2563EB', dark: '#60A5FA', icon: IconCircleDot },
  pending: { label: 'Aguardando cliente', color: '#B45309', dark: '#FBBF24', icon: IconHourglass },
  resolved: { label: 'Resolvido', color: '#128C7E', dark: '#25D366', icon: IconCircleCheck },
  closed: { label: 'Encerrado', color: '#64748B', dark: '#94A3B8', icon: IconLock }
};
export const STATUS_KEYS = ['open', 'pending', 'resolved', 'closed'];
export const statusOf = (s) => TICKET_STATUS[s] || { label: s || '—', color: '#64748B', dark: '#94A3B8', icon: IconCircleDot };

export const PRIORITY = {
  low: { label: 'Baixa', color: '#64748B', dark: '#94A3B8', icon: IconArrowDown },
  normal: { label: 'Normal', color: '#2563EB', dark: '#60A5FA', icon: IconMinus },
  high: { label: 'Alta', color: '#B45309', dark: '#FBBF24', icon: IconArrowUp },
  urgent: { label: 'Urgente', color: '#DC2626', dark: '#F87171', icon: IconFlame }
};
export const PRIORITY_KEYS = ['low', 'normal', 'high', 'urgent'];
export const priorityOf = (p) => PRIORITY[p] || PRIORITY.normal;

export const SLA_TONE = {
  ok: { color: '#128C7E', dark: '#25D366', icon: IconClockHour4 },
  due_soon: { color: '#B45309', dark: '#FBBF24', icon: IconAlarm },
  overdue: { color: '#DC2626', dark: '#F87171', icon: IconClockExclamation },
  met: { color: '#64748B', dark: '#94A3B8', icon: IconChecks },
  breached_met: { color: '#64748B', dark: '#94A3B8', icon: IconAlertTriangle }
};

export const SOURCE_LABEL = { bot: 'bot', panel: 'painel', api: 'API' };

/** "em 2 h", "em 3 dias", "há 5 h" (mesma régua do back `fmtDueRelative`). */
export const dueRelative = (due, now = Date.now()) => {
  if (!due) return '';
  const diff = new Date(due).getTime() - now;
  const min = Math.round(Math.abs(diff) / 60000);
  let txt;
  if (min < 60) txt = `${Math.max(1, min)} min`;
  else if (min < 48 * 60) txt = `${Math.round(min / 60)} h`;
  else txt = `${Math.round(min / 1440)} dias`;
  return diff >= 0 ? `em ${txt}` : `há ${txt}`;
};

/**
 * Situação do prazo AO VIVO: o back calcula `sla_state` na hora da leitura; com a tela
 * aberta, um "ok"/"vence em breve" pode virar "venceu" — corrigimos aqui pelo relógio.
 */
export const liveSla = (t, now = Date.now()) => {
  const st = t?.sla_state || 'none';
  if (!t?.sla_due_at || st === 'none') return { state: 'none', text: '' };
  const due = new Date(t.sla_due_at).getTime();
  let state = st;
  if ((st === 'ok' || st === 'due_soon') && now > due) state = 'overdue';
  const rel = dueRelative(t.sla_due_at, now);
  if (state === 'overdue') return { state, text: `venceu ${rel}` };
  if (state === 'met') return { state, text: 'No prazo' };
  if (state === 'breached_met') return { state, text: 'Fora do prazo' };
  return { state, text: `vence ${rel}` };
};

/** Chip colorido genérico (cor clara/escura fixas da marca, como na Agenda). */
export function ToneChip({ tone, label, icon: Icon, size = 'sm', title, sx }) {
  const chip = (
    <Chip
      size="small"
      icon={Icon ? <Icon size={13} /> : undefined}
      label={label}
      sx={[
        (t) => ({
          height: size === 'md' ? 24 : 20,
          fontSize: size === 'md' ? 12 : 11,
          fontWeight: 700,
          borderRadius: 1.5,
          maxWidth: '100%',
          color: tone.color,
          bgcolor: `${tone.color}1F`,
          '& .MuiChip-icon': { color: tone.color, ml: 0.5 },
          '& .MuiChip-label': { px: 0.75, overflow: 'hidden', textOverflow: 'ellipsis' },
          ...t.applyStyles('dark', { color: tone.dark, bgcolor: `${tone.dark}26`, '& .MuiChip-icon': { color: tone.dark } })
        }),
        ...(Array.isArray(sx) ? sx : [sx])
      ]}
    />
  );
  return title ? <Tooltip title={title}>{chip}</Tooltip> : chip;
}

export function TicketStatusChip({ status, size, sx }) {
  const s = statusOf(status);
  return <ToneChip tone={s} label={s.label} icon={s.icon} size={size} sx={sx} />;
}

export function PriorityChip({ priority, size, sx }) {
  const p = priorityOf(priority);
  return <ToneChip tone={p} label={p.label} icon={p.icon} size={size} sx={sx} />;
}

/** Chip do prazo. `now` vem de `useNow` para o texto andar sozinho. */
export function SlaChip({ ticket, now, size, sx }) {
  const { state, text } = liveSla(ticket, now);
  if (state === 'none') return null;
  const tone = SLA_TONE[state] || SLA_TONE.ok;
  const title = ticket?.sla_label ? `Prazo de solução: ${ticket.sla_label}` : undefined;
  return <ToneChip tone={tone} label={text} icon={tone.icon} size={size} title={title} sx={sx} />;
}

/** Protocolo em fonte monoespaçada, com botão de copiar. */
export function ProtocolText({ protocol, size = 'sm', copy = true, sx }) {
  if (!protocol) return null;
  const doCopy = async (e) => {
    e?.stopPropagation?.();
    const ok = await copyText(protocol);
    toast[ok ? 'success' : 'error'](ok ? `Protocolo ${protocol} copiado.` : 'Não foi possível copiar.');
  };
  return (
    <Stack direction="row" spacing={0.25} alignItems="center" sx={{ minWidth: 0, ...sx }}>
      <Typography
        component="span"
        sx={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontWeight: 700,
          fontSize: size === 'lg' ? 18 : size === 'md' ? 14 : 12.5,
          letterSpacing: 0.3,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap'
        }}
      >
        {protocol}
      </Typography>
      {copy ? (
        <Tooltip title="Copiar protocolo">
          <IconButton size="small" onClick={doCopy} aria-label="Copiar protocolo" sx={{ p: 0.4, color: 'text.secondary' }}>
            <IconCopy size={size === 'lg' ? 16 : 13} />
          </IconButton>
        </Tooltip>
      ) : null}
    </Stack>
  );
}

/** Nome de quem abriu: cliente → contato → telefone. */
export const ticketPersonName = (t) => t?.customer?.name || t?.contact?.name || '';
export const ticketPersonPhone = (t) => t?.customer?.phone || t?.contact?.phone || '';

/** Título de seção (mesmo desenho da Agenda). */
export function SectionLabel({ children, sx }) {
  return (
    <Typography
      variant="caption"
      sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', ...sx }}
    >
      {children}
    </Typography>
  );
}

// ----------------------------------------------------------------------------
// Textos padrão (iguais ao back `DEFAULT_TICKET_TEXTS`) — botão "Restaurar padrão"
// ----------------------------------------------------------------------------
export const DEFAULT_TEXTS = {
  created:
    'Recebemos seu chamado ✅\n\n📄 Protocolo: *{{chamado.protocolo}}*\n📂 {{chamado.categoria}}\n⏱️ Prazo para retorno: {{chamado.prazo}}\n\nGuarde este número para acompanhar.',
  status_changed: 'Atualização do protocolo *{{chamado.protocolo}}*: agora está *{{chamado.status}}*.',
  resolved: 'Seu chamado *{{chamado.protocolo}}* foi resolvido ✅\n\nSe ainda precisar de algo, é só responder por aqui.',
  closed: 'O chamado *{{chamado.protocolo}}* foi encerrado. Obrigado pelo contato!',
  pending:
    'Precisamos de uma informação sua para continuar o protocolo *{{chamado.protocolo}}*:\n\n{{chamado.comentario}}\n\nÉ só responder por aqui.',
  comment: 'Atualização do protocolo *{{chamado.protocolo}}*:\n\n{{chamado.comentario}}',
  reopened: 'Reabrimos o protocolo *{{chamado.protocolo}}* com a sua mensagem. Em breve retornamos.'
};

export const TEXT_VARS = [
  '{{cliente.nome}}',
  '{{cliente.primeiro_nome}}',
  '{{chamado.protocolo}}',
  '{{chamado.assunto}}',
  '{{chamado.categoria}}',
  '{{chamado.status}}',
  '{{chamado.prioridade}}',
  '{{chamado.prazo}}',
  '{{chamado.descricao}}',
  '{{chamado.comentario}}'
];

/** Protocolo de exemplo com o formato da configuração (igual ao back `formatProtocol`). */
export const protocolExample = (prefix, resetYearly, n = 1) => {
  const year = new Date(Date.now() - 3 * 3600 * 1000).getUTCFullYear();
  const p = String(prefix || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  return resetYearly ? `${p}${year}${String(n).padStart(6, '0')}` : `${p}${String(n).padStart(8, '0')}`;
};

// ----------------------------------------------------------------------------
// Erros do back (mensagem pode vir como objeto { code, message })
// ----------------------------------------------------------------------------
export const ticketErr = (e, fb) => {
  const d = e?.response?.data;
  if (d?.message && typeof d.message === 'object' && !Array.isArray(d.message) && d.message.message) return String(d.message.message);
  if (d?.code === 'CATEGORY_INVALID') return 'Essa categoria não existe mais. Escolha outra.';
  return errMsg(e, fb);
};

// ----------------------------------------------------------------------------
// Configurações + responsáveis (com sequência: resposta antiga não sobrescreve)
// ----------------------------------------------------------------------------
export function useTicketBase() {
  const [settings, setSettings] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const s = ++seq.current;
    const [st, as] = await Promise.all([get(`${API}/settings`).catch(() => null), get(`${API}/assignees`).catch(() => [])]);
    if (s !== seq.current) return;
    setSettings(st || { categories: [] });
    setAssignees(Array.isArray(as) ? as : []);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  const categories = useMemo(() => settings?.categories || [], [settings]);
  const categoryLabel = useCallback((k) => categories.find((c) => c.key === k)?.label || k || '—', [categories]);
  const assigneeById = useMemo(() => new Map(assignees.map((u) => [u.id, u])), [assignees]);
  return { settings, setSettings, categories, categoryLabel, assignees, assigneeById, loading: settings === null, reload };
}

/** Copia texto (com fallback). */
export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
};

/** Iniciais para o avatar do responsável. */
export const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?';

/** Avatar pequeno do responsável (ou "sem responsável"). */
export function AssigneeBadge({ assigned, size = 22, showName = true }) {
  if (!assigned?.id) {
    return (
      <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
        Sem responsável
      </Typography>
    );
  }
  const name = assigned.name || 'Usuário';
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <Box
        sx={(t) => ({
          width: size,
          height: size,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          fontSize: size * 0.42,
          fontWeight: 800,
          color: t.vars.palette.primary.main,
          bgcolor: `rgba(${t.vars.palette.primary.mainChannel} / 0.14)`
        })}
      >
        {initials(name)}
      </Box>
      {showName ? (
        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
          {name}
        </Typography>
      ) : null}
    </Stack>
  );
}
