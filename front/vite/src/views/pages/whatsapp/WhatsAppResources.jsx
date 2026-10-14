import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconArrowDown,
  IconArrowUp,
  IconCalendarEvent,
  IconCalendarOff,
  IconCheck,
  IconCopy,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRotateClockwise,
  IconTrash,
  IconUsersGroup,
  IconX
} from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgCard, TgCardGridSkeleton, TgConfirmDialog, TgEmptyState } from 'views/pages/telegram/ui';
import { WaNumberSelect, WaPageHeader, asList, useWaSessions } from './waKit';
import { CrmModal, waPrimaryBtn } from './crm/crmKit';
import { HIDE_SCROLL } from './chat/chatKit';
import BlocksEditor from './agenda/BlocksEditor';
import {
  API,
  RESOURCE_COLORS,
  RESOURCE_KINDS,
  SLOT_SIZES,
  WEEKDAYS,
  apptErr,
  copyText,
  intervalsOf,
  parseHM,
  resourceKind,
  safeHex,
  useSchedulingBase
} from './agenda/agendaKit';

// ============================================================================
// WhatsApp → Profissionais e recursos (Fase 6): quem/o que atende (profissional, sala,
// box, equipamento), quais serviços, horários da semana, bloqueios/feriados e o link
// de calendário (ICS) para assinar no Google/Apple/Outlook. Aba "Feriados gerais" =
// bloqueios que valem para todos. Escritas: dono/admin.
// ============================================================================

const DEFAULT_WEEKLY = () => {
  const work = [
    { start: '08:00', end: '12:00' },
    { start: '13:00', end: '18:00' }
  ];
  return {
    0: [],
    1: work.map((x) => ({ ...x })),
    2: work.map((x) => ({ ...x })),
    3: work.map((x) => ({ ...x })),
    4: work.map((x) => ({ ...x })),
    5: work.map((x) => ({ ...x })),
    6: []
  };
};
const empty = () => ({
  name: '',
  kind: 'person',
  color: RESOURCE_COLORS[0],
  user_id: '',
  session_id: '',
  services: [],
  weekly: DEFAULT_WEEKLY(),
  slot_minutes: 15,
  active: true
});
const formFrom = (r) => {
  const w = r.availability?.weekly || {};
  const weekly = {};
  for (let d = 0; d < 7; d += 1) weekly[d] = (w[String(d)] || []).map((i) => ({ start: i.start, end: i.end }));
  return {
    id: r.id,
    name: r.name || '',
    kind: r.kind || 'person',
    color: safeHex(r.color, RESOURCE_COLORS[0]),
    user_id: r.user_id || r.user?.id || '',
    session_id: r.session_id || '',
    services: Array.isArray(r.services) ? r.services : [],
    weekly,
    slot_minutes: r.availability?.slot_minutes || 15,
    active: r.active !== false
  };
};
const hoursSummary = (r) => {
  const parts = [];
  for (let d = 1; d <= 7; d += 1) {
    const wd = d % 7;
    const iv = intervalsOf(r, wd);
    if (iv.length) parts.push(WEEKDAYS[wd].slice(0, 3).toLowerCase());
  }
  return parts.length ? parts.join(', ') : 'sem horários';
};

// ----------------------------------------------------------------------------
// Grade semanal
// ----------------------------------------------------------------------------
function WeeklyEditor({ weekly, onChange, disabled }) {
  const setDay = (d, list) => onChange({ ...weekly, [d]: list });
  const copyToWeekdays = (d) => {
    const next = { ...weekly };
    [1, 2, 3, 4, 5].forEach((x) => {
      next[x] = (weekly[d] || []).map((i) => ({ ...i }));
    });
    onChange(next);
  };
  return (
    <Stack spacing={1}>
      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
        const list = weekly[d] || [];
        return (
          <Box key={d} sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider', opacity: list.length ? 1 : 0.8 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" sx={{ fontWeight: 800, width: 74, flexShrink: 0 }}>
                {WEEKDAYS[d]}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
                {list.length ? `${list.length} intervalo${list.length === 1 ? '' : 's'}` : 'Fechado'}
              </Typography>
              {list.length && d >= 1 && d <= 5 ? (
                <Tooltip title="Copiar para segunda a sexta">
                  <span>
                    <IconButton size="small" onClick={() => copyToWeekdays(d)} disabled={disabled}>
                      <IconCopy size={15} />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : null}
              <Tooltip title="Adicionar intervalo">
                <span>
                  <IconButton
                    size="small"
                    disabled={disabled || list.length >= 6}
                    onClick={() => {
                      const last = list[list.length - 1];
                      const s = last ? Math.min(parseHM(last.end) + 60, 22 * 60) : 8 * 60;
                      const pad = (n) => String(n).padStart(2, '0');
                      const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
                      setDay(d, [...list, { start: hhmm(s), end: hhmm(Math.min(s + 4 * 60, 23 * 60 + 59)) }]);
                    }}
                  >
                    <IconPlus size={16} />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
            {list.map((iv, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <TextField
                  size="small"
                  type="time"
                  label="Início"
                  value={iv.start}
                  onChange={(e) =>
                    setDay(
                      d,
                      list.map((x, j) => (j === i ? { ...x, start: e.target.value } : x))
                    )
                  }
                  InputLabelProps={{ shrink: true }}
                  disabled={disabled}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <TextField
                  size="small"
                  type="time"
                  label="Fim"
                  value={iv.end}
                  onChange={(e) =>
                    setDay(
                      d,
                      list.map((x, j) => (j === i ? { ...x, end: e.target.value } : x))
                    )
                  }
                  InputLabelProps={{ shrink: true }}
                  disabled={disabled}
                  error={parseHM(iv.end) != null && parseHM(iv.start) != null && parseHM(iv.end) <= parseHM(iv.start)}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <IconButton
                  size="small"
                  onClick={() =>
                    setDay(
                      d,
                      list.filter((_, j) => j !== i)
                    )
                  }
                  disabled={disabled}
                  aria-label="Remover intervalo"
                >
                  <IconX size={16} />
                </IconButton>
              </Stack>
            ))}
          </Box>
        );
      })}
    </Stack>
  );
}

// ----------------------------------------------------------------------------
// Link do calendário (ICS)
// ----------------------------------------------------------------------------
function IcsLink({ resourceId, canEdit }) {
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    get(`${API}/resources/${resourceId}/ics-link`)
      .then((r) => setUrl(r?.url || r?.ics_url || ''))
      .catch((e) => {
        setUrl('');
        toast.error(apptErr(e, 'Não foi possível obter o link do calendário.'));
      });
  }, [resourceId]);
  const rotate = async () => {
    setBusy(true);
    try {
      const r = await post(`${API}/resources/${resourceId}/ics-link/rotate`, {});
      setUrl(r?.url || r?.ics_url || '');
      toast.success('Link novo gerado. O antigo parou de funcionar.');
      setConfirm(false);
    } catch (e) {
      toast.error(apptErr(e, 'Não foi possível gerar um link novo.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack spacing={1.25}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Assine este link no Google Agenda ("Adicionar por URL"), Apple Calendário ou Outlook para ver os agendamentos deste recurso no
        celular. Mostra só o primeiro nome do cliente e o serviço (sem telefone); atualiza sozinho a cada poucas horas.
      </Typography>
      {url === null ? (
        <CircularProgress size={18} />
      ) : (
        <TextField
          size="small"
          value={url}
          fullWidth
          InputProps={{
            readOnly: true,
            sx: { fontFamily: 'monospace', fontSize: 12 },
            endAdornment: (
              <IconButton
                size="small"
                onClick={async () => toast[(await copyText(url)) ? 'success' : 'error']('Link copiado.')}
                disabled={!url}
              >
                <IconCopy size={16} />
              </IconButton>
            )
          }}
        />
      )}
      {canEdit ? (
        <Button
          size="small"
          color="warning"
          startIcon={<IconRotateClockwise size={15} />}
          onClick={() => setConfirm(true)}
          sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
        >
          Gerar link novo
        </Button>
      ) : null}
      <TgConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={rotate}
        loading={busy}
        title="Gerar um link novo?"
        message="O link atual para de funcionar na hora: quem assinou o calendário com ele precisa assinar o novo. Use se o link vazou."
        confirmLabel="Gerar link novo"
        danger
      />
    </Stack>
  );
}

// ----------------------------------------------------------------------------
// Diálogo do recurso
// ----------------------------------------------------------------------------
function ResourceDialog({ dlg, setDlg, onSaved, services, users, sessions, canEdit }) {
  const open = Boolean(dlg);
  const d = dlg || empty();
  const [tab, setTab] = useState('data');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setTab('data');
  }, [open, d.id]);
  const set = (k, v) => setDlg((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!d.name.trim()) return toast.error('Dê um nome ao recurso.');
    const weekly = {};
    for (let day = 0; day < 7; day += 1) {
      const list = (d.weekly[day] || []).filter((i) => parseHM(i.start) != null && parseHM(i.end) != null);
      if (list.some((i) => parseHM(i.end) <= parseHM(i.start))) {
        setTab('hours');
        return toast.error(`${WEEKDAYS[day]}: o fim de cada intervalo precisa ser depois do início.`);
      }
      weekly[String(day)] = list.map((i) => ({ start: i.start, end: i.end }));
    }
    setBusy(true);
    try {
      const body = {
        name: d.name.trim(),
        kind: d.kind,
        color: d.color,
        user_id: d.user_id || null,
        session_id: d.session_id || null,
        services: d.services,
        availability: { weekly, slot_minutes: d.slot_minutes },
        active: d.active
      };
      const r = d.id ? await put(`${API}/resources/${d.id}`, body) : await post(`${API}/resources`, body);
      toast.success(d.id ? 'Recurso salvo.' : 'Recurso criado.');
      onSaved?.(r);
      if (!d.id && r?.id) setDlg(formFrom(r));
      else setDlg(null);
    } catch (e) {
      toast.error(apptErr(e, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <CrmModal
      open={open}
      onClose={() => !busy && setDlg(null)}
      title={d.id ? d.name || 'Recurso' : 'Novo profissional ou recurso'}
      subtitle="Quem ou o que atende: profissional, sala, box ou equipamento — com os horários de atendimento."
      maxWidth="sm"
      disableClose={busy}
      tabs={
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons={false}
          sx={{
            minHeight: 38,
            '& .MuiTabs-scroller': HIDE_SCROLL,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 38 }
          }}
        >
          <Tab value="data" label="Dados" />
          <Tab value="hours" label="Horários" />
          <Tab value="blocks" label="Bloqueios" disabled={!d.id} />
          <Tab value="ics" label="Calendário" disabled={!d.id} />
        </Tabs>
      }
      footer={
        tab === 'data' || tab === 'hours' ? (
          <>
            <Button color="inherit" onClick={() => setDlg(null)} disabled={busy} sx={{ textTransform: 'none' }}>
              {canEdit ? 'Cancelar' : 'Fechar'}
            </Button>
            {canEdit ? (
              <Button
                variant="contained"
                disableElevation
                onClick={save}
                disabled={busy}
                startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCheck size={16} />}
                sx={waPrimaryBtn}
              >
                {d.id ? 'Salvar' : 'Criar'}
              </Button>
            ) : null}
          </>
        ) : (
          <Button color="inherit" onClick={() => setDlg(null)} sx={{ textTransform: 'none' }}>
            Fechar
          </Button>
        )
      }
    >
      {!open ? null : tab === 'data' ? (
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label="Nome"
            value={d.name}
            onChange={(e) => set('name', e.target.value.slice(0, 120))}
            fullWidth
            autoFocus={!d.id}
            placeholder="Ex.: Dra. Ana, Sala 2, Box 1"
            disabled={!canEdit}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              select
              size="small"
              label="Tipo"
              value={d.kind}
              onChange={(e) => set('kind', e.target.value)}
              fullWidth
              disabled={!canEdit}
            >
              {RESOURCE_KINDS.map((k) => (
                <MenuItem key={k.value} value={k.value}>
                  {k.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Usuário do painel (opcional)"
              value={d.user_id}
              onChange={(e) => set('user_id', e.target.value)}
              fullWidth
              helperText="Recebe as notificações deste recurso."
              disabled={!canEdit}
            >
              <MenuItem value="">Nenhum</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
              Cor na agenda
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
              {RESOURCE_COLORS.map((c) => (
                <ButtonBase
                  key={c}
                  onClick={() => canEdit && set('color', c)}
                  aria-label={`Cor ${c}`}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: c,
                    boxShadow: d.color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : 'none'
                  }}
                />
              ))}
            </Stack>
          </Box>
          {sessions.length > 1 ? (
            <WaNumberSelect
              sessions={sessions}
              value={d.session_id}
              onChange={(v) => set('session_id', v)}
              allowAll
              allLabel="Padrão (número da conversa do cliente)"
              label="Número preferido para os avisos"
              disabled={!canEdit}
            />
          ) : null}
          <TextField
            select
            size="small"
            label="Serviços que atende"
            value={d.services}
            onChange={(e) => set('services', typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
            SelectProps={{
              multiple: true,
              displayEmpty: true,
              renderValue: (sel) =>
                !sel.length ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Todos os serviços
                  </Typography>
                ) : (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {sel.map((id) => (
                      <Chip
                        key={id}
                        size="small"
                        label={services.find((s) => s.id === id)?.name || 'Serviço removido'}
                        sx={{ height: 22 }}
                      />
                    ))}
                  </Stack>
                )
            }}
            InputLabelProps={{ shrink: true }}
            helperText="Nenhum marcado = atende todos os serviços."
            fullWidth
            disabled={!canEdit}
          >
            {services.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch size="small" checked={d.active} onChange={(e) => set('active', e.target.checked)} disabled={!canEdit} />
            <Typography variant="body2">
              {d.active ? 'Ativo — aparece na agenda e no bot' : 'Inativo — escondido da agenda e do bot'}
            </Typography>
          </Stack>
        </Stack>
      ) : tab === 'hours' ? (
        <Stack spacing={1.5}>
          <TextField
            select
            size="small"
            label="Intervalo entre horários oferecidos"
            value={d.slot_minutes}
            onChange={(e) => set('slot_minutes', Number(e.target.value))}
            helperText="De quanto em quanto tempo o cliente pode começar (ex.: 15 min = 08:00, 08:15, 08:30…)."
            disabled={!canEdit}
          >
            {SLOT_SIZES.map((n) => (
              <MenuItem key={n} value={n}>
                {n} minutos
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Horário de Brasília. Vários intervalos no mesmo dia = pausa entre eles (ex.: almoço).
          </Typography>
          <WeeklyEditor weekly={d.weekly} onChange={(w) => set('weekly', w)} disabled={!canEdit} />
        </Stack>
      ) : tab === 'blocks' ? (
        <BlocksEditor path={`${API}/resources/${d.id}/blocks`} canEdit={canEdit} />
      ) : (
        <IcsLink resourceId={d.id} canEdit={canEdit} />
      )}
    </CrmModal>
  );
}

// ----------------------------------------------------------------------------
// Cartão
// ----------------------------------------------------------------------------
function ResourceCard({ r, services, users, canEdit, busy, first, last, onEdit, onToggle, onRemove, onMove }) {
  const kind = resourceKind(r.kind);
  const Icon = kind.icon;
  const color = safeHex(r.color);
  const names = (r.services || []).map((id) => services.find((s) => s.id === id)?.name).filter(Boolean);
  const user = r.user || users.find((u) => u.id === r.user_id);
  return (
    <TgCard
      hover={false}
      sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, opacity: r.active !== false ? 1 : 0.65, minWidth: 0 }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            bgcolor: color,
            flexShrink: 0
          }}
        >
          <Icon size={20} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800 }} noWrap title={r.name}>
            {r.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
            {kind.label}
            {user ? ` · ${user.name}` : ''}
          </Typography>
        </Box>
        {canEdit ? (
          <Tooltip title={r.active !== false ? 'Ativo' : 'Inativo'}>
            <Switch size="small" checked={r.active !== false} onChange={(e) => onToggle(e.target.checked)} disabled={busy} />
          </Tooltip>
        ) : null}
      </Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {names.length ? (
          names
            .slice(0, 4)
            .map((n) => <Chip key={n} size="small" label={n} sx={{ height: 22, fontWeight: 600, borderRadius: 1.5, maxWidth: '100%' }} />)
        ) : (
          <Chip size="small" label="Todos os serviços" variant="outlined" sx={{ height: 22, fontWeight: 600, borderRadius: 1.5 }} />
        )}
        {names.length > 4 ? <Chip size="small" label={`+${names.length - 4}`} sx={{ height: 22 }} /> : null}
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Atende: {hoursSummary(r)} · a cada {r.availability?.slot_minutes || 15} min
      </Typography>
      <Stack direction="row" spacing={0.25} alignItems="center" sx={{ mt: 'auto', pt: 0.5 }}>
        {canEdit ? (
          <>
            <Tooltip title="Mover para cima">
              <span>
                <IconButton size="small" onClick={() => onMove(-1)} disabled={busy || first}>
                  <IconArrowUp size={16} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Mover para baixo">
              <span>
                <IconButton size="small" onClick={() => onMove(1)} disabled={busy || last}>
                  <IconArrowDown size={16} />
                </IconButton>
              </span>
            </Tooltip>
          </>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Tooltip title={canEdit ? 'Editar' : 'Ver'}>
          <IconButton size="small" onClick={onEdit}>
            <IconPencil size={16} />
          </IconButton>
        </Tooltip>
        {canEdit ? (
          <Tooltip title="Excluir">
            <span>
              <IconButton size="small" onClick={onRemove} disabled={busy}>
                <IconTrash size={16} />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
      </Stack>
    </TgCard>
  );
}

// ============================================================================
export default function WhatsAppResources() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'holidays' ? 'holidays' : 'resources';
  const setTab = (v) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (v === 'holidays') n.set('tab', 'holidays');
        else n.delete('tab');
        return n;
      },
      { replace: true }
    );

  const base = useSchedulingBase({ includeInactive: true });
  const { sessions } = useWaSessions(60000);
  const [items, setItems] = useState(null);
  const [users, setUsers] = useState([]);
  const [dlg, setDlg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    if (base.resources && !base.loading) setItems(base.resources);
  }, [base.resources, base.loading]);
  useEffect(() => {
    get('/whatsapp/attendants')
      .then((r) => setUsers(asList(r)))
      .catch(() => setUsers([]));
  }, []);
  const reload = base.reload;
  const services = base.services;

  const toggle = async (r, active) => {
    setItems((xs) => xs.map((x) => (x.id === r.id ? { ...x, active } : x)));
    try {
      await put(`${API}/resources/${r.id}`, { active });
    } catch (e) {
      setItems((xs) => xs.map((x) => (x.id === r.id ? { ...x, active: !active } : x)));
      toast.error(apptErr(e, 'Não foi possível atualizar.'));
    }
  };
  const moveItem = async (idx, dir) => {
    const list = [...items];
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    setItems(list);
    try {
      await put(`${API}/resources/reorder`, { ids: list.map((x) => x.id) });
    } catch (e) {
      toast.error(apptErr(e, 'Não foi possível reordenar.'));
      reload();
    }
  };
  const doRemove = async () => {
    setBusy(true);
    try {
      await remove(`${API}/resources/${confirm.id}`);
      toast.success('Recurso excluído.');
      setConfirm(null);
      reload();
    } catch (e) {
      toast.error(apptErr(e, 'Não foi possível excluir. Se houver agendamentos futuros, desative em vez de excluir.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <WaPageHeader
        icon={IconUsersGroup}
        title="Profissionais e recursos"
        subtitle="Quem ou o que atende os serviços agendados, com os horários de cada um, bloqueios e feriados."
        sx={{ mb: 2 }}
        action={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Tooltip title="Atualizar">
              <IconButton onClick={reload}>
                <IconRefresh size={18} />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<IconCalendarEvent size={18} />}
              onClick={() => navigate('/whatsapp/agenda')}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              Agenda
            </Button>
            {canEdit && tab === 'resources' ? (
              <Button
                variant="contained"
                disableElevation
                startIcon={<IconPlus size={18} />}
                onClick={() => setDlg(empty())}
                sx={waPrimaryBtn}
              >
                Novo recurso
              </Button>
            ) : null}
          </Stack>
        }
      />
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 2,
          minHeight: 40,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40 }
        }}
      >
        <Tab
          value="resources"
          icon={<IconUsersGroup size={16} />}
          iconPosition="start"
          label={`Recursos${items?.length ? ` (${items.length})` : ''}`}
        />
        <Tab value="holidays" icon={<IconCalendarOff size={16} />} iconPosition="start" label="Feriados gerais" />
      </Tabs>

      {!canEdit ? (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2.5 }}>
          Só o dono ou um admin cadastra e altera recursos, horários e feriados.
        </Alert>
      ) : null}

      {tab === 'holidays' ? (
        <TgCard hover={false} sx={{ p: 2, maxWidth: 720 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Feriados e bloqueios gerais
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
            Valem para todos os profissionais e recursos (ex.: feriado, recesso, evento).
          </Typography>
          <BlocksEditor path={`${API}/blocks`} canEdit={canEdit} />
        </TgCard>
      ) : items === null ? (
        <TgCardGridSkeleton count={3} height={170} />
      ) : !items.length ? (
        <TgEmptyState
          icon={IconUsersGroup}
          title="Nenhum profissional ou recurso"
          description="Cadastre quem atende (pessoa, sala, box ou equipamento) e os horários da semana. Cada um vira uma coluna na Agenda e o bot oferece só os horários livres."
          action={
            canEdit ? (
              <Button
                variant="contained"
                disableElevation
                startIcon={<IconPlus size={18} />}
                onClick={() => setDlg(empty())}
                sx={waPrimaryBtn}
              >
                Cadastrar o primeiro
              </Button>
            ) : null
          }
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(3, minmax(0,1fr))' }
          }}
        >
          {items.map((r, i) => (
            <ResourceCard
              key={r.id}
              r={r}
              services={services}
              users={users}
              canEdit={canEdit}
              busy={busy}
              first={i === 0}
              last={i === items.length - 1}
              onEdit={() => setDlg(formFrom(r))}
              onToggle={(v) => toggle(r, v)}
              onRemove={() => setConfirm(r)}
              onMove={(dir) => moveItem(i, dir)}
            />
          ))}
        </Box>
      )}

      <ResourceDialog dlg={dlg} setDlg={setDlg} onSaved={reload} services={services} users={users} sessions={sessions} canEdit={canEdit} />
      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={doRemove}
        loading={busy}
        danger
        title="Excluir este recurso?"
        message={`"${confirm?.name}" sai da agenda e do bot. Agendamentos antigos continuam no histórico. Para só parar de oferecer horários, desative.`}
        confirmLabel="Excluir"
      />
    </Box>
  );
}
