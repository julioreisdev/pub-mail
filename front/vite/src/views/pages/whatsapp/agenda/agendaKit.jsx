import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import {
  IconArmchair,
  IconBox,
  IconCalendarCheck,
  IconCalendarEvent,
  IconCalendarX,
  IconCash,
  IconCircleCheck,
  IconClockHour4,
  IconDoor,
  IconPlayerPlay,
  IconTool,
  IconUser,
  IconUserX
} from '@tabler/icons-react';

import { get } from 'api/api';
import { asList } from '../waKit';
import { errMsg } from '../waShared';
import { todayIso } from '../crm/crmKit';

// ============================================================================
// Agenda (Fase 6) — peças compartilhadas: fuso BRT fixo (-03:00, Brasil sem horário de
// verão), situação do agendamento (rótulo + cor), tipos de recurso, carga de recursos e
// serviços, mensagens dos erros do back (SLOT_TAKEN, CONTACT_BUSY, CUSTOMER_REQUIRED).
// ============================================================================

export const API = '/whatsapp/scheduling';
const BRT_MS = 3 * 3600 * 1000;
const pad = (n) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` de hoje em Brasília. */
export const brtToday = () => todayIso();

/** Soma dias a um `YYYY-MM-DD` (sem depender do fuso do navegador). */
export const addDaysIso = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(n || 0));
  return d.toISOString().slice(0, 10);
};
/** 0 = domingo … 6 = sábado. */
export const weekdayOf = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();
/** Segunda-feira da semana do dia (semana começa na segunda). */
export const mondayOf = (day) => addDaysIso(day, -((weekdayOf(day) + 6) % 7));

/** ISO (UTC) → `{ day: 'YYYY-MM-DD', minutes }` em Brasília. */
export const brtParts = (iso) => {
  const d = new Date(new Date(iso).getTime() - BRT_MS);
  return { day: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
};
/** Dia + minutos (Brasília) → ISO UTC. */
export const brtIso = (day, minutes) => {
  const [y, m, d] = String(day).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0) + Number(minutes || 0) * 60000 + BRT_MS).toISOString();
};
export const dayStartIso = (day) => brtIso(day, 0);
export const dayEndIso = (day) => new Date(new Date(brtIso(addDaysIso(day, 1), 0)).getTime() - 1).toISOString();

export const hm = (minutes) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
export const parseHM = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  return m ? Math.min(1440, Number(m[1]) * 60 + Number(m[2])) : null;
};
/** ISO → "14:30" em Brasília. */
export const timeOf = (iso) => (iso ? hm(brtParts(iso).minutes) : '');

const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
/** "qua, 15/10". */
export const dayLabel = (day) => {
  if (!day) return '';
  const [, m, d] = day.split('-');
  return `${WEEKDAYS_SHORT[weekdayOf(day)]}, ${d}/${m}`;
};
/** "quarta-feira, 15 de outubro". */
export const dayLongLabel = (day) => {
  try {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(
      new Date(`${day}T12:00:00Z`)
    );
  } catch {
    return dayLabel(day);
  }
};
/** Data e hora de um ISO em Brasília: "qua, 15/10 · 14:30". */
export const whenLabel = (iso) => {
  if (!iso) return '';
  const p = brtParts(iso);
  return `${dayLabel(p.day)} · ${hm(p.minutes)}`;
};

// ----------------------------------------------------------------------------
// Situação do agendamento
// ----------------------------------------------------------------------------
export const APPT_STATUS = {
  pending_payment: { label: 'Aguardando pagamento', short: 'Pagar', color: '#B45309', dark: '#FBBF24', icon: IconCash },
  booked: { label: 'Agendado', short: 'Agendado', color: '#2563EB', dark: '#60A5FA', icon: IconCalendarEvent },
  confirmed: { label: 'Confirmado', short: 'Confirmado', color: '#128C7E', dark: '#25D366', icon: IconCalendarCheck },
  in_progress: { label: 'Em atendimento', short: 'Atendendo', color: '#7C3AED', dark: '#A78BFA', icon: IconPlayerPlay },
  done: { label: 'Concluído', short: 'Concluído', color: '#64748B', dark: '#94A3B8', icon: IconCircleCheck },
  no_show: { label: 'Faltou', short: 'Faltou', color: '#DC2626', dark: '#F87171', icon: IconUserX },
  canceled: { label: 'Cancelado', short: 'Cancelado', color: '#BE123C', dark: '#FB7185', icon: IconCalendarX },
  expired: { label: 'Expirado (não pago)', short: 'Expirado', color: '#9F1239', dark: '#FDA4AF', icon: IconClockHour4 }
};
export const ACTIVE_STATUSES = ['pending_payment', 'booked', 'confirmed', 'in_progress'];
export const CLOSED_STATUSES = ['no_show', 'canceled', 'expired'];
export const statusOf = (s) => APPT_STATUS[s] || { label: s || '—', short: s || '—', color: '#64748B', dark: '#94A3B8' };

export function ApptStatusChip({ status, size = 'sm', sx }) {
  const s = statusOf(status);
  const Icon = s.icon;
  return (
    <Chip
      size="small"
      icon={Icon ? <Icon size={13} /> : undefined}
      label={s.label}
      sx={[
        (t) => ({
          height: size === 'md' ? 24 : 20,
          fontSize: size === 'md' ? 12 : 11,
          fontWeight: 700,
          borderRadius: 1.5,
          color: s.color,
          bgcolor: `${s.color}1F`,
          '& .MuiChip-icon': { color: s.color },
          ...t.applyStyles('dark', { color: s.dark, bgcolor: `${s.dark}26`, '& .MuiChip-icon': { color: s.dark } })
        }),
        ...(Array.isArray(sx) ? sx : [sx])
      ]}
    />
  );
}

/** Bolinha da cor do status (legendas). */
export function StatusDot({ status, size = 10 }) {
  const s = statusOf(status);
  return (
    <Box
      component="span"
      sx={(t) => ({
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        bgcolor: s.color,
        ...t.applyStyles('dark', { bgcolor: s.dark })
      })}
    />
  );
}

export const PAYMENT_LABEL = {
  on_site: 'Pagar no local',
  on_booking: 'Pago na reserva',
  deposit: 'Sinal',
  included: 'Incluso no plano',
  charge: 'Cobrança',
  credit: 'Crédito',
  none: 'Sem pagamento'
};
export const paymentLabel = (p) => PAYMENT_LABEL[p] || p || '—';

// ----------------------------------------------------------------------------
// Recursos
// ----------------------------------------------------------------------------
export const RESOURCE_KINDS = [
  { value: 'person', label: 'Profissional', icon: IconUser },
  { value: 'room', label: 'Sala', icon: IconDoor },
  { value: 'bay', label: 'Box / baia', icon: IconArmchair },
  { value: 'equipment', label: 'Equipamento', icon: IconTool },
  { value: 'other', label: 'Outro', icon: IconBox }
];
export const resourceKind = (k) => RESOURCE_KINDS.find((x) => x.value === k) || RESOURCE_KINDS[4];
export const RESOURCE_COLORS = ['#2563EB', '#128C7E', '#7C3AED', '#DB2777', '#EA580C', '#0891B2', '#65A30D', '#64748B'];
export const safeHex = (c, fb = '#2563EB') => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c) : fb);
export const SLOT_SIZES = [5, 10, 15, 20, 30, 60];

/** Intervalos de um dia da semana (`'0'..'6'`) → [{start,end}] em minutos, ordenados. */
export const intervalsOf = (resource, wd) =>
  (resource?.availability?.weekly?.[String(wd)] || [])
    .map((i) => ({ start: parseHM(i.start), end: parseHM(i.end) }))
    .filter((i) => i.start != null && i.end != null && i.end > i.start)
    .sort((a, b) => a.start - b.start);

// ----------------------------------------------------------------------------
// Erros do back
// ----------------------------------------------------------------------------
export const errCode = (e) => {
  const d = e?.response?.data;
  return d?.code || d?.message?.code || d?.error?.code || null;
};
export const apptErr = (e, fb) => {
  const code = errCode(e);
  if (code === 'SLOT_TAKEN') return 'Esse horário acabou de ser ocupado. Escolha outro — a lista foi atualizada.';
  if (code === 'CONTACT_BUSY') return 'Este cliente já tem um agendamento nesse horário.';
  if (code === 'CUSTOMER_REQUIRED') return 'Este serviço exige um cliente cadastrado. Escolha ou cadastre o cliente.';
  const d = e?.response?.data;
  if (d?.message && typeof d.message === 'object' && d.message.message) return String(d.message.message);
  return errMsg(e, fb);
};

// ----------------------------------------------------------------------------
// Carga de recursos + serviços (com sequência: resposta antiga não sobrescreve)
// ----------------------------------------------------------------------------
export function useSchedulingBase({ includeInactive = false } = {}) {
  const [resources, setResources] = useState(null);
  const [services, setServices] = useState(null);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const s = ++seq.current;
    const [r, sv] = await Promise.all([get(`${API}/resources`).catch(() => []), get(`${API}/services`).catch(() => [])]);
    if (s !== seq.current) return;
    setResources(asList(r));
    setServices(asList(sv));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  const list = useMemo(
    () => (resources || []).filter((r) => includeInactive || r.active !== false).sort((a, b) => (a.position || 0) - (b.position || 0)),
    [resources, includeInactive]
  );
  const byId = useMemo(() => new Map((resources || []).map((r) => [r.id, r])), [resources]);
  const serviceById = useMemo(() => new Map((services || []).map((s) => [s.id, s])), [services]);
  return {
    resources: list,
    allResources: resources || [],
    services: services || [],
    byId,
    serviceById,
    loading: resources === null,
    reload
  };
}

/** Recursos que atendem um serviço (lista do serviço; senão os que têm `services` vazio ou contendo o id). */
export const resourcesForService = (service, resources) => {
  if (!service) return resources;
  if (Array.isArray(service.resources) && service.resources.length) {
    const ids = new Set(service.resources.map((r) => r.id));
    return resources.filter((r) => ids.has(r.id));
  }
  return resources.filter((r) => !Array.isArray(r.services) || !r.services.length || r.services.includes(service.id));
};

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
