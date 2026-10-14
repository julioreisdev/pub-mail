import { useEffect, useMemo, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { useNow } from '../waKit';
import { THIN_SCROLL } from '../chat/chatKit';
import { ACTIVE_STATUSES, brtParts, brtToday, hm, intervalsOf, statusOf, weekdayOf } from './agendaKit';

// ============================================================================
// Grade de horários (visões Dia e Semana): colunas = recursos (Dia) ou dias (Semana),
// linhas de `slot` minutos; agendamentos posicionados pelo horário, com cor da situação.
// Fora da disponibilidade = hachurado; bloqueios = listrado; linha vermelha = agora.
// Arrastar um bloco para outro horário/coluna chama `onMove(appt, {resource_id, day, minutes})`
// (a página confirma antes de remarcar). Clique num vazio → `onEmptyClick`.
// ============================================================================

const ROW_H = 22;
const HEADER_H = 48;
const GUTTER_W = 56;
const DRAGGABLE = ['pending_payment', 'booked', 'confirmed'];

/** Pistas lado a lado quando há agendamentos sobrepostos (capacidade > 1). */
function layoutLanes(items) {
  const sorted = [...items].sort((a, b) => a.s - b.s || b.e - a.e);
  const lanes = [];
  const out = [];
  let group = [];
  let groupEnd = -1;
  const flush = () => {
    const n = Math.max(1, ...group.map((g) => g.lane + 1));
    group.forEach((g) => out.push({ ...g, lanes: n }));
    group = [];
    lanes.length = 0;
  };
  sorted.forEach((it) => {
    if (it.s >= groupEnd && group.length) flush();
    let lane = lanes.findIndex((end) => end <= it.s);
    if (lane < 0) {
      lane = lanes.length;
      lanes.push(it.e);
    } else lanes[lane] = it.e;
    group.push({ ...it, lane });
    groupEnd = Math.max(groupEnd, it.e);
  });
  if (group.length) flush();
  return out;
}

export default function TimeGrid({
  columns,
  appointments = [],
  blocks = [],
  range,
  slot = 15,
  showClosed = false,
  onOpen,
  onMove,
  onEmptyClick,
  minColWidth = 160,
  maxHeight = 'calc(100dvh - 300px)'
}) {
  const now = useNow(60000);
  const today = brtToday();
  const nowMin = brtParts(new Date(now).toISOString()).minutes;
  const [hover, setHover] = useState(null); // {key, minutes} durante o arrasto
  const [groupMenu, setGroupMenu] = useState(null); // {anchor, members}
  const drag = useRef(null); // {appt, offsetMin, durMin}
  const scrollRef = useRef(null);
  const rows = Math.max(1, Math.ceil((range.end - range.start) / slot));
  const pxPerMin = ROW_H / slot;
  const height = rows * ROW_H;

  // rola até perto do horário atual (ou do início) na primeira montagem
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || !scrollRef.current) return;
    scrolled.current = true;
    const hasToday = columns.some((c) => c.day === today);
    const target = hasToday ? Math.max(0, (nowMin - range.start - 60) * pxPerMin) : 0;
    scrollRef.current.scrollTop = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byCol = useMemo(() => {
    const map = new Map(columns.map((c) => [c.key, []]));
    appointments.forEach((a) => {
      if (!showClosed && !ACTIVE_STATUSES.includes(a.status) && a.status !== 'done') return;
      const p = brtParts(a.starts_at);
      const e = brtParts(a.ends_at || a.starts_at);
      const end = e.day === p.day ? Math.max(p.minutes + slot, e.minutes) : 1440;
      const col = columns.find((c) => c.day === p.day && (!c.resource_id || c.resource_id === a.resource?.id));
      if (col) map.get(col.key).push({ a, s: p.minutes, e: end });
    });
    // turma (capacidade > 1): mesmo serviço no mesmo horário vira UM bloco com a lista de pessoas
    const out = new Map();
    map.forEach((list, k) => {
      const groups = new Map();
      list.forEach((it) => {
        const gk = `${it.a.product_id || it.a.service_name}|${it.s}|${it.e}`;
        if (!groups.has(gk)) groups.set(gk, { ...it, members: [] });
        groups.get(gk).members.push(it.a);
      });
      const items = [...groups.values()].map((g) => (g.members.length > 1 ? g : { a: g.a, s: g.s, e: g.e }));
      out.set(k, layoutLanes(items));
    });
    return out;
  }, [appointments, columns, showClosed, slot]);

  const minutesAt = (ev, el) => {
    const rect = el.getBoundingClientRect();
    const y = ev.clientY - rect.top;
    const raw = range.start + y / pxPerMin - (drag.current?.offsetMin || 0);
    const snapped = Math.round(raw / slot) * slot;
    return Math.min(Math.max(range.start, snapped), range.end - slot);
  };

  const labels = [];
  for (let m = Math.ceil(range.start / 60) * 60; m < range.end; m += 60) labels.push(m);

  return (
    <Box
      ref={scrollRef}
      sx={(t) => ({
        position: 'relative',
        overflow: 'auto',
        maxHeight,
        minHeight: 360,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: 'background.paper',
        ...THIN_SCROLL(t)
      })}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `${GUTTER_W}px repeat(${columns.length}, minmax(${minColWidth}px, 1fr))`,
          minWidth: 'min-content'
        }}
      >
        {/* cabeçalho */}
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            left: 0,
            zIndex: 4,
            height: HEADER_H,
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderRight: '1px solid',
            borderColor: 'divider'
          }}
        />
        {columns.map((c) => (
          <Box
            key={`h-${c.key}`}
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 3,
              height: HEADER_H,
              px: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              bgcolor: 'background.paper',
              borderBottom: '1px solid',
              borderLeft: '1px solid',
              borderColor: 'divider',
              minWidth: 0
            }}
          >
            {c.color ? <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color, flexShrink: 0 }} /> : null}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 800, color: c.highlight ? 'primary.main' : 'text.primary' }}>
                {c.title}
              </Typography>
              {c.subtitle ? (
                <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.1 }}>
                  {c.subtitle}
                </Typography>
              ) : null}
            </Box>
          </Box>
        ))}

        {/* régua de horas */}
        <Box
          sx={{
            position: 'sticky',
            left: 0,
            zIndex: 2,
            height,
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider'
          }}
        >
          {labels.map((m) => (
            <Typography
              key={m}
              variant="caption"
              sx={{
                position: 'absolute',
                top: Math.max(2, (m - range.start) * pxPerMin - 7), // a 1ª hora não fica cortada no topo
                right: 6,
                color: 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
                fontSize: 11
              }}
            >
              {hm(m)}
            </Typography>
          ))}
        </Box>

        {/* colunas */}
        {columns.map((c) => {
          const wd = weekdayOf(c.day);
          const intervals = c.resource ? intervalsOf(c.resource, wd) : null;
          const gaps = [];
          if (intervals) {
            let cur = range.start;
            intervals.forEach((i) => {
              if (i.start > cur) gaps.push([cur, Math.min(i.start, range.end)]);
              cur = Math.max(cur, i.end);
            });
            if (cur < range.end) gaps.push([cur, range.end]);
          }
          const colBlocks = blocks
            .filter((b) => !b.resource_id || !c.resource_id || b.resource_id === c.resource_id)
            .map((b) => {
              const s = brtParts(b.starts_at);
              const e = brtParts(b.ends_at);
              if (e.day < c.day || s.day > c.day) return null;
              const from = s.day < c.day ? range.start : s.minutes;
              const to = e.day > c.day ? range.end : e.minutes;
              return to > from ? { ...b, from: Math.max(from, range.start), to: Math.min(to, range.end) } : null;
            })
            .filter(Boolean);
          const isHover = hover && hover.key === c.key;
          return (
            <Box
              key={`c-${c.key}`}
              onDragOver={(ev) => {
                if (!drag.current) return;
                ev.preventDefault();
                ev.dataTransfer.dropEffect = 'move';
                const m = minutesAt(ev, ev.currentTarget);
                if (!hover || hover.key !== c.key || hover.minutes !== m) setHover({ key: c.key, minutes: m });
              }}
              onDragLeave={(ev) => {
                if (!ev.currentTarget.contains(ev.relatedTarget)) setHover(null);
              }}
              onDrop={(ev) => {
                ev.preventDefault();
                const d = drag.current;
                setHover(null);
                drag.current = null;
                if (!d) return;
                const m = minutesAt(ev, ev.currentTarget);
                const p = brtParts(d.appt.starts_at);
                const sameResource = !c.resource_id || c.resource_id === d.appt.resource?.id;
                if (p.day === c.day && p.minutes === m && sameResource) return;
                onMove?.(d.appt, { resource_id: c.resource_id || d.appt.resource?.id, day: c.day, minutes: m });
              }}
              onClick={(ev) => {
                if (ev.target !== ev.currentTarget || !onEmptyClick) return;
                const rect = ev.currentTarget.getBoundingClientRect();
                const m = Math.floor((range.start + (ev.clientY - rect.top) / pxPerMin) / slot) * slot;
                onEmptyClick({ resource_id: c.resource_id || null, day: c.day, minutes: m });
              }}
              sx={(t) => ({
                position: 'relative',
                height,
                borderLeft: '1px solid',
                borderColor: 'divider',
                cursor: onEmptyClick ? 'copy' : 'default',
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_H * (60 / slot) - 1}px, ${
                  t.vars.palette.divider
                } ${ROW_H * (60 / slot) - 1}px, ${t.vars.palette.divider} ${ROW_H * (60 / slot)}px)`,
                backgroundPositionY: `${((Math.ceil(range.start / 60) * 60 - range.start) * pxPerMin) % (ROW_H * (60 / slot))}px`
              })}
            >
              {/* fora da disponibilidade */}
              {gaps.map(([s, e]) => (
                <Box
                  key={`g-${s}`}
                  sx={(t) => ({
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: (s - range.start) * pxPerMin,
                    height: (e - s) * pxPerMin,
                    bgcolor: 'action.hover',
                    pointerEvents: 'none',
                    ...t.applyStyles('dark', { bgcolor: 'rgba(0,0,0,.22)' })
                  })}
                />
              ))}
              {/* bloqueios / feriados */}
              {colBlocks.map((b) => (
                <Tooltip key={`b-${b.id || b.from}`} title={b.reason || 'Bloqueado'}>
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: (b.from - range.start) * pxPerMin,
                      height: Math.max(4, (b.to - b.from) * pxPerMin),
                      backgroundImage: 'repeating-linear-gradient(135deg, rgba(220,38,38,.12) 0 6px, transparent 6px 12px)',
                      borderTop: '1px dashed rgba(220,38,38,.5)',
                      borderBottom: '1px dashed rgba(220,38,38,.5)',
                      px: 0.75,
                      overflow: 'hidden'
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700, fontSize: 10.5 }} noWrap>
                      {b.reason || 'Bloqueado'}
                    </Typography>
                  </Box>
                </Tooltip>
              ))}
              {/* agora */}
              {c.day === today && nowMin >= range.start && nowMin <= range.end ? (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: (nowMin - range.start) * pxPerMin,
                    height: 2,
                    bgcolor: '#EF4444',
                    zIndex: 2,
                    pointerEvents: 'none',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: -4,
                      top: -3,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: '#EF4444'
                    }
                  }}
                />
              ) : null}
              {/* fantasma do arrasto */}
              {isHover && drag.current ? (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 3,
                    right: 3,
                    top: (hover.minutes - range.start) * pxPerMin,
                    height: Math.max(ROW_H, drag.current.durMin * pxPerMin),
                    border: '2px dashed',
                    borderColor: 'primary.main',
                    borderRadius: 1.5,
                    zIndex: 3,
                    pointerEvents: 'none',
                    px: 0.75
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>
                    {hm(hover.minutes)}
                  </Typography>
                </Box>
              ) : null}
              {/* agendamentos */}
              {(byCol.get(c.key) || []).map(({ a, s, e, lane, lanes, members }) => {
                if (members) {
                  const sts = [...new Set(members.map((m) => m.status))];
                  const gst = statusOf(sts.length === 1 ? sts[0] : 'booked');
                  const gtop = (Math.max(s, range.start) - range.start) * pxPerMin;
                  const gh = Math.max(ROW_H - 2, (Math.min(e, range.end) - Math.max(s, range.start)) * pxPerMin - 2);
                  const names = members.map((m) => m.customer?.name || 'Contato');
                  return (
                    <Box
                      key={`grp-${members[0].id}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setGroupMenu({ anchor: ev.currentTarget, members });
                      }}
                      title={`${a.time_label || hm(s)}–${a.end_time_label || hm(e)} · ${a.service_name} · ${members.length} pessoas: ${names.join(', ')}`}
                      sx={(t) => ({
                        position: 'absolute',
                        top: gtop + 1,
                        height: gh,
                        left: `calc(${(lane / lanes) * 100}% + 3px)`,
                        width: `calc(${100 / lanes}% - 6px)`,
                        zIndex: 1,
                        borderRadius: 1.5,
                        px: 0.75,
                        py: 0.25,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        bgcolor: `${gst.color}24`,
                        borderLeft: `3px solid ${gst.color}`,
                        transition: 'box-shadow .12s',
                        '&:hover': { boxShadow: '0 2px 10px rgba(15,23,42,.18)', zIndex: 2 },
                        ...t.applyStyles('dark', { bgcolor: `${gst.dark}2E`, borderLeftColor: gst.dark })
                      })}
                    >
                      <Stack direction="row" spacing={0.5} alignItems="baseline" sx={{ minWidth: 0 }}>
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', flexShrink: 0, fontSize: 11 }}
                        >
                          {a.time_label || hm(s)}
                        </Typography>
                        <Typography variant="caption" noWrap sx={{ fontWeight: 700, minWidth: 0, fontSize: 11.5 }}>
                          {a.service_name}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ display: 'block', color: 'text.secondary', fontSize: 11, lineHeight: 1.25 }}
                      >
                        {members.length} pessoas · {names.join(', ')}
                      </Typography>
                    </Box>
                  );
                }
                const st = statusOf(a.status);
                const top = (Math.max(s, range.start) - range.start) * pxPerMin;
                const h = Math.max(ROW_H - 2, (Math.min(e, range.end) - Math.max(s, range.start)) * pxPerMin - 2);
                const canDrag = Boolean(onMove) && DRAGGABLE.includes(a.status);
                const closed = !ACTIVE_STATUSES.includes(a.status);
                return (
                  <Box
                    key={a.id}
                    draggable={canDrag}
                    onDragStart={(ev) => {
                      const rect = ev.currentTarget.getBoundingClientRect();
                      drag.current = { appt: a, offsetMin: (ev.clientY - rect.top) / pxPerMin, durMin: e - s };
                      ev.dataTransfer.effectAllowed = 'move';
                      try {
                        ev.dataTransfer.setData('text/plain', a.id);
                      } catch {
                        /* Safari antigo */
                      }
                    }}
                    onDragEnd={() => {
                      drag.current = null;
                      setHover(null);
                    }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOpen?.(a);
                    }}
                    title={`${a.time_label || hm(s)}–${a.end_time_label || hm(e)} · ${a.service_name} · ${a.customer?.name || 'Contato'} · ${st.label}`}
                    sx={(t) => ({
                      position: 'absolute',
                      top: top + 1,
                      height: h,
                      left: `calc(${(lane / lanes) * 100}% + 3px)`,
                      width: `calc(${100 / lanes}% - 6px)`,
                      zIndex: 1,
                      borderRadius: 1.5,
                      px: 0.75,
                      py: 0.25,
                      overflow: 'hidden',
                      cursor: canDrag ? 'grab' : 'pointer',
                      bgcolor: `${st.color}24`,
                      borderLeft: `3px solid ${st.color}`,
                      opacity: closed ? 0.6 : 1,
                      textDecoration: a.status === 'canceled' || a.status === 'expired' ? 'line-through' : 'none',
                      transition: 'box-shadow .12s',
                      '&:hover': { boxShadow: '0 2px 10px rgba(15,23,42,.18)', zIndex: 2 },
                      ...t.applyStyles('dark', { bgcolor: `${st.dark}2E`, borderLeftColor: st.dark })
                    })}
                  >
                    <Stack direction="row" spacing={0.5} alignItems="baseline" sx={{ minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', flexShrink: 0, fontSize: 11 }}
                      >
                        {a.time_label || hm(s)}
                      </Typography>
                      <Typography variant="caption" noWrap sx={{ fontWeight: 700, minWidth: 0, fontSize: 11.5 }}>
                        {a.customer?.name || 'Contato'}
                      </Typography>
                    </Stack>
                    {h > ROW_H * 1.4 ? (
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ display: 'block', color: 'text.secondary', fontSize: 11, lineHeight: 1.25 }}
                      >
                        {a.service_name}
                      </Typography>
                    ) : null}
                    {h > ROW_H * 2.4 ? (
                      <Typography
                        variant="caption"
                        noWrap
                        sx={(t) => ({
                          display: 'block',
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: st.color,
                          ...t.applyStyles('dark', { color: st.dark })
                        })}
                      >
                        {st.short}
                      </Typography>
                    ) : null}
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>
      <Menu anchorEl={groupMenu?.anchor || null} open={Boolean(groupMenu)} onClose={() => setGroupMenu(null)}>
        {(groupMenu?.members || []).map((m) => {
          const st = statusOf(m.status);
          return (
            <MenuItem
              key={m.id}
              onClick={() => {
                setGroupMenu(null);
                onOpen?.(m);
              }}
              sx={{ gap: 1.25, minWidth: 220 }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: st.color, flexShrink: 0 }} />
              <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }} noWrap>
                {m.customer?.name || 'Contato'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {st.short}
              </Typography>
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
}
