import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { IconBrandWhatsapp, IconCheck, IconCopy, IconTrash } from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { get, post, put } from 'api/api';
import { TgCard, TgConfirmDialog, TgStatusPill } from '../telegram/ui';

// Configurações → Pagamentos → "Cobranças do WhatsApp" (Fase 4): qual gateway cobra cada MEIO (PIX, boleto,
// cartão) nas cobranças e assinaturas do WhatsApp, e a chave do Asaas. Webchat, Telegram e o PIX do Fluxo do Bot
// continuam no gateway principal (card de cima). A chave nunca volta crua (só mascarada).
const errMsg = (e, fb) => {
  const m = e?.response?.data?.message ?? e?.message;
  return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};
const PURPOSES = [
  { key: 'pix', label: 'PIX', hint: 'Copia e cola + QR Code.' },
  { key: 'boleto', label: 'Boleto', hint: 'Mercado Pago exige CPF, e-mail e endereço; Asaas só o CPF/CNPJ.' },
  {
    key: 'card',
    label: 'Cartão de crédito',
    hint: 'Só Asaas. O cartão é digitado na página segura do Asaas e fica salvo para as próximas cobranças.'
  }
];
const fmtDate = (v) => {
  if (!v) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v));
  } catch {
    return '';
  }
};

export default function CrmGatewaysCard({ data, onSaved }) {
  const crm = data?.crm;
  const [choice, setChoice] = useState({ pix: crm?.pix || '', boleto: crm?.boleto || '', card: crm?.card || '' });
  const [asaasToken, setAsaasToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  if (!crm) return null;

  const principalLabel = (crm.options || []).find((o) => o.id === data?.provider)?.label || 'gateway principal';
  const asaas = crm.asaas || {};
  const dirty =
    choice.pix !== (crm.pix || '') ||
    choice.boleto !== (crm.boleto || '') ||
    choice.card !== (crm.card || '') ||
    Boolean(asaasToken.trim());

  const applySaved = (s) => {
    setAsaasToken('');
    setChoice({ pix: s.crm?.pix || '', boleto: s.crm?.boleto || '', card: s.crm?.card || '' });
    onSaved?.(s);
  };
  const save = async () => {
    setSaving(true);
    try {
      const body = { crm: { pix: choice.pix || null, boleto: choice.boleto || null, card: choice.card || null } };
      if (asaasToken.trim()) body.crm.asaas_token = asaasToken.trim();
      applySaved(await put('/payments/settings', body));
      toast.success('Gateways das cobranças salvos.');
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao salvar.'));
    } finally {
      setSaving(false);
    }
  };
  // Remover Asaas: só a marca `remove_asaas` (o back zera sozinho as escolhas que apontavam para ele;
  // mandar as escolhas atuais junto dava 400)
  const removeAsaas = async () => {
    setSaving(true);
    try {
      applySaved(await put('/payments/settings', { crm: { remove_asaas: true } }));
      setRemoveOpen(false);
      setTestResult(null);
      toast.success('Asaas removido.');
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao remover o Asaas.'));
    } finally {
      setSaving(false);
    }
  };
  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await post('/payments/settings/test', { provider: 'asaas' });
      setTestResult(r);
      // o teste também (re)cadastra o webhook → recarrega para o card mostrar o estado novo
      if (r?.ok) {
        try {
          onSaved?.(await get('/payments/settings'));
        } catch {
          /* noop: o resultado do teste já está na tela */
        }
      }
    } catch (e) {
      setTestResult({ ok: false, detail: errMsg(e, 'Falha no teste.') });
    } finally {
      setTesting(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asaas.webhook_url || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <TgCard hover={false} sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconBrandWhatsapp size={20} />
          <Typography variant="h5" sx={{ fontWeight: 800, flex: 1 }}>
            Cobranças do WhatsApp
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Escolha qual gateway gera cada meio de pagamento nas cobranças e assinaturas do WhatsApp. Em branco = o gateway principal (
          {principalLabel}). Webchat, Telegram e o PIX do Fluxo do Bot continuam no principal.
        </Typography>

        {/* Asaas */}
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, flex: 1 }}>
                Asaas
              </Typography>
              {asaas.has_token ? (
                <Chip
                  size="small"
                  color={asaas.sandbox ? 'warning' : 'success'}
                  variant="outlined"
                  label={asaas.sandbox ? 'Sandbox (teste)' : 'Produção'}
                />
              ) : null}
              <TgStatusPill status={asaas.has_token ? 'ok' : 'inactive'} label={asaas.has_token ? 'Chave salva' : 'Sem chave'} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              PIX, boleto e cartão (com cartão salvo e parcelamento). O Asaas exige o CPF/CNPJ do cliente em toda cobrança. Chave em Asaas →
              Integrações → Chaves de API.
            </Typography>
            <TextField
              size="small"
              fullWidth
              type="password"
              label="Chave de API do Asaas"
              value={asaasToken}
              onChange={(e) => setAsaasToken(e.target.value)}
              placeholder={asaas.has_token ? `Salva: ${asaas.token_masked} (deixe em branco para manter)` : '$aact_…'}
              helperText="A chave é testada antes de salvar e o webhook é cadastrado sozinho na sua conta do Asaas."
              autoComplete="new-password"
            />
            {asaas.has_token ? (
              <Stack spacing={1}>
                <Alert severity={asaas.webhook_ok ? 'success' : 'warning'} sx={{ py: 0.25 }}>
                  {asaas.webhook_ok
                    ? `Webhook cadastrado no Asaas${asaas.webhook_at ? ` em ${fmtDate(asaas.webhook_at)}` : ''} — confirmações chegam na hora.`
                    : `Webhook não cadastrado${asaas.webhook_error ? `: ${asaas.webhook_error}` : ''}. Clique em "Testar Asaas" para tentar de novo (sem ele, o sistema confere a cada 5 minutos).`}
                </Alert>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    fullWidth
                    value={asaas.webhook_url || ''}
                    InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 12 } }}
                    onFocus={(e) => e.target.select()}
                  />
                  <Tooltip title={copied ? 'Copiado!' : 'Copiar'}>
                    <IconButton onClick={copy} aria-label="Copiar URL do webhook">
                      {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            ) : null}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" onClick={test} disabled={testing || !asaas.has_token} sx={{ borderRadius: 2, fontWeight: 700 }}>
                {testing ? 'Testando…' : 'Testar Asaas'}
              </Button>
              {asaas.has_token ? (
                <Button
                  color="error"
                  startIcon={<IconTrash size={16} />}
                  onClick={() => setRemoveOpen(true)}
                  disabled={saving}
                  sx={{ borderRadius: 2, fontWeight: 700 }}
                >
                  Remover Asaas
                </Button>
              ) : null}
            </Stack>
            {testResult ? (
              <Alert severity={testResult.ok ? 'success' : 'error'} sx={{ py: 0.25 }}>
                {testResult.ok ? `Conexão OK — ${testResult.detail || 'chave válida'}` : `Falhou: ${testResult.detail || 'chave inválida'}`}
              </Alert>
            ) : null}
          </Stack>
        </Box>

        {/* gateway por meio */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(3, minmax(0,1fr))' }, gap: 1.5 }}>
          {PURPOSES.map((p) => {
            const opts = (crm.options || []).filter((o) => o.supports?.[p.key]);
            const eff = crm.effective?.[p.key];
            const effLabel = (crm.options || []).find((o) => o.id === eff)?.label;
            return (
              <Stack key={p.key} spacing={0.75} sx={{ minWidth: 0 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel id={`crm-gw-${p.key}`} shrink>
                    {p.label}
                  </InputLabel>
                  <Select
                    labelId={`crm-gw-${p.key}`}
                    label={p.label}
                    notched
                    displayEmpty
                    value={choice[p.key]}
                    onChange={(e) => setChoice((c) => ({ ...c, [p.key]: e.target.value }))}
                  >
                    <MenuItem value="">{p.key === 'card' ? 'Sem cartão' : `Principal (${principalLabel})`}</MenuItem>
                    {opts.map((o) => (
                      <MenuItem key={o.id} value={o.id} disabled={!o.has_token}>
                        {o.label}
                        {o.has_token ? '' : ' — sem chave'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" color={eff ? 'success.main' : 'text.secondary'} sx={{ fontWeight: 600 }}>
                  {eff ? `Ativo: ${effLabel || eff}` : 'Indisponível'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {p.hint}
                </Typography>
              </Stack>
            );
          })}
        </Box>

        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={save} disabled={saving || !dirty} sx={{ borderRadius: 2, fontWeight: 700 }}>
            {saving ? 'Salvando…' : 'Salvar cobranças do WhatsApp'}
          </Button>
        </Stack>
      </Stack>
      <TgConfirmDialog
        open={removeOpen}
        onClose={() => !saving && setRemoveOpen(false)}
        onConfirm={removeAsaas}
        loading={saving}
        danger
        title="Remover o Asaas?"
        message="A chave é apagada e os meios que usavam o Asaas (PIX, boleto, cartão) voltam para o gateway principal. Cobranças já geradas continuam válidas no Asaas, mas o Pub Mail deixa de confirmá-las sozinho; cartões salvos dos clientes deixam de ser usados."
        confirmLabel="Remover Asaas"
      />
    </TgCard>
  );
}
