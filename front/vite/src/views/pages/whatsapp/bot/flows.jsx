// =============================================================================
// WhatsApp — Fluxo do Bot: lista de fluxos da organização (multi-número).
//   • FlowStrip        — cartões horizontais (nome, Ligado/Desligado, números, stats) + "Novo fluxo"
//   • FlowFormDialog   — criar (com "duplicar de"), renomear, duplicar
//   • AssignNumbersDialog — PUT /whatsapp/bot/flows/:id/sessions { session_ids }
//   • UnassignedBanner — números conectados sem fluxo
// Dark-mode via theme.vars/tokens (nunca theme.palette em callback sx).
// =============================================================================
import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { IconAlertTriangle, IconMessageChatbot, IconPlayerPlay, IconPlus, IconRobot, IconUserShare } from '@tabler/icons-react';

import { TgCard, TgModal, TgStatusPill } from 'views/pages/telegram/ui';
import { WaNumberChip, WaNumberMultiSelect, sessionLabel } from '../waKit';
import { WA_DARK, WA_GREEN, hexA } from './botUi';

export const flowPillStatus = (flow) => (flow?.active ? 'active' : 'paused');
export const flowPillLabel = (flow) => (flow?.active ? 'Ligado' : 'Desligado');

const n = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR'));

function StatMini({ icon: Icon, value, title }) {
  return (
    <Tooltip title={title}>
      <Stack direction="row" spacing={0.4} alignItems="center" sx={{ color: 'text.secondary', cursor: 'default' }}>
        <Icon size={13} />
        <Typography variant="caption" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {n(value)}
        </Typography>
      </Stack>
    </Tooltip>
  );
}

/** Chips dos números de um fluxo (até `max`, o resto vira "+N"). */
export function FlowNumbers({ sessions = [], max = 3, emptyText = 'Nenhum número', size = 'small' }) {
  if (!sessions.length)
    return (
      <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
        {emptyText}
      </Typography>
    );
  const shown = sessions.slice(0, max);
  const rest = sessions.length - shown.length;
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
      {shown.map((s) => (
        <WaNumberChip key={s.id} session={s} size={size} />
      ))}
      {rest > 0 ? (
        <Tooltip title={sessions.slice(max).map(sessionLabel).join(', ')}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            +{rest}
          </Typography>
        </Tooltip>
      ) : null}
    </Stack>
  );
}

// -----------------------------------------------------------------------------
// Cartão de um fluxo
// -----------------------------------------------------------------------------
function FlowCard({ flow, selected, onSelect }) {
  const stats = flow.stats || {};
  return (
    <TgCard
      onClick={() => onSelect(flow.id)}
      sx={{
        flexShrink: 0,
        width: 236,
        p: 1.5,
        cursor: 'pointer',
        scrollSnapAlign: 'start',
        borderColor: selected ? WA_GREEN : 'divider',
        bgcolor: selected ? hexA(WA_GREEN, 0.07) : 'background.paper',
        boxShadow: selected ? `0 0 0 3px ${hexA(WA_GREEN, 0.16)}` : undefined,
        '&:hover': { borderColor: selected ? WA_GREEN : hexA(WA_GREEN, 0.5) }
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.9 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            flexShrink: 0,
            borderRadius: 1.5,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            background: flow.active ? `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})` : 'linear-gradient(135deg, #94A3B8, #64748B)'
          }}
        >
          <IconRobot size={16} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 13.5, flex: 1, minWidth: 0 }} noWrap title={flow.name}>
          {flow.name}
        </Typography>
        <TgStatusPill status={flowPillStatus(flow)} label={flowPillLabel(flow)} />
      </Stack>
      <Box sx={{ minHeight: 22, mb: 0.9 }}>
        <FlowNumbers sessions={flow.sessions || []} />
      </Box>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <StatMini icon={IconMessageChatbot} value={stats.active_sessions} title="Conversas com o bot agora" />
        <StatMini icon={IconPlayerPlay} value={stats.started_24h} title="Atendimentos iniciados nas últimas 24 h" />
        <StatMini icon={IconUserShare} value={stats.handoffs_24h} title="Transferidos para atendente nas últimas 24 h" />
      </Stack>
    </TgCard>
  );
}

/** Faixa horizontal com os fluxos + cartão "Novo fluxo". */
export function FlowStrip({ flows, selectedId, onSelect, onCreate, canCreate = true, sx }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.25,
        overflowX: 'auto',
        overflowY: 'hidden',
        pb: 0.75,
        scrollSnapType: 'x proximity',
        scrollbarWidth: 'thin',
        '&::-webkit-scrollbar': { height: 6 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
        ...sx
      }}
    >
      {flows.map((f) => (
        <FlowCard key={f.id} flow={f} selected={f.id === selectedId} onSelect={onSelect} />
      ))}
      <Tooltip title={canCreate ? '' : 'Limite de fluxos atingido.'}>
        <Box
          role="button"
          tabIndex={0}
          onClick={() => canCreate && onCreate()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && canCreate) {
              e.preventDefault();
              onCreate();
            }
          }}
          sx={{
            flexShrink: 0,
            width: 150,
            minHeight: 104,
            borderRadius: 3,
            border: '1.5px dashed',
            borderColor: 'divider',
            display: 'grid',
            placeItems: 'center',
            cursor: canCreate ? 'pointer' : 'not-allowed',
            color: canCreate ? 'text.secondary' : 'text.disabled',
            transition: 'border-color .14s, color .14s, background-color .14s',
            outline: 'none',
            '&:hover': canCreate ? { borderColor: WA_GREEN, color: WA_DARK, bgcolor: hexA(WA_GREEN, 0.05) } : undefined,
            '&:focus-visible': { boxShadow: `0 0 0 3px ${hexA(WA_GREEN, 0.3)}` }
          }}
        >
          <Stack alignItems="center" spacing={0.5}>
            <IconPlus size={22} />
            <Typography variant="caption" sx={{ fontWeight: 800 }}>
              Novo fluxo
            </Typography>
          </Stack>
        </Box>
      </Tooltip>
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Criar / renomear / duplicar
//   state: { mode: 'create' | 'rename' | 'duplicate', flow? }
// -----------------------------------------------------------------------------
export function FlowFormDialog({ state, flows = [], busy, onClose, onSubmit }) {
  const mode = state?.mode;
  const open = Boolean(state);
  const [name, setName] = useState('');
  const [cloneOf, setCloneOf] = useState('');
  useEffect(() => {
    if (!open) return;
    if (mode === 'rename') setName(state.flow?.name || '');
    else if (mode === 'duplicate') setName(`${state.flow?.name || 'Fluxo do bot'} (cópia)`);
    else setName(flows.length ? `Fluxo do bot ${flows.length + 1}` : 'Fluxo do bot');
    setCloneOf(mode === 'duplicate' ? state.flow?.id || '' : '');
  }, [open, mode, state?.flow?.id, state?.flow?.name, flows.length]);

  const title = mode === 'rename' ? 'Renomear fluxo' : mode === 'duplicate' ? 'Duplicar fluxo' : 'Novo fluxo';
  const subtitle =
    mode === 'rename'
      ? 'O nome é só interno — o cliente nunca vê.'
      : mode === 'duplicate'
        ? 'A cópia nasce desligada e em Modo teste, sem nenhum número.'
        : 'Cada número do WhatsApp usa um fluxo. O fluxo novo nasce desligado e em Modo teste.';
  const submit = () => {
    const v = name.trim();
    if (!v) return;
    onSubmit({ mode, name: v, clone_of: mode === 'rename' ? undefined : cloneOf || undefined, flow: state?.flow });
  };
  return (
    <TgModal
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      subtitle={subtitle}
      maxWidth="xs"
      disableClose={busy}
      footer={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={submit}
            disabled={busy || !name.trim()}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : null}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
          >
            {mode === 'rename' ? 'Salvar' : mode === 'duplicate' ? 'Duplicar' : 'Criar fluxo'}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 0.5 }}>
        <TextField
          label="Nome do fluxo"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 120))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          autoFocus
          size="small"
          fullWidth
          placeholder="Ex.: Vendas, Suporte, Pós-venda"
        />
        {mode === 'create' && flows.length ? (
          <TextField
            select
            label="Começar a partir de"
            value={cloneOf}
            onChange={(e) => setCloneOf(e.target.value)}
            size="small"
            fullWidth
            helperText={
              cloneOf
                ? 'Copia os blocos e as configurações do fluxo escolhido.'
                : 'Fluxo padrão: boas-vindas → menu → atendente / encerrar.'
            }
          >
            <MenuItem value="">Fluxo padrão (do zero)</MenuItem>
            {flows.map((f) => (
              <MenuItem key={f.id} value={f.id}>
                Cópia de “{f.name}”
              </MenuItem>
            ))}
          </TextField>
        ) : null}
      </Stack>
    </TgModal>
  );
}

// -----------------------------------------------------------------------------
// Números que usam o fluxo
// -----------------------------------------------------------------------------
export function AssignNumbersDialog({ flow, flows = [], sessions = [], preselect, busy, onClose, onSubmit }) {
  const open = Boolean(flow);
  const [ids, setIds] = useState([]);
  useEffect(() => {
    // `preselect`: números que o aviso "sem fluxo" pede para já entrar marcados
    if (open) setIds([...new Set([...(flow.sessions || []).map((s) => s.id), ...(preselect || [])])]);
  }, [open, flow, preselect]);

  // número → fluxo atual (para avisar que vai sair do outro)
  const flowOfSession = useMemo(() => {
    const m = new Map();
    flows.forEach((f) => (f.sessions || []).forEach((s) => m.set(s.id, f)));
    return m;
  }, [flows]);
  const moving = ids
    .map((id) => ({ session: sessions.find((s) => s.id === id), from: flowOfSession.get(id) }))
    .filter((x) => x.session && x.from && x.from.id !== flow?.id);
  const leaving = (flow?.sessions || []).filter((s) => !ids.includes(s.id));

  return (
    <TgModal
      open={open}
      onClose={() => !busy && onClose()}
      title="Números que usam este fluxo"
      subtitle={flow ? `“${flow.name}” — escolha em quais números do WhatsApp este fluxo responde.` : ''}
      maxWidth="sm"
      disableClose={busy}
      footer={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={() => onSubmit(ids)}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : null}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
          >
            Salvar
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 0.5 }}>
        {sessions.length ? (
          <WaNumberMultiSelect sessions={sessions} value={ids} onChange={setIds} />
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Nenhum número cadastrado. Conecte um número em Configurações.
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
          Um número só tem <b>um</b> fluxo por vez. Ao trazer um número para cá, ele deixa o fluxo que usava antes; as conversas que o outro
          bot estava conduzindo naquele número são encerradas. O mesmo fluxo pode ser usado por vários números.
        </Typography>
        {moving.length ? (
          <Alert severity="warning" icon={<IconAlertTriangle size={18} />} sx={{ borderRadius: 2, py: 0.25 }}>
            {moving.map((m) => (
              <Box key={m.session.id} component="span" sx={{ display: 'block' }}>
                <b>{sessionLabel(m.session)}</b> sai de “{m.from.name}”.
              </Box>
            ))}
          </Alert>
        ) : null}
        {leaving.length ? (
          <Alert severity="info" sx={{ borderRadius: 2, py: 0.25 }}>
            {leaving.map((s) => (
              <Box key={s.id} component="span" sx={{ display: 'block' }}>
                <b>{sessionLabel(s)}</b> fica sem fluxo (o bot para de responder nesse número).
              </Box>
            ))}
          </Alert>
        ) : null}
      </Stack>
    </TgModal>
  );
}

// -----------------------------------------------------------------------------
// Aviso: números conectados sem fluxo
// -----------------------------------------------------------------------------
export function UnassignedBanner({ sessions = [], onAssign, canManage, sx }) {
  if (!sessions.length) return null;
  const names = sessions.map(sessionLabel).join(', ');
  return (
    <Alert
      severity="info"
      icon={<IconRobot size={20} />}
      sx={{ borderRadius: 2, py: 0.25, ...sx }}
      action={
        <Tooltip title={canManage ? '' : 'Só administradores atribuem números a um fluxo.'}>
          <span>
            <Button
              color="inherit"
              size="small"
              onClick={onAssign}
              disabled={!canManage}
              sx={{ fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}
            >
              Atribuir
            </Button>
          </span>
        </Tooltip>
      }
    >
      {sessions.length === 1 ? (
        <>
          O número <b>{names}</b> está conectado, mas sem fluxo do bot — ele não responde automaticamente.
        </>
      ) : (
        <>
          {sessions.length} números conectados estão sem fluxo do bot: <b>{names}</b>.
        </>
      )}
    </Alert>
  );
}
