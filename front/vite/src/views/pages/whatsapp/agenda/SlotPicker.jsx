import { useEffect, useMemo, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconCalendarOff, IconRefresh } from '@tabler/icons-react';

import { get } from 'api/api';
import { asList } from '../waKit';
import { tint } from '../waShared';
import { THIN_SCROLL } from '../chat/chatKit';
import { API, apptErr, brtParts, dayLabel, timeOf } from './agendaKit';

// ============================================================================
// Calendário de vagas reais: dias com horário livre (GET availability) + botões
// de horário do dia escolhido. Usado no Novo agendamento e no Remarcar.
// `value` = slot escolhido {starts_at, resource_id, …}; `reloadKey` muda = busca de novo
// (ex.: depois de um 409 SLOT_TAKEN).
// ============================================================================

export default function SlotPicker({ productId, resourceId, value, onChange, reloadKey = 0, days = 30, hideResource = false }) {
  const [state, setState] = useState({ loading: false, days: [], error: '' });
  const [day, setDay] = useState('');
  const seq = useRef(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!productId) {
      setState({ loading: false, days: [], error: '' });
      return;
    }
    const s = ++seq.current;
    setState((x) => ({ ...x, loading: true, error: '' }));
    get(`${API}/availability`, { params: { product_id: productId, resource_id: resourceId || undefined, days } })
      .then((r) => {
        if (s !== seq.current) return;
        const list = asList(r)
          .map((d) => ({ ...d, slots: Array.isArray(d.slots) ? d.slots : [] }))
          .filter((d) => d.slots.length);
        setState({ loading: false, days: list, error: '' });
        setDay((cur) => (list.some((d) => d.date === cur) ? cur : list[0]?.date || ''));
      })
      .catch((e) => {
        if (s !== seq.current) return;
        setState({ loading: false, days: [], error: apptErr(e, 'Não foi possível carregar os horários.') });
      });
  }, [productId, resourceId, days, reloadKey, nonce]);

  // o slot escolhido sumiu da lista (ocupado) → limpa a escolha
  useEffect(() => {
    if (!value || state.loading) return;
    const still = state.days.some((d) =>
      d.slots.some((sl) => sl.starts_at === value.starts_at && (!value.resource_id || sl.resource_id === value.resource_id))
    );
    if (!still) onChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.days]);

  const current = useMemo(() => state.days.find((d) => d.date === day) || null, [state.days, day]);
  const multiResource = useMemo(() => {
    if (hideResource || resourceId) return false;
    const ids = new Set((current?.slots || []).map((s) => s.resource_id));
    return ids.size > 1;
  }, [current, hideResource, resourceId]);

  if (!productId)
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Escolha o serviço para ver os horários livres.
      </Typography>
    );

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 }}
        >
          Dias com vaga
        </Typography>
        {state.loading ? <CircularProgress size={14} /> : null}
        <Button
          size="small"
          startIcon={<IconRefresh size={14} />}
          onClick={() => setNonce((n) => n + 1)}
          disabled={state.loading}
          sx={{ textTransform: 'none', fontWeight: 700, py: 0 }}
        >
          Atualizar
        </Button>
      </Stack>
      {state.error ? (
        <Typography variant="body2" sx={{ color: 'error.main' }}>
          {state.error}
        </Typography>
      ) : !state.loading && !state.days.length ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary', py: 1 }}>
          <IconCalendarOff size={18} />
          <Typography variant="body2">Nenhum horário livre nos próximos {days} dias.</Typography>
        </Stack>
      ) : (
        <>
          <Stack direction="row" spacing={0.75} sx={(t) => ({ overflowX: 'auto', pb: 0.75, ...THIN_SCROLL(t) })}>
            {state.days.map((d) => {
              const sel = d.date === day;
              return (
                <ButtonBase
                  key={d.date}
                  onClick={() => setDay(d.date)}
                  sx={{
                    flexShrink: 0,
                    px: 1.25,
                    py: 0.75,
                    borderRadius: 2,
                    border: '1.5px solid',
                    borderColor: sel ? 'primary.main' : 'divider',
                    bgcolor: sel ? (t) => tint(t, 'primary', 0.1) : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: 72
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 800, color: sel ? 'primary.main' : 'text.primary' }}>
                    {d.label || dayLabel(d.date)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {d.slots.length} horário{d.slots.length === 1 ? '' : 's'}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Stack>
          {current ? (
            <Box
              sx={{
                mt: 1,
                display: 'grid',
                gap: 0.75,
                gridTemplateColumns: multiResource ? 'repeat(auto-fill, minmax(150px, 1fr))' : 'repeat(auto-fill, minmax(78px, 1fr))'
              }}
            >
              {current.slots.map((sl) => {
                const sel = value && value.starts_at === sl.starts_at && (value.resource_id || '') === (sl.resource_id || '');
                return (
                  <Button
                    key={`${sl.starts_at}-${sl.resource_id || ''}`}
                    size="small"
                    variant={sel ? 'contained' : 'outlined'}
                    disableElevation
                    onClick={() => onChange?.(sel ? null : { ...sl, date: current.date })}
                    sx={{ textTransform: 'none', fontWeight: 700, minWidth: 0, flexDirection: 'column', lineHeight: 1.2, py: 0.6 }}
                  >
                    <span>{sl.time_label || timeOf(sl.starts_at)}</span>
                    {multiResource && sl.resource_name ? (
                      <Typography component="span" variant="caption" noWrap sx={{ maxWidth: '100%', opacity: 0.8 }}>
                        {sl.resource_name}
                      </Typography>
                    ) : null}
                    {sl.left > 1 ? (
                      <Typography component="span" variant="caption" sx={{ opacity: 0.75 }}>
                        {sl.left} vagas
                      </Typography>
                    ) : null}
                  </Button>
                );
              })}
            </Box>
          ) : null}
        </>
      )}
      {value ? (
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'success.main', fontWeight: 700 }}>
          Escolhido: {dayLabel(brtParts(value.starts_at).day)} às {value.time_label || timeOf(value.starts_at)}
          {value.resource_name ? ` · ${value.resource_name}` : ''}
        </Typography>
      ) : null}
    </Box>
  );
}
