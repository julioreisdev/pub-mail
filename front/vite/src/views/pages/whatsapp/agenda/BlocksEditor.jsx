import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconCalendarOff, IconPlus, IconTrash } from '@tabler/icons-react';

import { get, post, remove } from 'api/api';
import { TgListSkeleton } from 'views/pages/telegram/ui';
import { asList } from '../waKit';
import { addDaysIso, apptErr, brtIso, brtParts, brtToday, dayLabel, dayStartIso, hm, parseHM } from './agendaKit';

// ============================================================================
// Bloqueios / feriados: lista (de hoje em diante) + adicionar (dia inteiro ou faixa
// de horário, um ou vários dias) + apagar. `path` = `${API}/resources/:id/blocks`
// (de um recurso) ou `${API}/blocks` (geral: vale para todos os recursos).
// Agendamentos já marcados no período NÃO são cancelados — só novos horários somem.
// ============================================================================

const blockLabel = (b) => {
  const s = brtParts(b.starts_at);
  const e = brtParts(b.ends_at);
  const allDay = s.minutes === 0 && (e.minutes === 0 || e.minutes >= 1439);
  if (allDay) {
    const lastDay = e.minutes === 0 ? addDaysIso(e.day, -1) : e.day;
    return lastDay === s.day ? `${dayLabel(s.day)} · dia inteiro` : `${dayLabel(s.day)} a ${dayLabel(lastDay)} · dias inteiros`;
  }
  return s.day === e.day
    ? `${dayLabel(s.day)} · ${hm(s.minutes)}–${hm(e.minutes)}`
    : `${dayLabel(s.day)} ${hm(s.minutes)} a ${dayLabel(e.day)} ${hm(e.minutes)}`;
};

export default function BlocksEditor({ path, canEdit = true, onChanged }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState('');
  const [f, setF] = useState(() => ({ from: brtToday(), to: brtToday(), allDay: true, start: '12:00', end: '13:00', reason: '' }));

  const load = useCallback(async () => {
    try {
      const r = await get(path, { params: { from: dayStartIso(brtToday()) } });
      setItems(
        asList(r)
          .filter((b) => new Date(b.ends_at).getTime() >= Date.now() - 86400000)
          .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))
      );
    } catch (e) {
      setItems([]);
      toast.error(apptErr(e, 'Não foi possível carregar os bloqueios.'));
    }
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const to = f.to < f.from ? f.from : f.to;
    let starts;
    let ends;
    if (f.allDay) {
      starts = brtIso(f.from, 0);
      ends = brtIso(addDaysIso(to, 1), 0);
    } else {
      const s = parseHM(f.start);
      const e = parseHM(f.end);
      if (s == null || e == null || (to === f.from && e <= s))
        return toast.error('Confira os horários (o fim precisa ser depois do início).');
      starts = brtIso(f.from, s);
      ends = brtIso(to, e);
    }
    setBusy('add');
    try {
      await post(path, { starts_at: starts, ends_at: ends, reason: f.reason.trim() || null });
      toast.success('Bloqueio adicionado.');
      setF((x) => ({ ...x, reason: '' }));
      load();
      onChanged?.();
    } catch (e) {
      toast.error(apptErr(e, 'Não foi possível adicionar.'));
    } finally {
      setBusy('');
    }
    return undefined;
  };
  const del = async (b) => {
    setBusy(b.id);
    try {
      await remove(`${path}/${b.id}`);
      setItems((xs) => (xs || []).filter((x) => x.id !== b.id));
      onChanged?.();
    } catch (e) {
      toast.error(apptErr(e, 'Não foi possível apagar.'));
    } finally {
      setBusy('');
    }
  };
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Stack spacing={1.5}>
      {canEdit ? (
        <Box sx={{ p: 1.5, border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
          <Stack spacing={1.25}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                type="date"
                label="De"
                value={f.from}
                onChange={(e) => set('from', e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                size="small"
                type="date"
                label="Até"
                value={f.to}
                onChange={(e) => set('to', e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                <Switch size="small" checked={f.allDay} onChange={(e) => set('allDay', e.target.checked)} />
                <Typography variant="body2">Dia inteiro</Typography>
              </Stack>
              {!f.allDay ? (
                <>
                  <TextField
                    size="small"
                    type="time"
                    label="Das"
                    value={f.start}
                    onChange={(e) => set('start', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    type="time"
                    label="Até as"
                    value={f.end}
                    onChange={(e) => set('end', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </>
              ) : null}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                label="Motivo (opcional)"
                value={f.reason}
                onChange={(e) => set('reason', e.target.value.slice(0, 120))}
                placeholder="Ex.: Feriado, férias, manutenção"
                fullWidth
              />
              <Button
                variant="outlined"
                startIcon={busy === 'add' ? <CircularProgress size={14} /> : <IconPlus size={16} />}
                onClick={add}
                disabled={Boolean(busy)}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, flexShrink: 0 }}
              >
                Adicionar
              </Button>
            </Stack>
          </Stack>
        </Box>
      ) : null}
      {items === null ? (
        <TgListSkeleton rows={2} />
      ) : !items.length ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
          <IconCalendarOff size={18} />
          <Typography variant="body2">Nenhum bloqueio daqui para a frente.</Typography>
        </Stack>
      ) : (
        <Stack spacing={0.75}>
          {items.map((b) => (
            <Stack
              key={b.id}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ px: 1.25, py: 0.75, borderRadius: 2, border: '1px solid', borderColor: 'divider', minWidth: 0 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                  {blockLabel(b)}
                </Typography>
                {b.reason ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
                    {b.reason}
                  </Typography>
                ) : null}
              </Box>
              {canEdit ? (
                <Tooltip title="Apagar">
                  <span>
                    <IconButton size="small" onClick={() => del(b)} disabled={Boolean(busy)}>
                      {busy === b.id ? <CircularProgress size={14} /> : <IconTrash size={16} />}
                    </IconButton>
                  </span>
                </Tooltip>
              ) : null}
            </Stack>
          ))}
        </Stack>
      )}
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Agendamentos já marcados no período continuam; o bloqueio só tira os horários da oferta.
      </Typography>
    </Stack>
  );
}
