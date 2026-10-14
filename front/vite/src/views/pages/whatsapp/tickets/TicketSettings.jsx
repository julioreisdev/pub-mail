import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconArrowDown, IconArrowUp, IconDeviceFloppy, IconInfoCircle, IconPlus, IconRestore, IconTrash } from '@tabler/icons-react';

import { get, put } from 'api/api';
import { TgCard, TgConfirmDialog, TgListSkeleton } from 'views/pages/telegram/ui';
import { CollapsibleSection, waPrimaryBtn } from '../crm/crmKit';
import { uid } from '../waKit';
import { API, DEFAULT_TEXTS, PRIORITY, PRIORITY_KEYS, PriorityChip, TEXT_VARS, protocolExample, ticketErr } from './ticketKit';

// ============================================================================
// Configurações dos chamados (dono/admin): categorias (rótulo, descrição,
// prioridade padrão, prazos próprios, responsável padrão, ordem, ativa), prazos por
// prioridade (solução e 1ª resposta — horas CORRIDAS), aviso antes do prazo,
// encerramento automático, reabertura pela resposta do cliente, formato do
// protocolo, avisos ao cliente e textos com variáveis.
// GET/PUT /whatsapp/tickets/settings (PUT parcial; aqui mandamos tudo).
// ============================================================================

const TEXTS = [
  ['created', 'Chamado aberto', 'Vai ao cliente quando a equipe (ou a API) abre o chamado. O bot usa o texto do próprio bloco.'],
  ['status_changed', 'Mudança de situação', 'Quando a equipe muda a situação (exceto resolvido/encerrado).'],
  ['pending', 'Aguardando o cliente', 'Resposta da equipe com "Enviar e aguardar cliente". Use {{chamado.comentario}}.'],
  ['comment', 'Resposta da equipe', 'Resposta pública ao cliente. Use {{chamado.comentario}}.'],
  ['resolved', 'Resolvido', ''],
  ['closed', 'Encerrado', 'Inclui o encerramento automático dos resolvidos.'],
  ['reopened', 'Reaberto pelo cliente', 'Quando o cliente responde a um chamado resolvido dentro do prazo de reabertura.']
];
const NOTIFY = [
  ['created', 'Ao abrir o chamado', 'Envia o protocolo, a categoria e o prazo.'],
  ['status', 'Mudanças de situação', 'Inclui o aviso de encerramento.'],
  ['resolved', 'Ao resolver', ''],
  ['comment', 'Respostas públicas da equipe', 'Desligado = a resposta fica só registrada no chamado.']
];

const intOr = (v, min, max, def) => {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const hoursHint = (h) => {
  const n = parseInt(String(h), 10);
  if (!Number.isFinite(n) || n <= 0) return ' ';
  if (n < 48) return `${n} h corridas`;
  const d = n / 24;
  return `≈ ${Number.isInteger(d) ? d : d.toFixed(1).replace('.', ',')} dias corridos`;
};

/** Converte o JSON do servidor para o estado do formulário (cada categoria ganha um id local). */
const toForm = (r) => ({
  ...(r || {}),
  categories: (r?.categories || []).map((c) => ({ ...c, _id: uid('cat'), _saved: true })),
  texts: { ...DEFAULT_TEXTS, ...(r?.texts || {}) },
  sla_hours: { ...(r?.sla_hours || {}) },
  first_response_hours: { ...(r?.first_response_hours || {}) },
  notify_customer: { created: true, status: true, resolved: true, comment: true, ...(r?.notify_customer || {}) }
});

export default function TicketSettings({ canEdit, assignees = [], onSaved }) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [delCat, setDelCat] = useState(null);
  const textRefs = useRef({});

  useEffect(() => {
    get(`${API}/settings`)
      .then((r) => setS(toForm(r)))
      .catch((e) => {
        toast.error(ticketErr(e, 'Não foi possível carregar as configurações.'));
        setS(toForm({}));
      });
  }, []);

  const set = (k, v) => {
    setS((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  const setIn = (group, k, v) => {
    setS((x) => ({ ...x, [group]: { ...(x[group] || {}), [k]: v } }));
    setDirty(true);
  };
  const setCat = (id, patch) => {
    setS((x) => ({ ...x, categories: x.categories.map((c) => (c._id === id ? { ...c, ...patch } : c)) }));
    setDirty(true);
  };
  const moveCat = (idx, dir) => {
    setS((x) => {
      const list = [...x.categories];
      const j = idx + dir;
      if (j < 0 || j >= list.length) return x;
      [list[idx], list[j]] = [list[j], list[idx]];
      return { ...x, categories: list };
    });
    setDirty(true);
  };
  const addCat = () => {
    setS((x) => ({
      ...x,
      categories: [
        ...x.categories,
        {
          _id: uid('cat'),
          key: '',
          label: '',
          description: '',
          default_priority: 'normal',
          sla_hours: null,
          first_response_hours: null,
          assignee_id: null,
          active: true
        }
      ]
    }));
    setDirty(true);
  };
  const removeCat = (id) => {
    setS((x) => ({ ...x, categories: x.categories.filter((c) => c._id !== id) }));
    setDirty(true);
  };

  /** Insere a variável onde está o cursor do texto `k`. */
  const insertVar = (k, v) => {
    const el = textRefs.current[k];
    const cur = s?.texts?.[k] || '';
    const a = el && typeof el.selectionStart === 'number' ? el.selectionStart : cur.length;
    const b = el && typeof el.selectionEnd === 'number' ? el.selectionEnd : a;
    const next = `${cur.slice(0, a)}${v}${cur.slice(b)}`.slice(0, 1500);
    setIn('texts', k, next);
    window.requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = Math.min(next.length, a + v.length);
      el.setSelectionRange(pos, pos);
    });
  };

  const save = async () => {
    const cats = s.categories.map((c) => ({ ...c, label: String(c.label || '').trim() }));
    if (cats.some((c) => !c.label)) return toast.error('Dê um nome a todas as categorias (ou remova as vazias).');
    if (!cats.some((c) => c.active !== false)) return toast.error('Deixe ao menos uma categoria ativa.');
    setBusy(true);
    try {
      const body = {
        prefix: String(s.prefix || '')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 6),
        reset_yearly: Boolean(s.reset_yearly),
        categories: cats.map((c) => ({
          ...(c.key ? { key: c.key } : {}),
          label: c.label.slice(0, 60),
          description: String(c.description || '').slice(0, 200),
          default_priority: c.default_priority || 'normal',
          sla_hours: c.sla_hours === '' || c.sla_hours == null ? null : intOr(c.sla_hours, 1, 8760, 48),
          first_response_hours:
            c.first_response_hours === '' || c.first_response_hours == null ? null : intOr(c.first_response_hours, 1, 8760, 8),
          assignee_id: c.assignee_id || null,
          active: c.active !== false
        })),
        sla_hours: Object.fromEntries(PRIORITY_KEYS.map((p) => [p, intOr(s.sla_hours?.[p], 1, 8760, 48)])),
        first_response_hours: Object.fromEntries(PRIORITY_KEYS.map((p) => [p, intOr(s.first_response_hours?.[p], 1, 8760, 8)])),
        warn_before_minutes: intOr(s.warn_before_minutes, 5, 10080, 60),
        auto_close_days: intOr(s.auto_close_days, 0, 365, 7),
        reopen_days: intOr(s.reopen_days, 0, 365, 7),
        customer_reply_reopens: Boolean(s.customer_reply_reopens),
        notify_customer: s.notify_customer,
        texts: Object.fromEntries(Object.keys(DEFAULT_TEXTS).map((k) => [k, String(s.texts?.[k] || '').slice(0, 1500)]))
      };
      const r = await put(`${API}/settings`, body);
      setS(toForm(r));
      setDirty(false);
      onSaved?.(r);
      toast.success('Configurações dos chamados salvas.');
    } catch (e) {
      toast.error(ticketErr(e, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  if (!s)
    return (
      <TgCard hover={false} sx={{ p: 2 }}>
        <TgListSkeleton rows={6} />
      </TgCard>
    );

  const dis = !canEdit;
  const cardTitle = (title, sub) => (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      {sub ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          {sub}
        </Typography>
      ) : null}
    </Box>
  );

  return (
    <Stack spacing={2}>
      {!canEdit ? (
        <Alert severity="info" sx={{ borderRadius: 2.5 }}>
          Só o dono ou um admin altera as configurações dos chamados.
        </Alert>
      ) : null}
      <Alert severity="info" icon={<IconInfoCircle size={20} />} sx={{ borderRadius: 2.5 }}>
        Os prazos (SLA) contam <strong>horas corridas</strong> a partir da abertura — noites, fins de semana e feriados entram na conta (não
        há horário comercial). Mudar a prioridade ou a categoria recalcula o prazo; reabrir dá um prazo novo a partir da reabertura.
      </Alert>

      {/* Categorias */}
      <TgCard hover={false} sx={{ p: 2 }}>
        <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Categorias
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Aparecem no bot (nesta ordem) e no painel. Prazos em branco usam o prazo da prioridade.
            </Typography>
          </Box>
          {canEdit ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<IconPlus size={15} />}
              onClick={addCat}
              disabled={s.categories.length >= 40}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, flexShrink: 0 }}
            >
              Categoria
            </Button>
          ) : null}
        </Stack>
        <Stack spacing={1.25}>
          {s.categories.map((c, i) => (
            <Box
              key={c._id}
              sx={{
                p: 1.5,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                opacity: c.active === false ? 0.7 : 1,
                bgcolor: c.active === false ? 'action.hover' : 'transparent'
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
                <TextField
                  size="small"
                  label="Nome"
                  value={c.label}
                  onChange={(e) => setCat(c._id, { label: e.target.value.slice(0, 60) })}
                  disabled={dis}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <Tooltip title={c.active === false ? 'Desativada (não aparece para abrir chamado)' : 'Ativa'}>
                  <Switch
                    size="small"
                    checked={c.active !== false}
                    onChange={(e) => setCat(c._id, { active: e.target.checked })}
                    disabled={dis}
                  />
                </Tooltip>
                {canEdit ? (
                  <Stack direction="row" sx={{ flexShrink: 0 }}>
                    <IconButton size="small" onClick={() => moveCat(i, -1)} disabled={i === 0} aria-label="Subir">
                      <IconArrowUp size={16} />
                    </IconButton>
                    <IconButton size="small" onClick={() => moveCat(i, 1)} disabled={i === s.categories.length - 1} aria-label="Descer">
                      <IconArrowDown size={16} />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => (c._saved ? setDelCat(c) : removeCat(c._id))}
                      disabled={s.categories.length <= 1}
                      aria-label="Remover categoria"
                    >
                      <IconTrash size={16} />
                    </IconButton>
                  </Stack>
                ) : null}
              </Stack>
              <TextField
                size="small"
                label="Descrição (opcional)"
                value={c.description || ''}
                onChange={(e) => setCat(c._id, { description: e.target.value.slice(0, 200) })}
                disabled={dis}
                fullWidth
                sx={{ mb: 1.25 }}
              />
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.25,
                  gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(4, minmax(0,1fr))' }
                }}
              >
                <TextField
                  select
                  size="small"
                  label="Prioridade padrão"
                  value={c.default_priority || 'normal'}
                  onChange={(e) => setCat(c._id, { default_priority: e.target.value })}
                  disabled={dis}
                >
                  {PRIORITY_KEYS.map((p) => (
                    <MenuItem key={p} value={p}>
                      {PRIORITY[p].label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  type="number"
                  label="Prazo de solução"
                  value={c.sla_hours ?? ''}
                  onChange={(e) => setCat(c._id, { sla_hours: e.target.value })}
                  placeholder="da prioridade"
                  InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }}
                  InputLabelProps={{ shrink: true }}
                  helperText={c.sla_hours ? hoursHint(c.sla_hours) : 'Em branco = da prioridade'}
                  disabled={dis}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Primeira resposta"
                  value={c.first_response_hours ?? ''}
                  onChange={(e) => setCat(c._id, { first_response_hours: e.target.value })}
                  placeholder="da prioridade"
                  InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }}
                  InputLabelProps={{ shrink: true }}
                  helperText={c.first_response_hours ? hoursHint(c.first_response_hours) : 'Em branco = da prioridade'}
                  disabled={dis}
                />
                <TextField
                  select
                  size="small"
                  label="Responsável padrão"
                  value={c.assignee_id || ''}
                  onChange={(e) => setCat(c._id, { assignee_id: e.target.value || null })}
                  disabled={dis}
                  helperText="Recebe os chamados novos"
                >
                  <MenuItem value="">Ninguém (fila)</MenuItem>
                  {assignees.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name || u.email}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>
          ))}
        </Stack>
      </TgCard>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'repeat(2, minmax(0,1fr))' } }}>
        {/* Prazos por prioridade */}
        <TgCard hover={false} sx={{ p: 2 }}>
          {cardTitle('Prazos por prioridade', 'Horas corridas a partir da abertura.')}
          <Stack spacing={1.25}>
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: '96px minmax(0,1fr) minmax(0,1fr)',
                alignItems: 'center',
                '& > .hdr': { typography: 'caption', color: 'text.secondary', fontWeight: 700 }
              }}
            >
              <span className="hdr">Prioridade</span>
              <span className="hdr">Solução</span>
              <span className="hdr">1ª resposta</span>
              {PRIORITY_KEYS.map((p) => (
                <Box key={p} sx={{ display: 'contents' }}>
                  <Box>
                    <PriorityChip priority={p} />
                  </Box>
                  <TextField
                    size="small"
                    type="number"
                    value={s.sla_hours?.[p] ?? ''}
                    onChange={(e) => setIn('sla_hours', p, e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }}
                    helperText={hoursHint(s.sla_hours?.[p])}
                    disabled={dis}
                  />
                  <TextField
                    size="small"
                    type="number"
                    value={s.first_response_hours?.[p] ?? ''}
                    onChange={(e) => setIn('first_response_hours', p, e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }}
                    helperText={hoursHint(s.first_response_hours?.[p])}
                    disabled={dis}
                  />
                </Box>
              ))}
            </Box>
            <TextField
              size="small"
              type="number"
              label="Avisar a equipe antes do prazo"
              value={s.warn_before_minutes ?? 60}
              onChange={(e) => set('warn_before_minutes', e.target.value)}
              InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
              helperText="O chamado aparece como “vence em breve” e o responsável recebe notificação. Mínimo 5."
              disabled={dis}
            />
          </Stack>
        </TgCard>

        {/* Ciclo de vida + protocolo */}
        <Stack spacing={2}>
          <TgCard hover={false} sx={{ p: 2 }}>
            {cardTitle('Encerramento e reabertura')}
            <Stack spacing={1.5}>
              <TextField
                size="small"
                type="number"
                label="Encerrar resolvidos após"
                value={s.auto_close_days ?? 7}
                onChange={(e) => set('auto_close_days', e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end">dias</InputAdornment> }}
                helperText="Resolvido sem resposta do cliente vira “Encerrado”. 0 = nunca."
                disabled={dis}
              />
              <Stack direction="row" alignItems="flex-start" spacing={1}>
                <Switch
                  size="small"
                  checked={Boolean(s.customer_reply_reopens)}
                  onChange={(e) => set('customer_reply_reopens', e.target.checked)}
                  disabled={dis}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Reabrir se o cliente responder
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Mensagem do cliente num chamado resolvido reabre (agradecimentos como “ok”, “obrigado” não contam).
                  </Typography>
                </Box>
              </Stack>
              <TextField
                size="small"
                type="number"
                label="Reabrir se responder em até"
                value={s.reopen_days ?? 7}
                onChange={(e) => set('reopen_days', e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end">dias</InputAdornment> }}
                helperText="Depois disso, o cliente abre um chamado novo."
                disabled={dis || !s.customer_reply_reopens}
              />
            </Stack>
          </TgCard>
          <TgCard hover={false} sx={{ p: 2 }}>
            {cardTitle('Formato do protocolo', 'Sequencial e sem furos: cada chamado ganha o próximo número.')}
            <Stack spacing={1.5}>
              <TextField
                size="small"
                label="Prefixo (opcional)"
                value={s.prefix || ''}
                onChange={(e) =>
                  set(
                    'prefix',
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 6)
                  )
                }
                placeholder="Ex.: SUP"
                helperText="Letras e números, até 6."
                disabled={dis}
                inputProps={{ style: { fontFamily: 'monospace', letterSpacing: 1 } }}
              />
              <Stack direction="row" alignItems="flex-start" spacing={1}>
                <Switch
                  size="small"
                  checked={Boolean(s.reset_yearly)}
                  onChange={(e) => set('reset_yearly', e.target.checked)}
                  disabled={dis}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Reiniciar a numeração todo ano
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {s.reset_yearly ? 'Prefixo + ano + 6 dígitos; em janeiro volta a 000001.' : 'Prefixo + 8 dígitos, sem reiniciar.'}
                  </Typography>
                </Box>
              </Stack>
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Formato dos próximos protocolos (exemplo)
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    fontWeight: 800,
                    fontSize: 18,
                    letterSpacing: 0.5
                  }}
                >
                  {protocolExample(s.prefix, s.reset_yearly, 42)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Vale só para os chamados novos; os antigos mantêm o protocolo.
                  {s.reset_yearly ? '' : ' Sem reinício anual a contagem é separada da anual (começa em 00000001).'}
                </Typography>
              </Box>
            </Stack>
          </TgCard>
        </Stack>
      </Box>

      {/* Avisos ao cliente */}
      <TgCard hover={false} sx={{ p: 2 }}>
        {cardTitle('Avisos ao cliente pelo WhatsApp', 'Saem pela fila do número da conversa, com ritmo.')}
        <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2, minmax(0,1fr))' } }}>
          {NOTIFY.map(([k, label, hint]) => (
            <Stack key={k} direction="row" alignItems="flex-start" spacing={1}>
              <Switch
                size="small"
                checked={s.notify_customer?.[k] !== false}
                onChange={(e) => setIn('notify_customer', k, e.target.checked)}
                disabled={dis}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {label}
                </Typography>
                {hint ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {hint}
                  </Typography>
                ) : null}
              </Box>
            </Stack>
          ))}
        </Box>
      </TgCard>

      {/* Textos */}
      <TgCard hover={false} sx={{ p: 2 }}>
        {cardTitle('Mensagens ao cliente', 'Clique numa variável para inseri-la onde está o cursor. *negrito* funciona como no WhatsApp.')}
        <Stack spacing={1}>
          {TEXTS.map(([k, label, hint]) => {
            const val = s.texts?.[k] || '';
            const isDefault = val === DEFAULT_TEXTS[k];
            return (
              <CollapsibleSection key={k} title={label} summary={isDefault ? 'Texto padrão' : val.slice(0, 120)}>
                <TextField
                  size="small"
                  value={val}
                  onChange={(e) => setIn('texts', k, e.target.value.slice(0, 1500))}
                  inputRef={(el) => {
                    textRefs.current[k] = el;
                  }}
                  fullWidth
                  multiline
                  minRows={3}
                  maxRows={10}
                  helperText={hint || ' '}
                  disabled={dis}
                />
                {canEdit ? (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mt: 0.5 }}>
                    {TEXT_VARS.map((v) => (
                      <Chip
                        key={v}
                        size="small"
                        label={v}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertVar(k, v)}
                        sx={{ fontFamily: 'monospace', fontSize: 11, height: 22 }}
                      />
                    ))}
                    <Box sx={{ flex: 1 }} />
                    <Button
                      size="small"
                      startIcon={<IconRestore size={14} />}
                      disabled={isDefault}
                      onClick={() => setIn('texts', k, DEFAULT_TEXTS[k])}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Restaurar padrão
                    </Button>
                  </Stack>
                ) : null}
              </CollapsibleSection>
            );
          })}
        </Stack>
      </TgCard>

      {canEdit ? (
        <Stack direction="row" justifyContent="flex-end" spacing={1} alignItems="center" sx={{ position: 'sticky', bottom: 12, zIndex: 2 }}>
          {dirty ? <Chip size="small" color="warning" label="Alterações não salvas" sx={{ fontWeight: 700 }} /> : null}
          <Button
            variant="contained"
            disableElevation
            onClick={save}
            disabled={busy || !dirty}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconDeviceFloppy size={16} />}
            sx={waPrimaryBtn}
          >
            Salvar configurações
          </Button>
        </Stack>
      ) : null}

      <TgConfirmDialog
        open={Boolean(delCat)}
        onClose={() => setDelCat(null)}
        onConfirm={() => {
          removeCat(delCat._id);
          setDelCat(null);
        }}
        danger
        title={`Remover a categoria “${delCat?.label || ''}”?`}
        message="Os chamados antigos dessa categoria continuam existindo, mas passam a mostrar o código em vez do nome. Se ela já foi usada, prefira desativar. A remoção só vale depois de salvar."
        confirmLabel="Remover"
        icon={IconTrash}
      />
    </Stack>
  );
}
