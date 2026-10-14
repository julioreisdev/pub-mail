import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { IconDeviceFloppy, IconRestore } from '@tabler/icons-react';

import { get, put } from 'api/api';
import { TgCard, TgListSkeleton } from 'views/pages/telegram/ui';
import { CollapsibleSection, MoneyField, formatBRL, waPrimaryBtn } from '../crm/crmKit';
import { API, DEFAULT_SETTINGS, DEFAULT_TEXTS, TEXT_VARS, orderErr } from './orderKit';

// ============================================================================
// Configurações dos pedidos (dono/admin): ligado/desligado, entrega (taxa, grátis
// a partir de), retirada (endereço), pedido mínimo, formas de pagamento, máximo de
// itens, avisos ao cliente por status e textos com variáveis.
// GET/PUT /whatsapp/orders/settings (PUT parcial; aqui mandamos tudo).
// ============================================================================

const TEXTS = [
  ['created', 'Pedido recebido', 'Vai ao cliente quando a equipe (ou a API) cria o pedido. O bot mostra o resumo dele.'],
  ['paid', 'Pagamento confirmado', 'Quando o PIX do pedido é pago.'],
  ['confirmed', 'Confirmado', ''],
  ['preparing', 'Em preparo', ''],
  ['out_for_delivery', 'Saiu para entrega', ''],
  ['delivered', 'Entregue', ''],
  ['canceled', 'Cancelado', '{{pedido.motivo}} vira " Motivo: …" quando a equipe informa o motivo.']
];
const NOTIFY = [
  ['confirmed', 'Pedido confirmado'],
  ['preparing', 'Em preparo'],
  ['out_for_delivery', 'Saiu para entrega'],
  ['delivered', 'Entregue'],
  ['canceled', 'Cancelado']
];
const METHODS = [
  ['pix', 'PIX', 'Gera a cobrança no gateway da conta (Configurações → Pagamentos) e confirma sozinho quando paga.'],
  ['on_delivery', 'Na entrega', 'Dinheiro ou maquininha ao receber/retirar; vira "pago" ao marcar como entregue.']
];

const toForm = (r) => ({
  ...DEFAULT_SETTINGS,
  ...(r || {}),
  delivery: { ...DEFAULT_SETTINGS.delivery, ...(r?.delivery || {}) },
  pickup: { ...DEFAULT_SETTINGS.pickup, ...(r?.pickup || {}) },
  notify_customer: { ...DEFAULT_SETTINGS.notify_customer, ...(r?.notify_customer || {}) },
  texts: { ...DEFAULT_TEXTS, ...(r?.texts || {}) },
  payment_methods: Array.isArray(r?.payment_methods) ? r.payment_methods : DEFAULT_SETTINGS.payment_methods
});

function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <Stack direction="row" alignItems="flex-start" spacing={1}>
      <Switch size="small" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
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
  );
}

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

export default function OrderSettings({ canEdit, onSaved }) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const textRefs = useRef({});
  const dis = !canEdit;

  useEffect(() => {
    get(`${API}/settings`)
      .then((r) => setS(toForm(r)))
      .catch((e) => {
        toast.error(orderErr(e, 'Não foi possível carregar as configurações.'));
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
  const toggleMethod = (m, on) => {
    setS((x) => {
      const cur = new Set(x.payment_methods || []);
      if (on) cur.add(m);
      else cur.delete(m);
      return { ...x, payment_methods: [...cur] };
    });
    setDirty(true);
  };

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
    if (!s.delivery.enabled && !s.pickup.enabled) return toast.error('Deixe ao menos entrega ou retirada ligada.');
    if (!(s.payment_methods || []).some((m) => m === 'pix' || m === 'on_delivery'))
      return toast.error('Escolha ao menos uma forma de pagamento.');
    setBusy(true);
    try {
      const maxItems = Math.min(100, Math.max(1, parseInt(String(s.max_items), 10) || 30));
      const pixMinutes = Math.min(1440, Math.max(5, parseInt(String(s.pix_minutes), 10) || 60));
      const body = {
        enabled: Boolean(s.enabled),
        delivery: {
          enabled: Boolean(s.delivery.enabled),
          fee_cents: Number(s.delivery.fee_cents) || 0,
          free_from_cents: Number(s.delivery.free_from_cents) || 0
        },
        pickup: { enabled: Boolean(s.pickup.enabled), address: String(s.pickup.address || '').slice(0, 255) },
        min_order_cents: Number(s.min_order_cents) || 0,
        payment_methods: s.payment_methods,
        max_items: maxItems,
        pix_minutes: pixMinutes,
        notify_customer: s.notify_customer,
        texts: Object.fromEntries(Object.keys(DEFAULT_TEXTS).map((k) => [k, String(s.texts?.[k] || '').slice(0, 1500)]))
      };
      const r = await put(`${API}/settings`, body);
      setS(toForm(r));
      setDirty(false);
      onSaved?.(r);
      toast.success('Configurações dos pedidos salvas.');
    } catch (e) {
      toast.error(orderErr(e, 'Não foi possível salvar.'));
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

  return (
    <Stack spacing={2}>
      <TgCard hover={false} sx={{ p: 2 }}>
        <Toggle
          checked={s.enabled}
          onChange={(v) => set('enabled', v)}
          disabled={dis}
          label="Pedidos ligados"
          hint="Desligado: o bot não aceita pedidos e o painel/API não criam novos (os existentes continuam)."
        />
      </TgCard>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2, minmax(0,1fr))' } }}>
        <TgCard hover={false} sx={{ p: 2 }}>
          {cardTitle('Entrega', 'Taxa somada ao pedido quando o cliente escolhe entrega.')}
          <Stack spacing={1.5}>
            <Toggle checked={s.delivery.enabled} onChange={(v) => setIn('delivery', 'enabled', v)} disabled={dis} label="Fazer entregas" />
            <MoneyField
              label="Taxa de entrega"
              valueCents={s.delivery.fee_cents}
              onChange={(v) => setIn('delivery', 'fee_cents', v)}
              disabled={dis || !s.delivery.enabled}
              helperText={s.delivery.fee_cents ? ' ' : 'Em branco = entrega grátis'}
            />
            <MoneyField
              label="Entrega grátis a partir de"
              valueCents={s.delivery.free_from_cents}
              onChange={(v) => setIn('delivery', 'free_from_cents', v)}
              disabled={dis || !s.delivery.enabled}
              helperText={
                s.delivery.free_from_cents
                  ? `Pedidos de ${formatBRL(s.delivery.free_from_cents)} ou mais não pagam taxa.`
                  : 'Em branco = sempre cobra a taxa'
              }
            />
          </Stack>
        </TgCard>

        <TgCard hover={false} sx={{ p: 2 }}>
          {cardTitle('Retirada', 'O cliente busca no local.')}
          <Stack spacing={1.5}>
            <Toggle checked={s.pickup.enabled} onChange={(v) => setIn('pickup', 'enabled', v)} disabled={dis} label="Aceitar retirada" />
            <TextField
              size="small"
              label="Endereço de retirada"
              value={s.pickup.address || ''}
              onChange={(e) => setIn('pickup', 'address', e.target.value.slice(0, 255))}
              disabled={dis || !s.pickup.enabled}
              fullWidth
              multiline
              minRows={2}
              helperText="Aparece no resumo do pedido ({{pedido.entrega}})."
            />
          </Stack>
        </TgCard>

        <TgCard hover={false} sx={{ p: 2 }}>
          {cardTitle('Pagamento', 'Formas aceitas no bot e no painel (no painel também dá para criar "sem cobrança").')}
          <Stack spacing={1.25}>
            {METHODS.map(([m, label, hint]) => (
              <Toggle
                key={m}
                checked={(s.payment_methods || []).includes(m)}
                onChange={(v) => toggleMethod(m, v)}
                disabled={dis}
                label={label}
                hint={hint}
              />
            ))}
          </Stack>
        </TgCard>

        <TgCard hover={false} sx={{ p: 2 }}>
          {cardTitle('Limites')}
          <Stack spacing={1.5}>
            <MoneyField
              label="Pedido mínimo"
              valueCents={s.min_order_cents}
              onChange={(v) => set('min_order_cents', v)}
              disabled={dis}
              helperText="Sobre o subtotal (sem a taxa de entrega). Em branco = sem mínimo."
            />
            <TextField
              size="small"
              type="number"
              label="Máximo de itens diferentes"
              value={s.max_items}
              onChange={(e) => set('max_items', e.target.value)}
              disabled={dis}
              inputProps={{ min: 1, max: 100 }}
              helperText="Produtos distintos por pedido (1 a 100)."
            />
            <TextField
              size="small"
              type="number"
              label="Validade do PIX do pedido (minutos)"
              value={s.pix_minutes}
              onChange={(e) => set('pix_minutes', e.target.value)}
              disabled={dis}
              inputProps={{ min: 5, max: 1440 }}
              helperText="Depois disso o PIX vence e o pedido não pago é cancelado (5 a 1440; padrão 60)."
            />
          </Stack>
        </TgCard>
      </Box>

      <TgCard hover={false} sx={{ p: 2 }}>
        {cardTitle('Avisos ao cliente pelo WhatsApp', 'Quando a equipe muda o status. Saem pela fila do número da conversa, com ritmo.')}
        <Box
          sx={{
            display: 'grid',
            gap: 1.25,
            gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(3, minmax(0,1fr))' }
          }}
        >
          {NOTIFY.map(([k, label]) => (
            <Toggle
              key={k}
              checked={s.notify_customer?.[k] !== false}
              onChange={(v) => setIn('notify_customer', k, v)}
              disabled={dis}
              label={label}
            />
          ))}
        </Box>
      </TgCard>

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
    </Stack>
  );
}
