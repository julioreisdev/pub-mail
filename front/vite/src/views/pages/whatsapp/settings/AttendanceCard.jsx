import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  MenuItem,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import {
  IconCheck,
  IconClockHour4,
  IconEye,
  IconHeadset,
  IconInfoCircle,
  IconRefresh,
  IconSignature,
  IconUserCheck,
  IconUsersGroup,
  IconMoodSmile,
  IconHandStop
} from '@tabler/icons-react';

import { get, put } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgCard } from 'views/pages/telegram/ui';
import { waButtonSx } from '../waKit';
import {
  ReadOnlyChip,
  SettingsCardHeader,
  WaBubble,
  WaWallpaper,
  WA_DARK,
  cardSx,
  errText,
  insertAtCursor,
  warnTextSx
} from './settingsKit';

// ============================================================================
// Card "Atendimento": janela de encerramento automático, assinatura do
// atendente (com preview do balão), auto-atribuição e "marcar como lida".
// GET/PUT /whatsapp/service-settings (PUT parcial, só dono/admin).
// ============================================================================

const RESET_OPTIONS = [
  { value: 1, label: '1 hora' },
  { value: 2, label: '2 horas' },
  { value: 4, label: '4 horas' },
  { value: 8, label: '8 horas' },
  { value: 12, label: '12 horas' },
  { value: 24, label: '24 horas' },
  { value: 48, label: '48 horas' },
  { value: 72, label: '72 horas' },
  { value: 168, label: '7 dias' }
];
const resetLabel = (h) => RESET_OPTIONS.find((o) => o.value === h)?.label || `${h} horas`;

const DEFAULT_TEMPLATE = '*{nome}:*';
const TEMPLATE_MAX = 60;
const TEMPLATE_PRESETS = ['*{nome}:*', '*{primeiro_nome}*', '_{nome} · Atendimento_'];
const SAMPLE_MESSAGE = 'Olá! Tudo bem? Já estou verificando o seu pedido.';

const normalize = (s) => ({
  reset_hours: Number(s?.reset_hours) || 24,
  signature: { enabled: Boolean(s?.signature?.enabled), template: String(s?.signature?.template ?? DEFAULT_TEMPLATE) },
  auto_assign_on_reply: s?.auto_assign_on_reply !== false,
  mark_read_on_open: s?.mark_read_on_open !== false,
  distribution: ['off', 'round_robin', 'least_busy'].includes(s?.distribution) ? s.distribution : 'off',
  rating: {
    enabled: Boolean(s?.rating?.enabled),
    question: String(s?.rating?.question || ''),
    thanks: String(s?.rating?.thanks ?? ''),
    hours: Number(s?.rating?.hours) || 24
  },
  optout: {
    enabled: s?.optout?.enabled !== false,
    keywords: Array.isArray(s?.optout?.keywords) ? s.optout.keywords.join(', ') : '',
    reply: String(s?.optout?.reply ?? '')
  }
});
const DISTRIBUTION_OPTIONS = [
  { value: 'off', label: 'Desligada — a fila fica visível para todos', hint: '' },
  { value: 'round_robin', label: 'Rodízio — cada conversa nova vai para o próximo atendente online', hint: '' },
  { value: 'least_busy', label: 'Menos ocupado — vai para quem tem menos conversas em andamento', hint: '' }
];

function OptionRow({ icon: Icon, title, description, checked, onChange, disabled, children }) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: checked ? 'rgba(37,211,102,0.45)' : 'divider',
        borderRadius: 2.5,
        transition: 'border-color .15s ease'
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ p: 1.5 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.75,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            color: checked ? WA_DARK : 'text.secondary',
            bgcolor: checked ? 'rgba(37,211,102,0.14)' : 'action.hover',
            transition: 'all .15s ease'
          }}
        >
          <Icon size={18} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.45 }}>
            {description}
          </Typography>
        </Box>
        <Switch
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          color="success"
          slotProps={{ input: { 'aria-label': title } }}
          sx={{ mt: -0.5, mr: -1 }}
        />
      </Stack>
      {children ? (
        <Collapse in={checked} unmountOnExit>
          <Box sx={{ px: 1.5, pb: 1.5 }}>{children}</Box>
        </Collapse>
      ) : null}
    </Box>
  );
}

export default function AttendanceCard({ canEdit }) {
  const { user } = useAuth();
  const myName = String(user?.user?.name || '').trim() || 'Ana Souza';
  const myFirst = myName.split(/\s+/)[0];

  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const templateRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const s = normalize(await get('/whatsapp/service-settings'));
      setData(s);
      setForm(s);
    } catch (e) {
      setError(errText(e, 'Não foi possível carregar as configurações de atendimento.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!data || !form) return false;
    return (
      data.reset_hours !== form.reset_hours ||
      data.signature.enabled !== form.signature.enabled ||
      data.signature.template !== form.signature.template ||
      data.auto_assign_on_reply !== form.auto_assign_on_reply ||
      data.mark_read_on_open !== form.mark_read_on_open ||
      data.distribution !== form.distribution ||
      JSON.stringify(data.rating) !== JSON.stringify(form.rating) ||
      JSON.stringify(data.optout) !== JSON.stringify(form.optout)
    );
  }, [data, form]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setSig = (patch) => setForm((f) => ({ ...f, signature: { ...f.signature, ...patch } }));

  const save = async () => {
    if (!dirty) return;
    const body = {};
    if (form.reset_hours !== data.reset_hours) body.reset_hours = form.reset_hours;
    if (form.signature.enabled !== data.signature.enabled || form.signature.template !== data.signature.template) {
      body.signature = { enabled: form.signature.enabled, template: form.signature.template.trim() || DEFAULT_TEMPLATE };
    }
    if (form.auto_assign_on_reply !== data.auto_assign_on_reply) body.auto_assign_on_reply = form.auto_assign_on_reply;
    if (form.mark_read_on_open !== data.mark_read_on_open) body.mark_read_on_open = form.mark_read_on_open;
    if (form.distribution !== data.distribution) body.distribution = form.distribution;
    if (JSON.stringify(form.rating) !== JSON.stringify(data.rating))
      body.rating = { ...form.rating, hours: Number(form.rating.hours) || 24 };
    if (JSON.stringify(form.optout) !== JSON.stringify(data.optout))
      body.optout = {
        enabled: form.optout.enabled,
        reply: form.optout.reply,
        keywords: form.optout.keywords
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      };
    setSaving(true);
    try {
      const s = normalize(await put('/whatsapp/service-settings', body));
      setData(s);
      setForm(s);
      toast.success('Configurações de atendimento salvas.');
    } catch (e) {
      toast.error(errText(e, 'Não foi possível salvar.'));
    } finally {
      setSaving(false);
    }
  };

  const insertVar = (v) => {
    const next = insertAtCursor(templateRef.current, form.signature.template, v, TEMPLATE_MAX);
    setSig({ template: next });
  };

  const readOnly = !canEdit;
  const tpl = form?.signature?.template ?? '';
  const signatureLine = (tpl.trim() || DEFAULT_TEMPLATE).replace(/\{nome\}/g, myName).replace(/\{primeiro_nome\}/g, myFirst);
  const previewText = form?.signature?.enabled ? `${signatureLine}\n${SAMPLE_MESSAGE}` : SAMPLE_MESSAGE;

  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconHeadset}
        title="Atendimento"
        subtitle="Como a equipe atende as conversas no painel"
        action={readOnly && !loading && !error ? <ReadOnlyChip /> : null}
      />

      {loading ? (
        <Stack spacing={1.5}>
          <Skeleton variant="rounded" height={40} />
          <Skeleton variant="rounded" height={58} />
          <Skeleton variant="rounded" height={64} />
          <Skeleton variant="rounded" height={64} />
          <Skeleton variant="rounded" height={64} />
        </Stack>
      ) : error ? (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<IconRefresh size={16} />}
              onClick={load}
              sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Tentar de novo
            </Button>
          }
        >
          {error}
        </Alert>
      ) : (
        <Stack spacing={1.5} sx={{ flex: 1 }}>
          <TextField
            select
            size="small"
            label="Encerrar atendimento parado após"
            value={form.reset_hours}
            onChange={(e) => set({ reset_hours: Number(e.target.value) })}
            disabled={readOnly}
            fullWidth
            InputProps={{ startAdornment: <IconClockHour4 size={18} style={{ marginRight: 8, opacity: 0.6, flexShrink: 0 }} /> }}
          >
            {(RESET_OPTIONS.some((o) => o.value === form.reset_hours)
              ? RESET_OPTIONS
              : [...RESET_OPTIONS, { value: form.reset_hours, label: resetLabel(form.reset_hours) }].sort((a, b) => a.value - b.value)
            ).map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>

          <Stack
            direction="row"
            spacing={1}
            alignItems="flex-start"
            sx={{
              p: 1.25,
              borderRadius: 2,
              bgcolor: (t) => `rgba(${t.vars.palette.info.mainChannel} / 0.08)`,
              color: 'text.secondary'
            }}
          >
            <IconInfoCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <Typography variant="caption" sx={{ lineHeight: 1.5 }}>
              Quando a conversa está com um atendente (ou na fila) e passa <strong>{resetLabel(form.reset_hours)}</strong> sem nenhuma
              interação da equipe, o atendimento é encerrado sozinho e a próxima mensagem do cliente volta para o bot.
            </Typography>
          </Stack>

          <OptionRow
            icon={IconSignature}
            title="Assinatura do atendente nas mensagens"
            description="Coloca o nome de quem está respondendo no início de cada mensagem enviada pelo painel."
            checked={form.signature.enabled}
            onChange={(v) => setSig({ enabled: v })}
            disabled={readOnly}
          >
            <Stack spacing={1.25}>
              <TextField
                size="small"
                label="Modelo da assinatura"
                value={tpl}
                inputRef={templateRef}
                onChange={(e) => setSig({ template: e.target.value.slice(0, TEMPLATE_MAX) })}
                disabled={readOnly}
                fullWidth
                placeholder={DEFAULT_TEMPLATE}
                helperText={`Vazio usa o padrão ${DEFAULT_TEMPLATE} · ${tpl.length}/${TEMPLATE_MAX}`}
                inputProps={{ style: { fontFamily: 'ui-monospace, Menlo, monospace' } }}
              />
              {!readOnly ? (
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mr: 0.25 }}>
                    Inserir:
                  </Typography>
                  <Chip
                    size="small"
                    label="{nome}"
                    onClick={() => insertVar('{nome}')}
                    sx={{ fontWeight: 700, fontFamily: 'ui-monospace, Menlo, monospace' }}
                  />
                  <Chip
                    size="small"
                    label="{primeiro_nome}"
                    onClick={() => insertVar('{primeiro_nome}')}
                    sx={{ fontWeight: 700, fontFamily: 'ui-monospace, Menlo, monospace' }}
                  />
                  <Box sx={{ width: 8 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mr: 0.25 }}>
                    Modelos:
                  </Typography>
                  {TEMPLATE_PRESETS.map((p) => (
                    <Chip
                      key={p}
                      size="small"
                      variant={tpl === p ? 'filled' : 'outlined'}
                      label={p}
                      onClick={() => setSig({ template: p })}
                      sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5 }}
                    />
                  ))}
                </Stack>
              ) : null}
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.75 }}>
                  Como o cliente vê
                </Typography>
                <WaWallpaper>
                  <Stack>
                    <WaBubble text={previewText} maxWidth="92%" />
                  </Stack>
                </WaWallpaper>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
                  *texto* fica em negrito e _texto_ em itálico, como no WhatsApp.
                </Typography>
              </Box>
            </Stack>
          </OptionRow>

          <OptionRow
            icon={IconUserCheck}
            title="Quem responde assume a conversa"
            description="Ao responder uma conversa livre, do bot ou da fila, o atendente vira o responsável por ela automaticamente."
            checked={form.auto_assign_on_reply}
            onChange={(v) => set({ auto_assign_on_reply: v })}
            disabled={readOnly}
          />

          <OptionRow
            icon={IconEye}
            title="Marcar como lida ao abrir"
            description="Abrir a conversa no Pub Mail marca as mensagens como lidas também no WhatsApp."
            checked={form.mark_read_on_open}
            onChange={(v) => set({ mark_read_on_open: v })}
            disabled={readOnly}
          />

          <TextField
            select
            size="small"
            label="Distribuição automática da fila"
            value={form.distribution}
            onChange={(e) => set({ distribution: e.target.value })}
            disabled={readOnly}
            fullWidth
            helperText="Online = quem está com o Pub Mail aberto no módulo WhatsApp. Sem ninguém online, a conversa espera na fila e é distribuída assim que alguém entrar."
            InputProps={{ startAdornment: <IconUsersGroup size={18} style={{ marginRight: 8, opacity: 0.6, flexShrink: 0 }} /> }}
          >
            {DISTRIBUTION_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>

          <OptionRow
            icon={IconMoodSmile}
            title="Pesquisa de satisfação ao encerrar"
            description="Quando um atendente encerra o atendimento, o cliente recebe a pergunta e a resposta (1 a 5) vira nota nas Métricas."
            checked={form.rating.enabled}
            onChange={(v) => set({ rating: { ...form.rating, enabled: v } })}
            disabled={readOnly}
          >
            <Stack spacing={1.25}>
              <TextField
                size="small"
                label="Pergunta"
                value={form.rating.question}
                onChange={(e) => set({ rating: { ...form.rating, question: e.target.value.slice(0, 500) } })}
                disabled={readOnly}
                fullWidth
                multiline
                minRows={2}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <TextField
                  size="small"
                  label="Agradecimento (vazio = não responde)"
                  value={form.rating.thanks}
                  onChange={(e) => set({ rating: { ...form.rating, thanks: e.target.value.slice(0, 300) } })}
                  disabled={readOnly}
                  fullWidth
                />
                <TextField
                  size="small"
                  type="number"
                  label="Vale por (horas)"
                  value={form.rating.hours}
                  onChange={(e) =>
                    set({ rating: { ...form.rating, hours: Math.min(72, Math.max(1, parseInt(e.target.value || '1', 10) || 1)) } })
                  }
                  disabled={readOnly}
                  sx={{ width: { sm: 160 }, flexShrink: 0 }}
                  inputProps={{ min: 1, max: 72 }}
                />
              </Stack>
            </Stack>
          </OptionRow>

          <OptionRow
            icon={IconHandStop}
            title="Descadastro por palavra (LGPD)"
            description="Se o contato mandar só a palavra de saída, ele é marcado como descadastrado, recebe a confirmação e sai dos disparos em massa. Reverter em Contatos."
            checked={form.optout.enabled}
            onChange={(v) => set({ optout: { ...form.optout, enabled: v } })}
            disabled={readOnly}
          >
            <Stack spacing={1.25}>
              <TextField
                size="small"
                label="Palavras (separe por vírgula)"
                value={form.optout.keywords}
                onChange={(e) => set({ optout: { ...form.optout, keywords: e.target.value } })}
                disabled={readOnly}
                fullWidth
                placeholder="PARE, SAIR, CANCELAR"
                helperText="Sem diferença de maiúsculas/acentos. A mensagem precisa ser só a palavra."
              />
              <TextField
                size="small"
                label="Confirmação enviada ao contato (vazio = não responde)"
                value={form.optout.reply}
                onChange={(e) => set({ optout: { ...form.optout, reply: e.target.value.slice(0, 500) } })}
                disabled={readOnly}
                fullWidth
                multiline
                minRows={2}
              />
            </Stack>
          </OptionRow>

          <Box sx={{ flex: 1 }} />
          {readOnly ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Só o dono ou um admin da organização altera estas opções.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" flexWrap="wrap" useFlexGap>
              {dirty ? (
                <Typography variant="caption" sx={[{ fontWeight: 700, mr: 'auto' }, warnTextSx]}>
                  Alterações não salvas
                </Typography>
              ) : null}
              {dirty ? (
                <Button onClick={() => setForm(data)} disabled={saving} color="inherit" sx={{ fontWeight: 600 }}>
                  Descartar
                </Button>
              ) : null}
              <Button
                variant="contained"
                disableElevation
                onClick={save}
                disabled={!dirty || saving}
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <IconCheck size={18} />}
                sx={waButtonSx}
              >
                Salvar atendimento
              </Button>
            </Stack>
          )}
        </Stack>
      )}
    </TgCard>
  );
}
