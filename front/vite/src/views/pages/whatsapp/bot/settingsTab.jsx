// =============================================================================
// WhatsApp — Fluxo do Bot: aba Configurações (público, início, conversa,
// horário de atendimento) + status/ativação, números que usam o fluxo e "como funciona".
// =============================================================================
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Box, Button, CircularProgress, Grid, IconButton, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import {
  IconAdjustments,
  IconClock,
  IconDeviceMobile,
  IconFlask,
  IconHeadset,
  IconLock,
  IconMessageChatbot,
  IconMessages,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconRobot,
  IconTags,
  IconUserShare,
  IconUsers,
  IconUsersGroup,
  IconX
} from '@tabler/icons-react';

import { get } from 'api/api';
import { TgCard, TgModal } from 'views/pages/telegram/ui';
import WaChatPicker from '../WaChatPicker';
import { WaNumberChip, fmtPhone } from '../waShared';
import { BH_PRESETS, DAY_LABEL, DAY_ORDER, cleanKeyword } from './botModel';
import {
  BOT_STATUS,
  BotStatusPill,
  IntField,
  KeywordsInput,
  SectionTitle,
  Segmented,
  TagSelect,
  VarTextField,
  WA_ACCENT,
  WA_DARK,
  WA_GREEN,
  hexA
} from './botUi';

const switchSx = {
  '& .MuiSwitch-switchBase.Mui-checked': { color: WA_GREEN },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: WA_GREEN, opacity: 0.55 }
};

const fmtDT = (v) => {
  if (!v) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(v));
  } catch {
    return null;
  }
};

const isGroupId = (id) => /@(g\.us|newsletter|broadcast)$/.test(String(id || ''));
const nameFromId = (id) => {
  const s = String(id || '');
  if (s.endsWith('@c.us') || s.endsWith('@s.whatsapp.net')) return fmtPhone(s.split('@')[0]);
  return `Contato ${s.split('@')[0].slice(-4)}`;
};

// -----------------------------------------------------------------------------
function Card({ icon: Icon, color = WA_DARK, title, subtitle, action, children, sx }) {
  return (
    <TgCard hover={false} sx={{ p: { xs: 2, sm: 2.5 }, ...sx }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: children ? 2 : 0 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            flexShrink: 0,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: color === WA_DARK ? WA_ACCENT : color,
            bgcolor: hexA(color, 0.13)
          }}
        >
          <Icon size={20} stroke={1.9} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 15.5, lineHeight: 1.3 }}>{title}</Typography>
          {subtitle ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {action || null}
      </Stack>
      {children}
    </TgCard>
  );
}

function ChoiceCard({ selected, onClick, icon: Icon, title, desc }) {
  return (
    <Box
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        flex: 1,
        minWidth: 0,
        cursor: 'pointer',
        p: 1.5,
        borderRadius: 2.5,
        border: '1.5px solid',
        borderColor: selected ? WA_GREEN : 'divider',
        bgcolor: selected ? hexA(WA_GREEN, 0.07) : 'background.paper',
        boxShadow: selected ? `0 0 0 3px ${hexA(WA_GREEN, 0.14)}` : 'none',
        transition: 'border-color .14s, box-shadow .14s, background-color .14s',
        outline: 'none',
        '&:hover': { borderColor: selected ? WA_GREEN : hexA(WA_GREEN, 0.5) },
        '&:focus-visible': { boxShadow: `0 0 0 3px ${hexA(WA_GREEN, 0.3)}` }
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Box sx={{ color: selected ? WA_ACCENT : 'text.secondary', display: 'flex' }}>
          <Icon size={18} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 13.5, flex: 1 }}>{title}</Typography>
        <Box
          sx={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: '2px solid',
            borderColor: selected ? WA_GREEN : 'divider',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}
        >
          {selected ? <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: WA_GREEN }} /> : null}
        </Box>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.45 }}>
        {desc}
      </Typography>
    </Box>
  );
}

function StatTile({ icon: Icon, value, label, color }) {
  return (
    <Box
      sx={{ flex: 1, minWidth: 140, p: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 30, height: 30, borderRadius: 1.75, display: 'grid', placeItems: 'center', color, bgcolor: hexA(color, 0.13) }}>
          <Icon size={17} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 22, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value == null ? '—' : Number(value).toLocaleString('pt-BR')}
        </Typography>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75, lineHeight: 1.35 }}>
        {label}
      </Typography>
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Status + ativação
// -----------------------------------------------------------------------------
export function StatusCard({ status, meta, canManage, onToggle, toggling, disabled, sessions = [], onManageSessions }) {
  const cfg = BOT_STATUS[status] || BOT_STATUS.paused;
  const active = Boolean(meta?.active);
  const stats = meta?.stats || {};
  const published = fmtDT(meta?.published_at);
  const noNumbers = !sessions.length;
  return (
    <TgCard hover={false} sx={{ p: { xs: 2, sm: 2.5 }, overflow: 'hidden' }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(600px 120px at 0% 0%, ${hexA(cfg.color, 0.1)}, transparent 70%)`
        }}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ position: 'relative' }}>
        <Box
          sx={{
            width: 54,
            height: 54,
            flexShrink: 0,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            background: active ? `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})` : 'linear-gradient(135deg, #94A3B8, #64748B)',
            boxShadow: `0 8px 20px ${hexA(active ? WA_DARK : '#64748B', 0.3)}`
          }}
        >
          <IconRobot size={28} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Status do bot</Typography>
            <BotStatusPill status={status} />
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
            {cfg.desc}
          </Typography>
          {published ? (
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.25 }}>
              Última publicação: {published}
            </Typography>
          ) : null}
        </Box>
        <Tooltip title={canManage ? '' : 'Só administradores podem ativar ou pausar o bot.'}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              flexShrink: 0
            }}
          >
            {!canManage ? <IconLock size={16} style={{ opacity: 0.6 }} /> : null}
            <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{active ? 'Bot ligado' : 'Bot desligado'}</Typography>
            {toggling ? (
              <CircularProgress size={20} sx={{ color: WA_ACCENT, mx: 1.1 }} />
            ) : (
              <Switch checked={active} disabled={!canManage || disabled} onChange={(e) => onToggle(e.target.checked)} sx={switchSx} />
            )}
          </Stack>
        </Tooltip>
      </Stack>
      {/* números que usam este fluxo */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'center' }}
        sx={{
          mt: 2,
          p: 1.25,
          borderRadius: 2.5,
          border: '1px dashed',
          borderColor: noNumbers ? '#F59E0B' : hexA(WA_GREEN, 0.5),
          position: 'relative'
        }}
      >
        <Box sx={{ color: noNumbers ? '#D97706' : WA_ACCENT, display: 'flex', flexShrink: 0 }}>
          <IconDeviceMobile size={20} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {noNumbers
              ? 'Nenhum número usa este fluxo'
              : `${sessions.length === 1 ? 'Número que usa' : `${sessions.length} números que usam`} este fluxo`}
          </Typography>
          {noNumbers ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Mesmo ligado, o bot não responde ninguém até você atribuir um número do WhatsApp.
            </Typography>
          ) : (
            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              {sessions.map((sess) => (
                <WaNumberChip key={sess.id} session={sess} showPhone />
              ))}
            </Stack>
          )}
        </Box>
        <Tooltip title={canManage ? '' : 'Só administradores atribuem números a um fluxo.'}>
          <span>
            <Button
              size="small"
              variant={noNumbers ? 'contained' : 'outlined'}
              disableElevation
              disabled={!canManage}
              onClick={onManageSessions}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2,
                whiteSpace: 'nowrap',
                ...(noNumbers
                  ? { bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }
                  : { color: WA_ACCENT, borderColor: hexA(WA_DARK, 0.4) })
              }}
            >
              {noNumbers ? 'Atribuir número' : 'Gerenciar números'}
            </Button>
          </span>
        </Tooltip>
      </Stack>
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap sx={{ mt: 2, position: 'relative' }}>
        <StatTile icon={IconMessageChatbot} value={stats.active_sessions} label="Conversas com o bot agora" color={WA_DARK} />
        <StatTile icon={IconPlayerPlay} value={stats.started_24h} label="Atendimentos iniciados (24 h)" color="#0EA5E9" />
        <StatTile icon={IconUserShare} value={stats.handoffs_24h} label="Transferidos para atendente (24 h)" color="#2563EB" />
      </Stack>
    </TgCard>
  );
}

// -----------------------------------------------------------------------------
// Horário de atendimento
// -----------------------------------------------------------------------------
function DayRow({ day, intervals, onChange }) {
  const open = intervals.length > 0;
  const setIv = (i, patch) => onChange(intervals.map((iv, k) => (k === i ? { ...iv, ...patch } : iv)));
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 0.75, sm: 1.5 }}
      alignItems={{ sm: 'center' }}
      sx={{ py: 1, borderTop: '1px solid', borderColor: 'divider' }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ width: { sm: 150 }, flexShrink: 0 }}>
        <Switch
          size="small"
          checked={open}
          onChange={(e) => onChange(e.target.checked ? [{ start: '08:00', end: '18:00' }] : [])}
          sx={switchSx}
        />
        <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: open ? 'text.primary' : 'text.secondary' }}>{DAY_LABEL[day]}</Typography>
      </Stack>
      {open ? (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
          {intervals.map((iv, i) => {
            const bad = iv.start >= iv.end;
            return (
              <Stack
                key={i}
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{
                  p: 0.5,
                  pr: 0.25,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: bad ? 'error.main' : 'divider',
                  bgcolor: 'background.default'
                }}
              >
                <TextField
                  type="time"
                  size="small"
                  value={iv.start}
                  onChange={(e) => setIv(i, { start: e.target.value })}
                  inputProps={{ step: 300 }}
                  sx={{ width: 108, '& input': { py: 0.6, fontSize: 13 } }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  até
                </Typography>
                <TextField
                  type="time"
                  size="small"
                  value={iv.end}
                  onChange={(e) => setIv(i, { end: e.target.value })}
                  inputProps={{ step: 300 }}
                  sx={{ width: 108, '& input': { py: 0.6, fontSize: 13 } }}
                />
                <Tooltip title={intervals.length > 1 ? 'Remover intervalo' : 'Fechar o dia'}>
                  <IconButton size="small" onClick={() => onChange(intervals.filter((_, k) => k !== i))}>
                    <IconX size={14} />
                  </IconButton>
                </Tooltip>
              </Stack>
            );
          })}
          {intervals.length < 3 ? (
            <Tooltip title="Adicionar intervalo (ex.: depois do almoço)">
              <IconButton
                size="small"
                onClick={() => {
                  const last = intervals[intervals.length - 1];
                  const start = last?.end && last.end < '22:00' ? last.end : '13:00';
                  onChange([...intervals, { start, end: start < '18:00' ? '18:00' : '23:59' }]);
                }}
                sx={{ color: WA_ACCENT, border: '1px dashed', borderColor: hexA(WA_DARK, 0.4) }}
              >
                <IconPlus size={15} />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
          Fechado
        </Typography>
      )}
    </Stack>
  );
}

// -----------------------------------------------------------------------------
// Aba
// -----------------------------------------------------------------------------
export default function BotSettingsTab({
  settings,
  onChange,
  status,
  meta,
  canManage,
  onToggleActive,
  toggling,
  disabled,
  connected,
  flowSessions = [],
  onManageSessions
}) {
  const s = settings;
  const set = (patch) => onChange({ ...s, ...patch });
  const setAud = (patch) => set({ audience: { ...s.audience, ...patch } });
  const setTrig = (patch) => set({ trigger: { ...s.trigger, ...patch } });
  const setBH = (patch) => set({ business_hours: { ...s.business_hours, ...patch } });

  // nomes dos contatos de teste (a config só guarda os ids)
  const [names, setNames] = useState({});
  const testIds = s.audience.test_chat_ids;
  const missingNames = testIds.filter((id) => !names[id]).join('|');
  useEffect(() => {
    if (!missingNames) return undefined;
    let alive = true;
    get('/whatsapp/chats', { params: { page_size: 200 } })
      .then((r) => {
        if (!alive) return;
        const list = Array.isArray(r) ? r : r?.items || [];
        const map = {};
        list.forEach((c) => {
          const label = c.name && c.name !== 'Contato sem nome' ? c.name : c.phone ? fmtPhone(c.phone) : null;
          if (c?.chat_id) map[c.chat_id] = label;
          if (c?.jid) map[c.jid] = map[c.jid] || label; // a lista guarda o contato (jid), que vale em qualquer número
        });
        setNames((p) => {
          const next = { ...p };
          missingNames.split('|').forEach((id) => {
            next[id] = map[id] || nameFromId(id);
          });
          return next;
        });
      })
      .catch(() => {
        if (!alive) return;
        setNames((p) => {
          const next = { ...p };
          missingNames.split('|').forEach((id) => {
            next[id] = next[id] || nameFromId(id);
          });
          return next;
        });
      });
    return () => {
      alive = false;
    };
  }, [missingNames]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const openPicker = () => {
    setDraft(
      testIds.map((id) => ({
        chat_id: id,
        jid: /@/.test(String(id)) ? id : undefined,
        name: names[id] || nameFromId(id),
        kind: 'individual'
      }))
    );
    setPickerOpen(true);
  };
  const savePicker = () => {
    const ok = draft.filter((d) => d.kind !== 'group' && d.kind !== 'channel' && d.kind !== 'broadcast' && !isGroupId(d.jid || d.chat_id));
    if (ok.length < draft.length) toast('Grupos foram ignorados — o bot só atende conversas individuais.', { icon: 'ℹ️' });
    // guarda o CONTATO (jid) e não a conversa: o modo teste vale para essa pessoa em qualquer número do fluxo
    const keyOf = (d) => d.jid || d.chat_id;
    setNames((p) => ({ ...p, ...Object.fromEntries(ok.map((d) => [keyOf(d), d.name || nameFromId(keyOf(d))])) }));
    setAud({ test_chat_ids: [...new Set(ok.map(keyOf))] });
    setPickerOpen(false);
  };

  const openDays = useMemo(() => DAY_ORDER.filter((d) => (s.business_hours.days[d] || []).length).length, [s.business_hours.days]);

  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Stack spacing={2.5}>
          <StatusCard
            status={status}
            meta={meta}
            canManage={canManage}
            onToggle={onToggleActive}
            toggling={toggling}
            disabled={disabled}
            sessions={flowSessions}
            onManageSessions={onManageSessions}
          />

          {/* público */}
          <Card icon={IconUsers} title="Quem o bot atende" subtitle="Só conversas individuais — grupos nunca recebem resposta do bot.">
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
              <ChoiceCard
                selected={s.audience.mode === 'all'}
                onClick={() => setAud({ mode: 'all' })}
                icon={IconUsers}
                title="Todos os contatos"
                desc="Qualquer pessoa que mandar mensagem."
              />
              <ChoiceCard
                selected={s.audience.mode === 'test'}
                onClick={() => setAud({ mode: 'test' })}
                icon={IconFlask}
                title="Só contatos de teste"
                desc="Ideal para testar no seu celular antes de liberar."
              />
              <ChoiceCard
                selected={s.audience.mode === 'tags'}
                onClick={() => setAud({ mode: 'tags' })}
                icon={IconTags}
                title="Só com etiquetas"
                desc="Ex.: só quem tem a etiqueta “Lead”."
              />
            </Stack>

            {s.audience.mode === 'test' ? (
              <Box
                sx={{
                  mt: 2,
                  p: 1.5,
                  borderRadius: 2.5,
                  border: '1px dashed',
                  borderColor: testIds.length ? hexA(WA_GREEN, 0.5) : '#F59E0B'
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: testIds.length ? 1 : 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
                    {testIds.length
                      ? `${testIds.length} ${testIds.length === 1 ? 'contato de teste' : 'contatos de teste'}`
                      : 'Nenhum contato de teste — o bot não vai responder ninguém.'}
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    disableElevation
                    onClick={openPicker}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
                  >
                    {testIds.length ? 'Alterar' : 'Escolher contatos'}
                  </Button>
                </Stack>
                {testIds.length ? (
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {testIds.map((id) => (
                      <Box
                        key={id}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          pl: 1.1,
                          pr: 0.4,
                          py: 0.3,
                          borderRadius: 5,
                          fontSize: 12.5,
                          fontWeight: 600,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper'
                        }}
                      >
                        {names[id] || '…'}
                        <IconButton
                          size="small"
                          onClick={() => setAud({ test_chat_ids: testIds.filter((x) => x !== id) })}
                          sx={{ p: 0.25 }}
                        >
                          <IconX size={13} />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                ) : null}
              </Box>
            ) : null}

            {s.audience.mode === 'tags' ? (
              <Box sx={{ mt: 2 }}>
                <TagSelect
                  value={s.audience.tag_ids}
                  onChange={(tag_ids) => setAud({ tag_ids })}
                  label="Atender só contatos com alguma destas etiquetas"
                  placeholder="Escolha ou crie etiquetas"
                />
              </Box>
            ) : null}

            <Box sx={{ mt: 2.25 }}>
              <TagSelect
                value={s.exclude_tag_ids}
                onChange={(exclude_tag_ids) => set({ exclude_tag_ids })}
                label="Nunca iniciar o bot para contatos com estas etiquetas"
                placeholder="Ex.: Cliente VIP, Fornecedor"
                helperText="Útil para quem você sempre atende pessoalmente."
              />
            </Box>
          </Card>

          {/* início */}
          <Card icon={IconPlayerPlay} title="Quando o bot começa" subtitle="O que faz o cliente entrar no fluxo.">
            <Segmented
              value={s.trigger.mode}
              onChange={(mode) => setTrig({ mode })}
              options={[
                { value: 'any', label: 'Qualquer mensagem' },
                { value: 'keywords', label: 'Só com palavras-chave' }
              ]}
            />
            {s.trigger.mode === 'keywords' ? (
              <Box sx={{ mt: 1.5 }}>
                <KeywordsInput
                  value={s.trigger.keywords}
                  onChange={(keywords) => setTrig({ keywords })}
                  normalize={cleanKeyword}
                  label="Palavras-chave de início"
                  placeholder="ex.: oi, orçamento, promoção"
                  helperText="O bot começa quando a mensagem do cliente contém uma destas palavras. Enter ou vírgula para adicionar."
                />
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.25 }}>
                Qualquer mensagem de um contato (que não esteja em atendimento humano) inicia o fluxo.
              </Typography>
            )}
            <Box sx={{ mt: 2.25 }}>
              <KeywordsInput
                value={s.restart_keywords}
                onChange={(restart_keywords) => set({ restart_keywords })}
                normalize={cleanKeyword}
                label="Palavras para voltar ao início"
                placeholder="ex.: menu, #inicio"
                helperText="Se o cliente mandar uma destas palavras a qualquer momento da conversa com o bot, o fluxo recomeça do início."
              />
            </Box>
          </Card>

          {/* conversa */}
          <Card icon={IconMessages} title="Conversa" subtitle="Como o bot se comporta durante o fluxo.">
            <Stack spacing={2.25}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Mostrar “digitando…”</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Antes de cada mensagem o cliente vê que você está digitando — deixa a conversa mais natural.
                  </Typography>
                </Box>
                <Switch checked={s.typing} onChange={(e) => set({ typing: e.target.checked })} sx={switchSx} />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Numeração padrão das opções</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Usada nos novos blocos de Opções numeradas (cada bloco pode escolher a sua).
                  </Typography>
                </Box>
                <Segmented
                  value={s.numbering}
                  onChange={(numbering) => set({ numbering })}
                  options={[
                    { value: 'emoji', label: '1️⃣ 2️⃣ 3️⃣' },
                    { value: 'number', label: '1. 2. 3.' }
                  ]}
                />
              </Stack>

              <VarTextField
                value={s.invalid_option_text}
                onChange={(invalid_option_text) => set({ invalid_option_text })}
                label="Aviso quando o cliente responde algo que não é uma opção"
                minRows={1}
                showFormatHint={false}
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <IntField
                  label="Tentativas antes de desistir"
                  value={s.max_retries}
                  min={1}
                  max={10}
                  onChange={(max_retries) => set({ max_retries })}
                  helperText="Depois disso, segue pela saída “Não entendeu”."
                  sx={{ flex: 1 }}
                />
                <IntField
                  label="Recomeçar se o cliente sumir por"
                  value={s.input_timeout_hours}
                  min={1}
                  max={720}
                  suffix="horas"
                  onChange={(input_timeout_hours) => set({ input_timeout_hours })}
                  helperText="Se ele parar de responder no meio do fluxo, a próxima mensagem recomeça do início."
                  sx={{ flex: 1 }}
                />
              </Stack>
            </Stack>
          </Card>

          {/* horário */}
          <Card
            icon={IconClock}
            title="Horário de atendimento"
            subtitle={
              s.business_hours.enabled
                ? `Aberto em ${openDays} ${openDays === 1 ? 'dia' : 'dias'} da semana · horário de Brasília`
                : 'Desligado — o bot funciona igual a qualquer hora.'
            }
            action={<Switch checked={s.business_hours.enabled} onChange={(e) => setBH({ enabled: e.target.checked })} sx={switchSx} />}
          >
            {s.business_hours.enabled ? (
              <Stack spacing={2}>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, mr: 0.5 }}>
                    Modelos:
                  </Typography>
                  {BH_PRESETS.map((p) => (
                    <Button
                      key={p.id}
                      size="small"
                      variant="outlined"
                      onClick={() => setBH({ days: JSON.parse(JSON.stringify(p.days)) })}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        borderRadius: 5,
                        borderColor: 'divider',
                        color: 'text.primary',
                        py: 0.2
                      }}
                    >
                      {p.label}
                    </Button>
                  ))}
                </Stack>
                <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                  {DAY_ORDER.map((d) => (
                    <DayRow
                      key={d}
                      day={d}
                      intervals={s.business_hours.days[d] || []}
                      onChange={(list) => setBH({ days: { ...s.business_hours.days, [d]: list } })}
                    />
                  ))}
                </Box>

                <VarTextField
                  value={s.business_hours.outside_text}
                  onChange={(outside_text) => setBH({ outside_text })}
                  label="Mensagem fora do horário"
                  minRows={2}
                />

                <Box>
                  <SectionTitle title="Fora do horário, depois do aviso" />
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
                    <ChoiceCard
                      selected={s.business_hours.outside_action === 'message_only'}
                      onClick={() => setBH({ outside_action: 'message_only' })}
                      icon={IconMessages}
                      title="Só avisar"
                      desc="Envia o aviso e não inicia o fluxo."
                    />
                    <ChoiceCard
                      selected={s.business_hours.outside_action === 'message_and_continue'}
                      onClick={() => setBH({ outside_action: 'message_and_continue' })}
                      icon={IconRobot}
                      title="Avisar e seguir"
                      desc="Envia o aviso e o bot continua normalmente (bom para já coletar os dados)."
                    />
                    <ChoiceCard
                      selected={s.business_hours.outside_action === 'message_and_handoff'}
                      onClick={() => setBH({ outside_action: 'message_and_handoff' })}
                      icon={IconHeadset}
                      title="Avisar e deixar na fila"
                      desc="Envia o aviso e a conversa espera um atendente no próximo horário."
                    />
                  </Stack>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Dica: use o bloco <b>Condição → Horário de atendimento</b> para seguir caminhos diferentes dentro e fora do horário.
                </Typography>
              </Stack>
            ) : null}
          </Card>
        </Stack>
      </Grid>

      {/* como funciona */}
      <Grid size={{ xs: 12, lg: 4 }}>
        <Box sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
          <TgCard hover={false} sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  background: `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})`
                }}
              >
                <IconRobot size={20} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 15.5 }}>Como o bot funciona</Typography>
            </Stack>
            <Stack spacing={1.75}>
              {[
                {
                  icon: IconDeviceMobile,
                  text: 'Cada número do WhatsApp usa um fluxo (ou nenhum). O mesmo fluxo pode atender vários números.'
                },
                { icon: IconUsersGroup, text: 'Grupos nunca são respondidos pelo bot — só conversas individuais.' },
                {
                  icon: IconHeadset,
                  text: 'Quando um atendente responde (pelo painel ou pelo celular), o bot para naquela conversa na hora.'
                },
                {
                  icon: IconRestore,
                  text: 'Depois da janela de reinício do atendimento (Configurações → Atendimento), a próxima mensagem do cliente volta para o bot.'
                },
                { icon: IconRefresh, text: 'As palavras de reinício (ex.: “menu”) levam o cliente de volta ao começo a qualquer momento.' },
                {
                  icon: IconFlask,
                  text: 'Comece no Modo teste e use o botão “Testar fluxo” para simular a conversa antes de liberar para todos.'
                }
              ].map((row, i) => {
                const I = row.icon;
                return (
                  <Stack key={i} direction="row" spacing={1.25} alignItems="flex-start">
                    <Box sx={{ color: WA_ACCENT, mt: '2px', display: 'flex', flexShrink: 0 }}>
                      <I size={18} />
                    </Box>
                    <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                      {row.text}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
            <Button
              component={RouterLink}
              to="/whatsapp/settings"
              fullWidth
              variant="outlined"
              startIcon={<IconAdjustments size={17} />}
              sx={{ mt: 2.5, textTransform: 'none', fontWeight: 700, borderRadius: 2, color: WA_ACCENT, borderColor: hexA(WA_DARK, 0.4) }}
            >
              Configurações do WhatsApp
            </Button>
          </TgCard>
        </Box>
      </Grid>

      <TgModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Contatos de teste"
        subtitle="O bot só vai responder estas conversas enquanto estiver em Modo teste. Grupos não entram."
        maxWidth="sm"
        footer={
          <>
            <Button color="inherit" onClick={() => setPickerOpen(false)} sx={{ textTransform: 'none' }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={savePicker}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Usar {draft.length ? `${draft.length} ${draft.length === 1 ? 'contato' : 'contatos'}` : 'nenhum contato'}
            </Button>
          </>
        }
      >
        {pickerOpen ? (
          <WaChatPicker
            value={draft}
            onChange={setDraft}
            connected={connected}
            listHeight={320}
            initialSessionId={flowSessions.length === 1 ? flowSessions[0].id : undefined}
          />
        ) : null}
      </TgModal>
    </Grid>
  );
}
