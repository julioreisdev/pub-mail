import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Chart from 'react-apexcharts';

import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconCash,
  IconChartBar,
  IconCircleCheck,
  IconClockHour4,
  IconDeviceMobile,
  IconHeadset,
  IconHourglass,
  IconMessage2,
  IconMoodSmile,
  IconRefresh,
  IconRobot,
  IconStar,
  IconStarFilled,
  IconUsers
} from '@tabler/icons-react';

import { get } from 'api/api';
import { TgAvatar, TgCard, TgEmptyState, TgFilterBar, TgListSkeleton } from 'views/pages/telegram/ui';
import { WaNumberChip, WaPageHeader, fmtPhoneBR, useWaSessions } from './waKit';
import { WA_DARK, WA_GREEN, errMsg } from './waShared';
import { CrmKpi, WaNumberFilter, useSessionFilter } from './crm/crmKit';

// ============================================================================
// WhatsApp → Métricas: volume, tempo até a 1ª resposta humana, resolução, atendimentos,
// satisfação, por atendente, por etiqueta, funil e cobranças do período.
// Multi-número: filtro "Número" (?session=) manda `session_id` e recalcula tudo; a seção
// "Por número" (`by_session`) aparece quando a org tem mais de um número.
// ============================================================================

const PRESETS = [
  ['7', '7 dias'],
  ['30', '30 dias'],
  ['90', '90 dias'],
  ['month', 'Este mês'],
  ['custom', 'Personalizado']
];
const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDur = (sec) => {
  if (sec == null) return '—';
  const s = Math.round(sec);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1).replace('.', ',')} h`;
  return `${(s / 86400).toFixed(1).replace('.', ',')} d`;
};
const n = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR'));

function Stars({ value }) {
  if (value == null) return <Typography variant="caption">—</Typography>;
  const full = Math.round(value);
  return (
    <Stack direction="row" spacing={0.1} alignItems="center">
      {[1, 2, 3, 4, 5].map((i) =>
        i <= full ? <IconStarFilled key={i} size={13} color="#F59E0B" /> : <IconStar key={i} size={13} color="#F59E0B" />
      )}
      <Typography variant="caption" sx={{ ml: 0.5, fontWeight: 700 }}>
        {value.toFixed(1).replace('.', ',')}
      </Typography>
    </Stack>
  );
}

function Section({ title, icon: Icon, children, right }) {
  return (
    <TgCard hover={false} sx={{ p: 0, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        {Icon ? <Icon size={18} color={WA_DARK} /> : null}
        <Typography variant="subtitle2" sx={{ fontWeight: 800, flex: 1 }}>
          {title}
        </Typography>
        {right}
      </Stack>
      {children}
    </TgCard>
  );
}

export default function WhatsAppMetrics() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { sessions } = useWaSessions(60000);
  const { value: sessionId, set: setSessionId, multi } = useSessionFilter(sessions);
  const [preset, setPreset] = useState('30');
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyPreset = (k) => {
    setPreset(k);
    const now = new Date();
    if (k === 'custom') return;
    if (k === 'month') setFrom(isoDay(new Date(now.getFullYear(), now.getMonth(), 1)));
    else setFrom(isoDay(new Date(now.getTime() - (Number(k) - 1) * 86400000)));
    setTo(isoDay(now));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await get('/whatsapp/metrics', {
        params: {
          from: new Date(`${from}T00:00:00-03:00`).toISOString(),
          to: new Date(`${to}T23:59:59.999-03:00`).toISOString(),
          session_id: sessionId || undefined
        }
      });
      setData(r);
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao carregar as métricas.'));
    } finally {
      setLoading(false);
    }
  }, [from, to, sessionId]);
  useEffect(() => {
    load();
  }, [load]);

  const t = data?.totals;
  const dark = theme.palette.mode === 'dark';
  const axisColor = dark ? '#94A3B8' : '#64748B';
  const series = useMemo(() => data?.series || [], [data]);
  const volumeOptions = useMemo(
    () => ({
      chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit', background: 'transparent' },
      theme: { mode: dark ? 'dark' : 'light' },
      colors: ['#3B82F6', WA_GREEN, '#A78BFA'],
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.02 } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: series.map((d) => d.day.slice(5).split('-').reverse().join('/')),
        labels: { style: { colors: axisColor }, rotate: 0, hideOverlappingLabels: true },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: { labels: { style: { colors: axisColor } } },
      grid: { borderColor: dark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)', strokeDashArray: 3 },
      legend: { position: 'top', horizontalAlign: 'right', labels: { colors: axisColor } },
      tooltip: { theme: dark ? 'dark' : 'light' }
    }),
    [series, dark, axisColor]
  );
  const volumeSeries = useMemo(
    () => [
      { name: 'Recebidas', data: series.map((d) => d.in) },
      { name: 'Enviadas', data: series.map((d) => d.out) },
      { name: 'Novas conversas', data: series.map((d) => d.new_chats) }
    ],
    [series]
  );
  const ratingsDist = useMemo(() => data?.ratings?.distribution || [], [data]);
  const ratingOptions = useMemo(
    () => ({
      chart: { toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
      theme: { mode: dark ? 'dark' : 'light' },
      colors: ['#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E'],
      plotOptions: { bar: { distributed: true, borderRadius: 6, columnWidth: '55%' } },
      dataLabels: { enabled: true, style: { colors: [dark ? '#fff' : '#0f172a'] } },
      legend: { show: false },
      xaxis: {
        categories: ratingsDist.map((d) => `${d.score} ★`),
        labels: { style: { colors: axisColor } },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: { labels: { style: { colors: axisColor } } },
      grid: { borderColor: dark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)', strokeDashArray: 3 },
      tooltip: { theme: dark ? 'dark' : 'light' }
    }),
    [ratingsDist, dark, axisColor]
  );

  const maxTag = Math.max(1, ...(data?.by_tag || []).map((x) => x.count));
  const maxStage = Math.max(1, ...(data?.funnel || []).map((x) => x.count));
  const bySession = useMemo(() => data?.by_session || [], [data]);
  const maxSessionMsgs = Math.max(1, ...bySession.map((x) => (x.msgs_in || 0) + (x.msgs_out || 0)));

  return (
    <Box>
      <WaPageHeader
        icon={IconChartBar}
        title="Métricas"
        subtitle="Atendimento, satisfação, funil e cobranças do WhatsApp no período."
        sx={{ mb: 2.5 }}
        action={
          // celular: o botão vai para a barra de filtros (ao lado dos períodos), não sozinho numa linha
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Tooltip title="Atualizar">
              <span>
                <IconButton onClick={load} disabled={loading} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <IconRefresh size={18} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        }
      />

      <TgFilterBar>
        {/* período: chips em linha que quebram no celular (o TgFilterBar empilha os filhos diretos em xs) */}
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center" sx={{ minWidth: 0 }}>
          <Tooltip title="Atualizar">
            <span style={{ display: 'contents' }}>
              <IconButton size="small" onClick={load} disabled={loading} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
                <IconRefresh size={18} />
              </IconButton>
            </span>
          </Tooltip>
          {PRESETS.map(([k, l]) => (
            <Chip
              key={k}
              label={l}
              size="small"
              clickable
              onClick={() => applyPreset(k)}
              color={preset === k ? 'success' : 'default'}
              variant={preset === k ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700 }}
            />
          ))}
        </Stack>
        {preset === 'custom' ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
            <TextField
              size="small"
              type="date"
              label="De"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { xs: 'calc(50% - 4px)', sm: 160 }, minWidth: 0 }}
            />
            <TextField
              size="small"
              type="date"
              label="Até"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { xs: 'calc(50% - 4px)', sm: 160 }, minWidth: 0 }}
            />
          </Stack>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.secondary', ml: { md: 1 } }}>
            {from.split('-').reverse().join('/')} – {to.split('-').reverse().join('/')}
          </Typography>
        )}
        <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }} />
        <WaNumberFilter sessions={sessions} value={sessionId} onChange={setSessionId} sx={{ width: { xs: '100%', md: 'auto' } }} />
      </TgFilterBar>

      {loading && !data ? (
        <TgCard hover={false} sx={{ p: 2 }}>
          <TgListSkeleton rows={6} />
        </TgCard>
      ) : !data ? (
        <TgEmptyState icon={IconChartBar} title="Sem dados" description="Não foi possível carregar as métricas." />
      ) : (
        <Stack spacing={2}>
          {loading ? <LinearProgress color="success" sx={{ borderRadius: 1 }} /> : null}
          {data.truncated ? (
            <Typography variant="caption" sx={{ color: 'warning.main' }}>
              Período muito grande: os números consideram as primeiras 100 mil mensagens/eventos. Reduza o período para precisão total.
            </Typography>
          ) : null}
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' },
              // celular: o rótulo do KPI quebra em quantas linhas precisar (sem clamp — o
              // line-clamp cortava com reticências e ainda vazava do card)
              '& .MuiTypography-caption': { whiteSpace: 'normal', overflowWrap: 'break-word', hyphens: 'auto', lineHeight: 1.3 }
            }}
          >
            <CrmKpi icon={IconUsers} label={`Conversas ativas · ${n(t.new_chats)} novas`} value={t.chats_active} accent />
            <CrmKpi
              icon={IconMessage2}
              label={`Mensagens · ${n(t.msgs_in)} recebidas`}
              hint={`${n(t.msgs_in)} recebidas · ${n(t.msgs_out)} enviadas`}
              value={t.msgs_in + t.msgs_out}
            />
            <CrmKpi
              icon={IconClockHour4}
              label={`1ª resposta humana · mediana ${fmtDur(t.first_response_median_sec)}`}
              hint={`Da mensagem do cliente à 1ª resposta de um atendente (${n(t.first_response_n)} casos)`}
              value={fmtDur(t.first_response_avg_sec)}
            />
            <CrmKpi
              icon={IconCircleCheck}
              label={`Resolução média · ${n(t.resolution_n)} atendimentos`}
              hint="Do início do atendimento até o encerramento"
              value={fmtDur(t.resolution_avg_sec)}
            />
            <CrmKpi
              icon={IconHeadset}
              label={`Assumidos · ${n(t.closed)} encerrados`}
              hint={`${n(t.auto_assigned)} distribuídos automaticamente`}
              value={t.assumed}
            />
            <CrmKpi icon={IconRobot} label={`Pelo bot · ${n(t.handoffs)} p/ humano`} value={t.out_bot} />
            <CrmKpi icon={IconHourglass} label={`Na fila · ${n(t.human_now)} em atendimento`} value={t.waiting_now} />
            <CrmKpi
              icon={IconMoodSmile}
              label={`Satisfação · ${n(data.ratings.count)} avaliações`}
              value={data.ratings.avg == null ? '—' : `${data.ratings.avg.toFixed(1).replace('.', ',')} / 5`}
            />
          </Box>

          {multi && !sessionId && bySession.length ? (
            <Section
              title="Por número"
              icon={IconDeviceMobile}
              right={
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Clique num número para ver só ele
                </Typography>
              }
            >
              <TableContainer>
                <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Número</TableCell>
                      <TableCell sx={{ width: '30%' }}>Mensagens</TableCell>
                      <TableCell align="right">Recebidas</TableCell>
                      <TableCell align="right">Enviadas</TableCell>
                      <TableCell align="right">Conversas ativas</TableCell>
                      <TableCell align="right">Assumidos</TableCell>
                      <TableCell align="right">Encerrados</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bySession.map((row) => {
                      const totalMsgs = (row.msgs_in || 0) + (row.msgs_out || 0);
                      return (
                        <TableRow key={row.session_id} hover sx={{ cursor: 'pointer' }} onClick={() => setSessionId(row.session_id)}>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <WaNumberChip
                                session={sessions.find((x) => x.id === row.session_id) || { ...row, id: row.session_id, connected: true }}
                                size="medium"
                              />
                              {row.phone ? (
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  {fmtPhoneBR(row.phone)}
                                </Typography>
                              ) : null}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <LinearProgress
                                variant="determinate"
                                value={(totalMsgs / maxSessionMsgs) * 100}
                                sx={{
                                  flex: 1,
                                  height: 6,
                                  borderRadius: 3,
                                  bgcolor: 'action.hover',
                                  '& .MuiLinearProgress-bar': { bgcolor: row.color || WA_GREEN }
                                }}
                              />
                              <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
                                {n(totalMsgs)}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">{n(row.msgs_in)}</TableCell>
                          <TableCell align="right">{n(row.msgs_out)}</TableCell>
                          <TableCell align="right">{n(row.chats_active)}</TableCell>
                          <TableCell align="right">{n(row.assumed)}</TableCell>
                          <TableCell align="right">{n(row.closed)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Section>
          ) : null}
          {multi && sessionId ? (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Mostrando só o número
              </Typography>
              <WaNumberChip session={sessions.find((x) => x.id === sessionId)} size="medium" />
              <Button size="small" onClick={() => setSessionId('')} sx={{ textTransform: 'none', fontWeight: 700 }}>
                Ver todos os números
              </Button>
            </Stack>
          ) : null}

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' } }}>
            <Section title="Volume por dia" icon={IconMessage2}>
              <Box sx={{ p: 1 }}>
                <Chart type="area" height={280} options={volumeOptions} series={volumeSeries} />
              </Box>
            </Section>
            <Section title="Satisfação" icon={IconMoodSmile} right={<Stars value={data.ratings.avg} />}>
              {data.ratings.count ? (
                <Box sx={{ p: 1 }}>
                  <Chart
                    type="bar"
                    height={280}
                    options={ratingOptions}
                    series={[{ name: 'Avaliações', data: ratingsDist.map((d) => d.count) }]}
                  />
                </Box>
              ) : (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Nenhuma avaliação no período. Ligue a pesquisa em <strong>Configurações → Atendimento</strong>: ao encerrar um
                    atendimento o cliente recebe &quot;De 1 a 5…&quot;.
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => navigate('/whatsapp/settings')}
                    sx={{ mt: 1, textTransform: 'none', fontWeight: 700 }}
                  >
                    Abrir configurações
                  </Button>
                </Box>
              )}
            </Section>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
            <Section title="Por atendente" icon={IconHeadset}>
              {data.attendants.length ? (
                <TableContainer>
                  <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Atendente</TableCell>
                        <TableCell align="right">Enviadas</TableCell>
                        <TableCell align="right">Assumidos</TableCell>
                        <TableCell align="right">Encerrados</TableCell>
                        <TableCell align="right">1ª resposta</TableCell>
                        <TableCell>Satisfação</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.attendants.map((a) => (
                        <TableRow key={a.id} hover>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <TgAvatar name={a.name || '?'} size={28} kind="contact" />
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {a.name || 'Usuário removido'}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">{n(a.sent)}</TableCell>
                          <TableCell align="right">{n(a.assumed)}</TableCell>
                          <TableCell align="right">{n(a.closed)}</TableCell>
                          <TableCell align="right">{fmtDur(a.first_response_avg_sec)}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Stars value={a.rating_avg} />
                              {a.rating_count ? (
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  ({a.rating_count})
                                </Typography>
                              ) : null}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" sx={{ p: 2, color: 'text.secondary' }}>
                  Nenhuma mensagem enviada pelo painel no período.
                </Typography>
              )}
            </Section>
            <Section title="Cobranças" icon={IconCash}>
              <Stack spacing={1} sx={{ p: 2 }}>
                {[
                  ['Emitidas no período', `${n(data.charges.created)} · ${data.charges.created_label}`],
                  ['Pagas no período', `${n(data.charges.paid)} · ${data.charges.paid_label}`],
                  ['Em atraso agora', `${n(data.charges.overdue)} · ${data.charges.overdue_label}`],
                  ['Falharam ao gerar', n(data.charges.failed)]
                ].map(([l, v]) => (
                  <Stack
                    key={l}
                    direction="row"
                    justifyContent="space-between"
                    sx={{ borderBottom: '1px dashed', borderColor: 'divider', pb: 0.5 }}
                  >
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {l}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {v}
                    </Typography>
                  </Stack>
                ))}
                <Button
                  size="small"
                  onClick={() => navigate('/whatsapp/charges')}
                  sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
                >
                  Ver cobranças
                </Button>
              </Stack>
            </Section>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
            <Section title="Conversas por etiqueta" icon={IconUsers}>
              {data.by_tag.length ? (
                <Stack spacing={1} sx={{ p: 2 }}>
                  {data.by_tag.slice(0, 12).map((tg) => (
                    <Box key={tg.id}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                        <Chip
                          size="small"
                          label={tg.name}
                          sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: tg.color, color: '#fff' }}
                        />
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {n(tg.count)}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={(tg.count / maxTag) * 100}
                        sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: tg.color } }}
                      />
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" sx={{ p: 2, color: 'text.secondary' }}>
                  Nenhuma conversa com etiqueta no período.
                </Typography>
              )}
            </Section>
            <Section
              title="Funil (agora)"
              icon={IconChartBar}
              right={
                <Button size="small" onClick={() => navigate('/whatsapp/pipeline')} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Abrir funil
                </Button>
              }
            >
              {data.funnel.length ? (
                <Stack spacing={1} sx={{ p: 2 }}>
                  {data.funnel.map((s) => (
                    <Box key={s.id}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {s.name}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {n(s.count)}
                          {s.deal_cents ? ` · ${s.deal_label}` : ''}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={(s.count / maxStage) * 100}
                        sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: s.color } }}
                      />
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" sx={{ p: 2, color: 'text.secondary' }}>
                  Funil ainda sem etapas.
                </Typography>
              )}
            </Section>
          </Box>
          {t.optouts ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {n(t.optouts)} contato{t.optouts === 1 ? '' : 's'} pediu descadastro (LGPD) no período — veja em Contatos.
            </Typography>
          ) : null}
        </Stack>
      )}
    </Box>
  );
}
