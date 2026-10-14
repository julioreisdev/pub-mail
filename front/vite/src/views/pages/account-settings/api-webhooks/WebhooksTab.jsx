import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconCheck,
  IconDotsVertical,
  IconKey,
  IconMessage,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconTruckDelivery,
  IconWebhook
} from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { TgCard, TgConfirmDialog, TgEmptyState, TgListSkeleton, TgStatusPill } from 'views/pages/telegram/ui';
import { CrmModal } from 'views/pages/whatsapp/crm/crmKit';
import DeliveriesDialog from './DeliveriesDialog';
import { EVENT_GROUPS, MESSAGE_EVENT, SecretBox, errMsg, eventLabel, fmtDT, monoSx } from './apiKit';

// ============================================================================
// Aba "Webhooks": o Pub Mail avisa o SEU sistema quando algo acontece (assinatura
// paga, cobrança vencida, acesso liberado…). /org/webhooks (dono/admin).
// O segredo inteiro só volta ao criar e ao girar.
// ============================================================================

const MAX_WEBHOOKS = 10;
const isHttps = (u) => {
  try {
    const x = new URL(String(u || '').trim());
    return x.protocol === 'https:' && Boolean(x.hostname);
  } catch {
    return false;
  }
};

/** Webhook (do back) → formulário. */
const formFrom = (w) => {
  const ev = Array.isArray(w?.events) ? w.events : [];
  return {
    id: w?.id,
    name: w?.name || '',
    url: w?.url || '',
    all: ev.includes('*'),
    events: ev.filter((e) => e !== '*' && e !== MESSAGE_EVENT),
    message: ev.includes(MESSAGE_EVENT)
  };
};
const eventsOf = (f) => [...(f.all ? ['*'] : f.events), ...(f.message ? [MESSAGE_EVENT] : [])];

function EventsSummary({ events }) {
  const ev = Array.isArray(events) ? events : [];
  const all = ev.includes('*');
  const msg = ev.includes(MESSAGE_EVENT);
  const rest = ev.filter((e) => e !== '*' && e !== MESSAGE_EVENT);
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {all ? (
        <Chip size="small" label="Todos os eventos" sx={{ height: 22, fontWeight: 700, borderRadius: 1.5 }} />
      ) : rest.length ? (
        <Tooltip title={rest.map(eventLabel).join(' · ')}>
          <Chip
            size="small"
            label={`${rest.length} evento${rest.length === 1 ? '' : 's'}`}
            sx={{ height: 22, fontWeight: 700, borderRadius: 1.5 }}
          />
        </Tooltip>
      ) : null}
      {msg ? (
        <Chip
          size="small"
          icon={<IconMessage size={12} />}
          label="Mensagens recebidas"
          variant="outlined"
          sx={{ height: 22, fontWeight: 600, borderRadius: 1.5 }}
        />
      ) : null}
      {!all && !rest.length && !msg ? (
        <Typography variant="caption" sx={{ color: 'warning.main' }}>
          Nenhum evento marcado
        </Typography>
      ) : null}
    </Stack>
  );
}

function EventsPicker({ f, set }) {
  const toggle = (v) => set({ events: f.events.includes(v) ? f.events.filter((x) => x !== v) : [...f.events, v] });
  const toggleGroup = (g, on) => {
    const vals = g.events.map((e) => e.value);
    set({ events: on ? [...new Set([...f.events, ...vals])] : f.events.filter((x) => !vals.includes(x)) });
  };
  return (
    <Stack spacing={1}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        Eventos
      </Typography>
      <FormControlLabel
        control={<Switch checked={f.all} onChange={(e) => set({ all: e.target.checked })} />}
        label={
          <span>
            <strong>Todos</strong> (exceto mensagens recebidas)
            <Typography component="span" variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Inclui eventos novos que o Pub Mail lançar depois.
            </Typography>
          </span>
        }
      />
      {!f.all ? (
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
          {EVENT_GROUPS.map((g) => {
            const vals = g.events.map((e) => e.value);
            const n = vals.filter((v) => f.events.includes(v)).length;
            return (
              <Box key={g.label} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 0 }}>
                <FormControlLabel
                  sx={{ mr: 0 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={n === vals.length}
                      indeterminate={n > 0 && n < vals.length}
                      onChange={(e) => toggleGroup(g, e.target.checked)}
                    />
                  }
                  label={<Typography sx={{ fontWeight: 800, fontSize: 13.5 }}>{g.label}</Typography>}
                />
                <Box sx={{ pl: 2 }}>
                  {g.events.map((e) => (
                    <FormControlLabel
                      key={e.value}
                      sx={{ display: 'flex', mr: 0, '& .MuiFormControlLabel-label': { fontSize: 13, minWidth: 0 } }}
                      control={<Checkbox size="small" checked={f.events.includes(e.value)} onChange={() => toggle(e.value)} />}
                      label={
                        <span>
                          {e.label}{' '}
                          <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ...monoSx }}>
                            {e.value}
                          </Typography>
                        </span>
                      }
                    />
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : null}
      <Box sx={{ p: 1.25, border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
        <FormControlLabel
          sx={{ mr: 0 }}
          control={<Checkbox size="small" checked={f.message} onChange={(e) => set({ message: e.target.checked })} />}
          label={
            <span>
              <strong>Mensagens recebidas</strong>{' '}
              <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ...monoSx }}>
                {MESSAGE_EVENT}
              </Typography>
            </span>
          }
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', pl: 4 }}>
          Cada mensagem de texto que chega numa conversa individual (nunca de quem pediu para sair). Pode ser muito volume — marque só se o
          seu sistema precisa.
        </Typography>
      </Box>
    </Stack>
  );
}

function TestResult({ r }) {
  if (!r) return null;
  if (r.loading)
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <CircularProgress size={12} /> Enviando o evento de teste (ping)…
      </Typography>
    );
  return (
    <Alert severity={r.ok ? 'success' : 'error'} sx={{ borderRadius: 2, py: 0.25 }}>
      {r.ok ? 'O seu servidor respondeu' : 'Falhou'}
      {r.status ? ` · HTTP ${r.status}` : ''}
      {r.duration_ms != null ? ` · ${r.duration_ms} ms` : ''}
      {r.error ? ` · ${r.error}` : ''}
    </Alert>
  );
}

function WebhookCard({ w, onEdit, onToggle, onTest, onDeliveries, onRotate, onRemove, test, busy }) {
  const [menu, setMenu] = useState(null);
  const active = w.active !== false;
  return (
    <TgCard hover={false} sx={{ p: 1.75, minWidth: 0, opacity: active ? 1 : 0.8 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', flexShrink: 0, bgcolor: 'action.selected' }}
        >
          <IconWebhook size={18} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography sx={{ fontWeight: 800, minWidth: 0 }} noWrap title={w.name}>
              {w.name}
            </Typography>
            <TgStatusPill status={active ? 'active' : 'inactive'} label={active ? 'Ativo' : 'Desativado'} />
            {w.failures > 0 ? (
              <Tooltip title="Entregas que falharam em sequência. Com 20, o webhook é desativado sozinho.">
                <span>
                  <TgStatusPill
                    status="pending"
                    label={`${w.failures} falha${w.failures === 1 ? '' : 's'} seguida${w.failures === 1 ? '' : 's'}`}
                  />
                </span>
              </Tooltip>
            ) : null}
          </Stack>
          <Typography variant="body2" sx={{ ...monoSx, color: 'text.secondary', mt: 0.25 }} noWrap title={w.url}>
            {w.url}
          </Typography>
          <Box sx={{ mt: 0.75 }}>
            <EventsSummary events={w.events} />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
            {w.last_delivery_at
              ? `Última entrega ${fmtDT(w.last_delivery_at)}${w.last_status ? ` · HTTP ${w.last_status}` : ''}`
              : 'Nenhuma entrega ainda'}
            {w.secret_masked || w.secret ? ` · segredo ${w.secret_masked || w.secret}` : ''}
          </Typography>
          {w.last_error ? (
            <Typography
              variant="caption"
              sx={{ color: active ? 'warning.main' : 'error.main', display: 'block', overflowWrap: 'anywhere' }}
            >
              {w.last_error}
            </Typography>
          ) : null}
          <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="outlined"
              onClick={onTest}
              disabled={busy || test?.loading}
              startIcon={<IconPlayerPlay size={15} />}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Testar
            </Button>
            <Button
              size="small"
              onClick={onDeliveries}
              startIcon={<IconTruckDelivery size={15} />}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Entregas
            </Button>
          </Stack>
          {test ? (
            <Box sx={{ mt: 1 }}>
              <TestResult r={test} />
            </Box>
          ) : null}
        </Box>
        <Stack direction="row" spacing={0.25} alignItems="center">
          <Tooltip title={active ? 'Desativar' : 'Ativar'}>
            <Switch size="small" checked={active} onChange={(e) => onToggle(e.target.checked)} disabled={busy} />
          </Tooltip>
          <IconButton size="small" onClick={(e) => setMenu(e.currentTarget)} aria-label="Mais ações">
            <IconDotsVertical size={17} />
          </IconButton>
        </Stack>
      </Stack>
      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            setMenu(null);
            onEdit();
          }}
        >
          <ListItemIcon>
            <IconPencil size={16} />
          </ListItemIcon>
          Editar
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null);
            onRotate();
          }}
        >
          <ListItemIcon>
            <IconKey size={16} />
          </ListItemIcon>
          Girar segredo
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null);
            onRemove();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'error.main' }}>
            <IconTrash size={16} />
          </ListItemIcon>
          Excluir
        </MenuItem>
      </Menu>
    </TgCard>
  );
}

export default function WebhooksTab({ canManage }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [dlg, setDlg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState(null); // {title, value}
  const [confirm, setConfirm] = useState(null); // {kind:'delete'|'rotate', w}
  const [tests, setTests] = useState({}); // id → {loading} | {ok, status, duration_ms, error}
  const [deliveries, setDeliveries] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const s = ++seq.current;
    try {
      const r = await get('/org/webhooks');
      if (s !== seq.current) return;
      setItems(Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : []);
      setError('');
    } catch (e) {
      if (s !== seq.current) return;
      setError(errMsg(e, 'Não foi possível carregar os webhooks.'));
      setItems((p) => p || []);
    }
  }, []);
  useEffect(() => {
    if (canManage) load();
  }, [canManage, load]);

  if (!canManage) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2.5, maxWidth: 760 }}>
        Só o dono ou um admin da organização configura webhooks. A aba <strong>Documentação</strong> mostra o formato dos eventos.
      </Alert>
    );
  }

  const set = (p) => setDlg((d) => ({ ...d, ...p }));

  const save = async () => {
    const name = dlg.name.trim();
    const url = dlg.url.trim();
    if (!name) return toast.error('Dê um nome ao webhook.');
    if (!isHttps(url)) return toast.error('Use um endereço https:// (ex.: https://seusistema.com/webhooks/pubmail).');
    const events = eventsOf(dlg);
    if (!events.length) return toast.error('Marque pelo menos um evento.');
    setBusy(true);
    try {
      if (dlg.id) {
        await put(`/org/webhooks/${dlg.id}`, { name: name.slice(0, 80), url, events });
        toast.success('Webhook salvo.');
      } else {
        const r = await post('/org/webhooks', { name: name.slice(0, 80), url, events });
        if (r?.secret) setSecret({ title: 'Webhook criado', name, value: r.secret });
        else toast.success('Webhook criado.');
      }
      setDlg(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar o webhook.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const toggle = async (w, active) => {
    setItems((xs) => xs.map((x) => (x.id === w.id ? { ...x, active } : x)));
    try {
      const r = await put(`/org/webhooks/${w.id}`, { active });
      if (r?.id) setItems((xs) => xs.map((x) => (x.id === w.id ? r : x)));
      toast.success(active ? 'Webhook ativado.' : 'Webhook desativado.');
    } catch (e) {
      setItems((xs) => xs.map((x) => (x.id === w.id ? { ...x, active: !active } : x)));
      toast.error(errMsg(e, 'Não foi possível atualizar.'));
    }
  };

  const test = async (w) => {
    setTests((t) => ({ ...t, [w.id]: { loading: true } }));
    try {
      const r = await post(`/org/webhooks/${w.id}/test`, {});
      setTests((t) => ({ ...t, [w.id]: r || { ok: false, error: 'Sem resposta.' } }));
      load();
    } catch (e) {
      setTests((t) => ({ ...t, [w.id]: { ok: false, error: errMsg(e, 'Falha no teste.') } }));
    }
  };

  const doConfirm = async () => {
    const { kind, w } = confirm;
    setBusy(true);
    try {
      if (kind === 'delete') {
        await remove(`/org/webhooks/${w.id}`);
        toast.success('Webhook excluído.');
      } else {
        const r = await post(`/org/webhooks/${w.id}/rotate-secret`, {});
        if (r?.secret) setSecret({ title: 'Novo segredo', name: w.name, value: r.secret });
        else toast.success('Segredo trocado.');
      }
      setConfirm(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, kind === 'delete' ? 'Não foi possível excluir.' : 'Não foi possível trocar o segredo.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 960 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
          O Pub Mail chama o endereço do seu sistema quando algo acontece (assinatura paga, cobrança vencida, acesso liberado…). Cada
          chamada é assinada com o segredo do webhook.
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Atualizar">
            <IconButton onClick={load} aria-label="Atualizar webhooks">
              <IconRefresh size={18} />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            disableElevation
            startIcon={<IconPlus size={18} />}
            disabled={(items || []).length >= MAX_WEBHOOKS}
            onClick={() => setDlg({ ...formFrom(null), all: true })}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, flex: { xs: 1, sm: 'none' } }}
          >
            Novo webhook
          </Button>
        </Stack>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      ) : null}

      {items === null ? (
        <TgListSkeleton rows={3} />
      ) : !items.length ? (
        <TgEmptyState
          icon={IconWebhook}
          title="Nenhum webhook"
          description="Cadastre o endereço do seu sistema para receber os eventos de clientes, assinaturas, cobranças e acessos na hora em que acontecem."
          dense
        />
      ) : (
        <Stack spacing={1}>
          {items.map((w) => (
            <WebhookCard
              key={w.id}
              w={w}
              busy={busy}
              test={tests[w.id]}
              onEdit={() => setDlg(formFrom(w))}
              onToggle={(v) => toggle(w, v)}
              onTest={() => test(w)}
              onDeliveries={() => setDeliveries(w)}
              onRotate={() => setConfirm({ kind: 'rotate', w })}
              onRemove={() => setConfirm({ kind: 'delete', w })}
            />
          ))}
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {items.length} de {MAX_WEBHOOKS} webhooks. Falhou? O Pub Mail tenta de novo em 1 min, 5 min, 30 min, 2 h e 6 h; com 100
            tentativas seguidas falhando (ou 24 h sem nenhuma entrega certa) o webhook é desativado.
          </Typography>
        </Stack>
      )}

      <CrmModal
        open={Boolean(dlg)}
        onClose={() => !busy && setDlg(null)}
        title={dlg?.id ? 'Editar webhook' : 'Novo webhook'}
        subtitle={
          dlg?.id ? 'O segredo continua o mesmo.' : 'O segredo para conferir a assinatura aparece uma única vez, logo depois de criar.'
        }
        maxWidth="md"
        disableClose={busy}
        footer={
          <>
            <Button color="inherit" onClick={() => setDlg(null)} disabled={busy} sx={{ textTransform: 'none' }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={save}
              disabled={busy}
              startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCheck size={16} />}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {dlg?.id ? 'Salvar' : 'Criar webhook'}
            </Button>
          </>
        }
      >
        {dlg ? (
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Nome"
              value={dlg.name}
              onChange={(e) => set({ name: e.target.value.slice(0, 80) })}
              placeholder='Ex.: "ERP", "Área de membros"'
              autoFocus={!dlg.id}
              fullWidth
            />
            <TextField
              size="small"
              label="URL (https)"
              value={dlg.url}
              onChange={(e) => set({ url: e.target.value.slice(0, 500) })}
              placeholder="https://seusistema.com/webhooks/pubmail"
              error={Boolean(dlg.url) && !isHttps(dlg.url)}
              helperText={dlg.url && !isHttps(dlg.url) ? 'Só endereços https:// (porta 443).' : 'Precisa responder 2xx em até 10 segundos.'}
              fullWidth
              InputProps={{ sx: monoSx }}
            />
            <EventsPicker f={dlg} set={set} />
          </Stack>
        ) : null}
      </CrmModal>

      <CrmModal
        open={Boolean(secret)}
        onClose={() => setSecret(null)}
        title={secret?.title || 'Segredo'}
        subtitle={secret?.name}
        footer={
          <Button variant="contained" disableElevation onClick={() => setSecret(null)} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Já copiei
          </Button>
        }
      >
        {secret ? (
          <SecretBox
            value={secret.value}
            title="Segredo de assinatura"
            warning="Guarde no seu sistema (variável de ambiente) para conferir o cabeçalho X-PubMail-Signature. Ele não aparece de novo — se perder, gire o segredo."
          />
        ) : null}
      </CrmModal>

      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        loading={busy}
        danger={confirm?.kind === 'delete'}
        title={confirm?.kind === 'delete' ? 'Excluir este webhook?' : 'Gerar um novo segredo?'}
        message={
          confirm?.kind === 'delete'
            ? `"${confirm?.w?.name}" para de receber eventos e o histórico de entregas é apagado.`
            : 'O segredo atual para de valer na hora: atualize o seu sistema com o novo, senão as assinaturas não vão bater.'
        }
        confirmLabel={confirm?.kind === 'delete' ? 'Excluir' : 'Gerar novo segredo'}
      />

      <DeliveriesDialog webhook={deliveries} onClose={() => setDeliveries(null)} />
    </Box>
  );
}
