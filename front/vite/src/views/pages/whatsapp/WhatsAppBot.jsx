// =============================================================================
// WhatsApp → Fluxo do Bot (multi-número)
// N fluxos por organização; cada número do WhatsApp usa 0 ou 1 fluxo (o mesmo fluxo
// pode atender vários números). Construtor visual (reactflow) + Configurações +
// simulador + monitor, por fluxo. O fluxo aberto fica na URL (?flow=<id>).
//   GET    /whatsapp/bot/flows                → lista (nome, ativo, números, stats)
//   POST   /whatsapp/bot/flows                → { name, definition | clone_of, settings } (nasce desligado)
//   GET    /whatsapp/bot/flows/:id            → definition + settings
//   PUT    /whatsapp/bot/flows/:id            → { name? , definition?, settings? } (autosave 2 s + Salvar; nunca liga)
//   DELETE /whatsapp/bot/flows/:id            → dono/admin
//   POST   /whatsapp/bot/flows/:id/active     → { active } (dono/admin; ligar valida o fluxo)
//   PUT    /whatsapp/bot/flows/:id/sessions   → { session_ids } (dono/admin; tira os números dos outros fluxos)
//   POST   /whatsapp/bot/simulate             → { flow_id | definition, settings, state?, input?, event? }
//   GET    /whatsapp/bot/sessions?session_id  → monitor (aba Conversas)
// =============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  Drawer,
  Fab,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Switch,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material';
import { useColorScheme, useTheme } from '@mui/material/styles';
import {
  IconAdjustments,
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconCopy,
  IconDeviceFloppy,
  IconDeviceMobile,
  IconDotsVertical,
  IconInfoCircle,
  IconLock,
  IconMessageChatbot,
  IconPencil,
  IconPlayerPause,
  IconPlus,
  IconRobot,
  IconSitemap,
  IconTrash,
  IconX
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, post, put, remove } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgConfirmDialog, TgEmptyState } from 'views/pages/telegram/ui';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { WaPageHeader, useWaSessions, waButtonSx } from './waKit';
import {
  buildDefaultFlow,
  cleanDefinition,
  cloneNodeData,
  createNodeData,
  hydrateDefinition,
  normalizeSettings,
  outputsOf,
  payloadSig,
  questionVars,
  toneOfHandle,
  uid,
  validateFlow
} from './bot/botModel';
import {
  BotProvider,
  BotStatusPill,
  NODE_META,
  PALETTE_GROUPS,
  TAG_COLORS,
  TONE,
  WA_ACCENT,
  WA_DARK,
  WA_GREEN,
  WA_OK,
  WA_WARN,
  botStatusOf,
  hexA,
  useBookCatalog,
  useOrderCatalog,
  useTicketCatalog
} from './bot/botUi';
import { BotFlowStyles, edgeTypes, nodeTypes } from './bot/nodes';
import BotPalette, { DND_TYPE, PaletteList } from './bot/palette';
import BotInspector from './bot/inspector';
import BotSimulator from './bot/simulator';
import BotSettingsTab from './bot/settingsTab';
import BotMonitor from './bot/monitor';
import { AssignNumbersDialog, FlowFormDialog, FlowNumbers, FlowStrip, UnassignedBanner } from './bot/flows';

const MANAGERS = ['OWNER', 'ADMIN', 'SUPER_ADMIN'];
const AUTOSAVE_MS = 2000;
const FLOWS_POLL_MS = 60000;
const MAX_FLOWS = 50;
const INSPECTOR_W = 400;
const NODE_HALF_W = 142;

const asList = (r) => (Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : []);
const botErr = (e, fb) => {
  const status = e?.response?.status;
  if (status === 403) return 'Você não tem permissão para esta ação.';
  const m = e?.response?.data?.message ?? e?.message;
  return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};
const is404 = (e) => e?.response?.status === 404;
const markerFor = (h) => ({ type: MarkerType.ArrowClosed, color: TONE[toneOfHandle(h)] || TONE.neutral, width: 16, height: 16 });
const withWa = (e) => ({ ...e, type: 'wa', markerEnd: markerFor(e.sourceHandle) });
const unselect = (nds) => (nds.some((n) => n.selected) ? nds.map((n) => (n.selected ? { ...n, selected: false } : n)) : nds);
const hms = (d) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d);
const flowUrl = (id) => `/whatsapp/bot/flows/${encodeURIComponent(id)}`;
// definição padrão (boas-vindas → menu → atendente / encerrar) para fluxos novos sem "duplicar de"
const defaultPayload = () => {
  const s = normalizeSettings(null);
  const f = buildDefaultFlow(s);
  return { definition: cleanDefinition(f.nodes, f.edges), settings: s };
};
// campos da lista que um GET/PUT de fluxo pode atualizar
const flowListFields = (r) => {
  const out = {};
  ['name', 'active', 'position', 'updated_at', 'published_at', 'created_at', 'sessions', 'stats'].forEach((k) => {
    if (r[k] !== undefined) out[k] = r[k];
  });
  return out;
};

// -----------------------------------------------------------------------------
// Indicador de salvamento
// -----------------------------------------------------------------------------
function SaveIndicator({ saving, dirty, error, savedAt, offline }) {
  let content;
  if (saving)
    content = (
      <Stack direction="row" spacing={0.6} alignItems="center" sx={{ color: 'text.secondary' }}>
        <CircularProgress size={13} color="inherit" />
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          Salvando…
        </Typography>
      </Stack>
    );
  else if (error)
    content = (
      <Tooltip title={error}>
        <Stack direction="row" spacing={0.6} alignItems="center" sx={{ color: 'error.main', cursor: 'help' }}>
          <IconAlertCircle size={15} />
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Não foi possível salvar
          </Typography>
        </Stack>
      </Tooltip>
    );
  else if (dirty || offline)
    content = (
      <Stack direction="row" spacing={0.6} alignItems="center" sx={{ color: WA_WARN }}>
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#F59E0B' }} />
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          Alterações não salvas
        </Typography>
      </Stack>
    );
  else
    content = (
      <Tooltip title={savedAt ? `Salvo às ${hms(savedAt)}` : 'Tudo salvo'}>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'success.main' }}>
          <IconCheck size={15} />
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Salvo
          </Typography>
        </Stack>
      </Tooltip>
    );
  return <Box sx={{ px: 0.5, whiteSpace: 'nowrap' }}>{content}</Box>;
}

// -----------------------------------------------------------------------------
// Diálogo de ativar / pausar (por fluxo)
// -----------------------------------------------------------------------------
function ActivationDialog({ state, busy, onClose, onConfirm, settings, issues, flowName, flowSessions }) {
  if (!state) return null;
  const target = state.target;
  const errors = issues.filter((i) => i.level === 'error');
  const aud = settings.audience;
  const n = aud.test_chat_ids.length;
  const audText =
    aud.mode === 'all'
      ? 'todos os contatos que mandarem mensagem'
      : aud.mode === 'test'
        ? n
          ? `só ${n === 1 ? 'o contato de teste' : `os ${n} contatos de teste`}`
          : 'ninguém ainda (Modo teste sem contatos)'
        : 'só os contatos com as etiquetas escolhidas';
  const color = target ? WA_GREEN : '#64748B';
  const numbers = flowSessions || [];
  return (
    <Dialog open onClose={() => !busy && onClose()} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogContent sx={{ pt: 3.5, textAlign: 'center' }}>
        <Box
          sx={{
            width: 60,
            height: 60,
            mx: 'auto',
            mb: 1.5,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            background: target ? `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})` : 'linear-gradient(135deg, #94A3B8, #64748B)',
            boxShadow: `0 8px 20px ${hexA(color, 0.35)}`
          }}
        >
          {target ? <IconRobot size={30} /> : <IconPlayerPause size={28} />}
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.75 }}>
          {target ? 'Ligar o bot?' : 'Desligar o bot?'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {target ? (
            <>
              O fluxo <b>“{flowName}”</b> vai começar a responder <b>{audText}</b>
              {numbers.length ? (
                <>
                  {' '}
                  {numbers.length === 1 ? 'no número' : 'nos números'}{' '}
                  <b>{numbers.map((s) => s.label || s.phone || 'Número').join(', ')}</b>
                </>
              ) : null}
              . Grupos e conversas em atendimento humano não são afetados.
            </>
          ) : (
            'O bot para de responder novas mensagens nos números que usam este fluxo. Conversas que já estão com atendentes continuam normalmente.'
          )}
        </Typography>
        {target && !numbers.length ? (
          <Alert severity="warning" sx={{ mt: 2, textAlign: 'left', borderRadius: 2 }}>
            Nenhum número usa este fluxo. Ele vai ficar ligado, mas não responde ninguém até você atribuir um número (botão <b>Números</b>).
          </Alert>
        ) : null}
        {target && aud.mode === 'all' ? (
          <Alert severity="info" sx={{ mt: 2, textAlign: 'left', borderRadius: 2 }}>
            Dica: se ainda não testou no seu celular, comece pelo <b>Modo teste</b> (aba Configurações).
          </Alert>
        ) : null}
        {target && errors.length ? (
          <Alert severity="warning" sx={{ mt: 2, textAlign: 'left', borderRadius: 2 }}>
            O fluxo tem {errors.length} {errors.length === 1 ? 'problema que pode' : 'problemas que podem'} impedir a ativação:
            <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.25 }}>
              {errors.slice(0, 3).map((i) => (
                <li key={i.id}>{i.text}</li>
              ))}
            </Box>
          </Alert>
        ) : null}
        {state.error ? (
          <Alert severity="error" sx={{ mt: 2, textAlign: 'left', borderRadius: 2 }}>
            {state.error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'center', gap: 1 }}>
        <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={onConfirm}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={15} color="inherit" /> : null}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 2,
            minWidth: 140,
            bgcolor: target ? WA_GREEN : '#64748B',
            '&:hover': { bgcolor: target ? WA_DARK : '#475569' }
          }}
        >
          {target ? 'Ligar bot' : 'Desligar bot'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Lista de avisos do fluxo
// -----------------------------------------------------------------------------
function IssuesPopover({ anchorEl, onClose, issues, nodes, onPick }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const errors = issues.filter((i) => i.level === 'error').length;
  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { width: 400, maxWidth: 'calc(100vw - 24px)', borderRadius: 3, mt: 0.75, overflow: 'hidden' } } }}
    >
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Revisão do fluxo</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {issues.length
            ? `${errors} ${errors === 1 ? 'problema' : 'problemas'} · ${issues.length - errors} ${issues.length - errors === 1 ? 'aviso' : 'avisos'} — clique para ir até o bloco.`
            : 'Nenhum problema encontrado.'}
        </Typography>
      </Box>
      {issues.length ? (
        <Box sx={{ maxHeight: 380, overflowY: 'auto', py: 0.5 }}>
          {issues.map((i) => {
            const node = i.nodeId ? byId.get(i.nodeId) : null;
            const meta = node ? NODE_META[node.type] : null;
            const err = i.level === 'error';
            const info = i.level === 'info';
            return (
              <Stack
                key={i.id}
                direction="row"
                spacing={1.25}
                alignItems="flex-start"
                onClick={() => onPick(i)}
                sx={{ px: 2, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Box sx={{ color: err ? 'error.main' : info ? 'info.main' : WA_WARN, mt: '1px', display: 'flex' }}>
                  {err ? <IconAlertCircle size={17} /> : info ? <IconInfoCircle size={17} /> : <IconAlertTriangle size={17} />}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                    {i.text}
                  </Typography>
                  <Typography variant="caption" sx={{ color: meta?.color || 'text.secondary', fontWeight: 700 }}>
                    {node ? (node.type === 'start' ? 'Início' : `${meta?.label} · ${node.data?.title || ''}`) : 'Configurações'}
                  </Typography>
                </Box>
              </Stack>
            );
          })}
        </Box>
      ) : (
        <Stack alignItems="center" spacing={1} sx={{ py: 3.5 }}>
          <Box sx={{ color: 'success.main' }}>
            <IconCircleCheck size={36} />
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Tudo certo por aqui!
          </Typography>
        </Stack>
      )}
    </Popover>
  );
}

// =============================================================================
// Editor de UM fluxo (montado com key={flowId} — troca de fluxo = estado novo)
// =============================================================================
function BotBuilder({
  flowId,
  flow,
  allSessions,
  byId,
  anyConnected,
  canManage,
  bannerKey,
  onFlowChanged,
  onManageSessions,
  onRename,
  onDuplicate,
  onDelete,
  onGone
}) {
  const theme = useTheme();
  const downLg = useMediaQuery(theme.breakpoints.down('lg'));
  const downSm = useMediaQuery(theme.breakpoints.down('sm'));
  const narrow = useMediaQuery('(max-width:1599.95px)');
  const { mode, systemMode } = useColorScheme();
  const isDark = (mode === 'system' ? systemMode : mode) === 'dark';
  const rf = useReactFlow();

  const meta = flow || {};
  const flowSessions = useMemo(() => meta.sessions || [], [meta.sessions]);

  const [tab, setTab] = useState('flow');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [settings, setSettings] = useState(() => normalizeSettings(null));
  const [savedSig, setSavedSig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [simOpen, setSimOpen] = useState(false);
  const [simNodeId, setSimNodeId] = useState(null);
  // celular: inspetor em tela cheia (fechar mantém o bloco selecionado) + gaveta de blocos
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [draggingBlock, setDraggingBlock] = useState(null);
  const [connectMenu, setConnectMenu] = useState(null);
  const [issuesEl, setIssuesEl] = useState(null);
  const [menuEl, setMenuEl] = useState(null);
  const [actDialog, setActDialog] = useState(null);
  const [actBusy, setActBusy] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [tags, setTags] = useState([]);
  const [attendants, setAttendants] = useState([]);
  const [gateway, setGateway] = useState(null);
  const [products, setProducts] = useState(null);
  const [crmSettings, setCrmSettings] = useState(null);
  const [frameH, setFrameH] = useState(0);
  const productsRef = useRef(null);
  productsRef.current = products;

  const frameRef = useRef(null);
  const wrapperRef = useRef(null);
  const connectingRef = useRef(null);
  const savingRef = useRef(false);
  const lastErrRef = useRef('');
  const addCountRef = useRef(0);
  const viewportRef = useRef(null);
  const flowIdRef = useRef(flowId);
  flowIdRef.current = flowId;

  const latest = useRef({});
  latest.current = { nodes, edges, settings };
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const sig = useMemo(() => payloadSig(nodes, edges, settings), [nodes, edges, settings]);
  const dirty = savedSig !== sig;
  const canAutosave = !loading && !loadError;
  const savedSigRef = useRef(savedSig);
  savedSigRef.current = savedSig;
  const canAutoRef = useRef(canAutosave);
  canAutoRef.current = canAutosave;

  const gone = useCallback(() => {
    canAutoRef.current = false;
    onGone(flowId);
  }, [onGone, flowId]);

  // --------------------------------------------------------------- carga
  const load = useCallback(async () => {
    viewportRef.current = null;
    setLoading(true);
    setLoadError(null);
    setSelectedId(null);
    let def = null;
    let st = null;
    let ok = false;
    try {
      const r = await get(flowUrl(flowId));
      onFlowChanged(r);
      def = r?.definition;
      st = r?.settings;
      ok = true;
    } catch (e) {
      if (is404(e)) {
        gone();
        return;
      }
      setLoadError({ status: e?.response?.status, message: botErr(e, 'Não foi possível carregar o fluxo salvo.') });
    }
    const s = normalizeSettings(st);
    const hasDef = def && Array.isArray(def.nodes) && def.nodes.length > 0;
    const built = hasDef ? hydrateDefinition(def) : buildDefaultFlow(s);
    const ee = built.edges.map(withWa);
    setSettings(s);
    setNodes(built.nodes);
    setEdges(ee);
    // fluxo sem blocos (nunca salvo) → fica "não salvo" e o autosave grava o padrão
    setSavedSig(ok && hasDef ? payloadSig(built.nodes, ee, s) : null);
    setSaveError(null);
    setLoading(false);
  }, [flowId, onFlowChanged, gone, setNodes, setEdges]);

  useEffect(() => {
    load();
  }, [load]);

  // catálogos (etiquetas, atendentes, gateway PIX)
  useEffect(() => {
    let alive = true;
    get('/whatsapp/tags')
      .then((r) => alive && setTags(asList(r)))
      .catch(() => {});
    get('/whatsapp/attendants')
      .then((r) => alive && setAttendants(asList(r)))
      .catch(() => {});
    get('/payments/settings')
      .then((g) => alive && setGateway({ ...(g || {}), ready: typeof g?.ready === 'boolean' ? g.ready : Boolean(g?.active) }))
      .catch(() => alive && setGateway(null));
    // blocos de Cliente: produtos ativos + campos personalizados/identidade da org
    get('/whatsapp/products')
      .then((r) => alive && setProducts(asList(r)))
      .catch(() => alive && setProducts(null));
    // custom_fields: desde a Fase 7 o servidor devolve um MAPA por entidade ({customer, ticket, order…}) + `customer_fields`
    // (lista de clientes, formato antigo). Aqui `custom_fields` continua sendo a lista de CLIENTES (todos os consumidores
    // antigos leem array) e `custom_field_map` guarda o mapa inteiro (campos de chamado/pedido que o bot pergunta).
    get('/whatsapp/crm-settings')
      .then((r) => {
        if (!alive) return;
        if (!r || typeof r !== 'object') return setCrmSettings(null);
        const raw = r.custom_fields;
        const map = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { customer: Array.isArray(raw) ? raw : [] };
        const customer = Array.isArray(r.customer_fields) ? r.customer_fields : Array.isArray(map.customer) ? map.customer : [];
        setCrmSettings({ custom_fields: customer, custom_field_map: { ...map, customer }, identity: r.identity || null });
      })
      .catch(() => alive && setCrmSettings(null));
    return () => {
      alive = false;
    };
  }, []);

  // --------------------------------------------------------------- salvar
  const saveNow = useCallback(
    async ({ manual = false } = {}) => {
      if (savingRef.current) return { ok: false, busy: true };
      const { nodes: n, edges: e, settings: s } = latest.current;
      const at = payloadSig(n, e, s);
      savingRef.current = true;
      setSaving(true);
      try {
        const r = await put(flowUrl(flowId), { definition: cleanDefinition(n, e), settings: s });
        onFlowChanged(r);
        setSavedSig(at);
        setSaveError(null);
        setSavedAt(new Date());
        lastErrRef.current = '';
        if (manual) {
          setLoadError(null);
          toast.success('Fluxo salvo.');
        }
        return { ok: true };
      } catch (err) {
        if (is404(err)) {
          gone();
          return { ok: false, message: 'Este fluxo não existe mais.' };
        }
        const message = botErr(err, 'Não foi possível salvar o fluxo.');
        setSaveError({ sig: at, message });
        if (manual || lastErrRef.current !== message) toast.error(message);
        lastErrRef.current = message;
        return { ok: false, message };
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [flowId, onFlowChanged, gone]
  );

  const ensureSaved = useCallback(async () => {
    for (let i = 0; i < 60 && savingRef.current; i += 1) await new Promise((r) => setTimeout(r, 150));
    const { nodes: n, edges: e, settings: s } = latest.current;
    if (payloadSig(n, e, s) === savedSigRef.current) return { ok: true };
    return saveNow();
  }, [saveNow]);

  // autosave (debounce)
  useEffect(() => {
    if (!canAutosave || saving || !dirty) return undefined;
    if (saveError && saveError.sig === sig) return undefined;
    const t = setTimeout(() => saveNow(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [sig, dirty, canAutosave, saving, saveError, saveNow]);

  // ao sair da página / trocar de fluxo: salva o que ficou pendente
  useEffect(
    () => () => {
      if (!canAutoRef.current) return;
      const { nodes: n, edges: e, settings: s } = latest.current;
      if (payloadSig(n, e, s) === savedSigRef.current) return;
      put(flowUrl(flowIdRef.current), { definition: cleanDefinition(n, e), settings: s }).catch(() => {});
    },
    []
  );

  useEffect(() => {
    const fn = (ev) => {
      if (!dirty) return;
      ev.preventDefault();
      ev.returnValue = '';
    };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [dirty]);

  const manualSave = useCallback(() => {
    if (loadError) {
      setConfirmOverwrite(true);
      return;
    }
    saveNow({ manual: true });
  }, [loadError, saveNow]);

  // --------------------------------------------------------------- altura do canvas
  useEffect(() => {
    const calc = () => {
      const el = frameRef.current;
      if (!el) return;
      if (downSm) {
        // celular: a página rola até o canvas; ele ocupa quase a tela toda, nunca menos de 360
        setFrameH(Math.max(360, Math.min(560, Math.round(window.innerHeight - 150))));
        return;
      }
      const top = el.getBoundingClientRect().top + window.scrollY;
      setFrameH(Math.max(440, Math.round(window.innerHeight - top - 24)));
    };
    calc();
    const t1 = setTimeout(calc, 120);
    const t2 = setTimeout(calc, 450);
    window.addEventListener('resize', calc);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => calc()) : null;
    ro?.observe(document.body);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', calc);
      ro?.disconnect();
    };
  }, [tab, loadError, loading, bannerKey, flowSessions.length, downSm]);

  // --------------------------------------------------------------- enquadramento inicial
  // Fluxo pequeno: centraliza. Fluxo grande: zoom legível (>= 0,62) alinhado à esquerda,
  // com o Início na altura do meio. Ao voltar de outra aba, restaura a visão anterior.
  const nodesInitialized = useNodesInitialized();
  const didInitRef = useRef(false);
  useEffect(() => {
    if (tab !== 'flow' || loading) didInitRef.current = false;
  }, [tab, loading]);
  useEffect(() => {
    if (!nodesInitialized || didInitRef.current || loading || tab !== 'flow') return;
    didInitRef.current = true;
    if (viewportRef.current) {
      rf.setViewport(viewportRef.current);
      return;
    }
    const el = wrapperRef.current;
    const ns = rf.getNodes().filter((n) => n.width && n.height);
    if (!el || !ns.length) return;
    const W = el.clientWidth;
    const H = el.clientHeight;
    const pad = 48;
    const minX = Math.min(...ns.map((n) => n.position.x));
    const minY = Math.min(...ns.map((n) => n.position.y));
    const maxX = Math.max(...ns.map((n) => n.position.x + n.width));
    const maxY = Math.max(...ns.map((n) => n.position.y + n.height));
    const fitZoom = Math.min((W - pad * 2) / Math.max(1, maxX - minX), (H - pad * 2) / Math.max(1, maxY - minY));
    const zoom = Math.min(0.95, Math.max(0.62, fitZoom));
    if (fitZoom >= 0.62) {
      rf.setViewport({ x: (W - (maxX - minX) * zoom) / 2 - minX * zoom, y: (H - (maxY - minY) * zoom) / 2 - minY * zoom, zoom });
    } else {
      const start = ns.find((n) => n.type === 'start') || ns[0];
      rf.setViewport({ x: pad - minX * zoom, y: H / 2 - (start.position.y + start.height / 2) * zoom, zoom });
    }
  }, [nodesInitialized, loading, tab, rf]);

  // --------------------------------------------------------------- operações nos nós
  const updateNodeData = useCallback(
    (id, patch) => {
      const merge = (data) => {
        const next = { ...data, ...patch };
        Object.keys(patch).forEach((k) => {
          if (patch[k] === undefined) delete next[k];
        });
        return next;
      };
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: merge(n.data) } : n)));
      if ('options' in patch || 'source' in patch || 'product_ids' in patch) {
        const cur = nodesRef.current.find((n) => n.id === id);
        if (cur) {
          const valid = new Set(outputsOf(cur.type, merge(cur.data), latest.current.settings, productsRef.current).map((o) => o.id));
          setEdges((eds) => eds.filter((e) => e.source !== id || valid.has(e.sourceHandle || 'out')));
        }
      }
    },
    [setNodes, setEdges]
  );

  const centerOn = useCallback(
    (x, y) => {
      const zoom = Math.max(rf.getZoom?.() || 0.9, 0.8);
      const offset = downSm ? 0 : INSPECTOR_W / 2 / zoom;
      rf.setCenter(x + offset, y, { zoom, duration: 350 });
    },
    [rf, downSm]
  );

  const addNode = useCallback(
    (type, position, from) => {
      const id = uid(type);
      const data = createNodeData(type, { settings: latest.current.settings, nodes: nodesRef.current });
      setNodes((nds) => [...unselect(nds), { id, type, position, data, selected: true }]);
      if (from) {
        setEdges((eds) => [
          ...eds.filter((e) => !(e.source === from.source && (e.sourceHandle || 'out') === from.sourceHandle)),
          withWa({ id: uid('e'), source: from.source, sourceHandle: from.sourceHandle, target: id, targetHandle: 'in' })
        ]);
      }
      setSelectedId(id);
      return id;
    },
    [setNodes, setEdges]
  );

  // clique na paleta: encaixa depois do bloco selecionado (1ª saída livre) ou no centro da tela
  const addFromPalette = useCallback(
    (type) => {
      const sel = nodesRef.current.find((n) => n.id === selectedId);
      if (sel && tab === 'flow') {
        const outs = outputsOf(sel.type, sel.data, latest.current.settings, productsRef.current);
        const used = new Set(edgesRef.current.filter((e) => e.source === sel.id).map((e) => e.sourceHandle || 'out'));
        const idx = outs.findIndex((o) => !used.has(o.id));
        if (idx >= 0) {
          const pos = { x: (sel.position?.x || 0) + 368, y: (sel.position?.y || 0) + idx * 48 };
          addNode(type, pos, { source: sel.id, sourceHandle: outs[idx].id });
          centerOn(pos.x + NODE_HALF_W, pos.y + 90);
          return;
        }
      }
      const el = wrapperRef.current;
      const rect = el?.getBoundingClientRect();
      const k = addCountRef.current++ % 6;
      const pos = rect
        ? rf.screenToFlowPosition({ x: rect.left + rect.width / 2 - (downSm ? 0 : INSPECTOR_W / 2), y: rect.top + rect.height / 2 - 80 })
        : { x: 200, y: 200 };
      addNode(type, { x: pos.x - NODE_HALF_W + k * 28, y: pos.y + k * 28 });
    },
    [selectedId, tab, addNode, centerOn, rf, downSm]
  );

  const duplicateNode = useCallback(
    (id) => {
      const src = nodesRef.current.find((n) => n.id === id);
      if (!src || src.type === 'start') return;
      const newId = uid(src.type);
      setNodes((nds) => [
        ...unselect(nds),
        {
          id: newId,
          type: src.type,
          position: { x: (src.position?.x || 0) + 48, y: (src.position?.y || 0) + 48 },
          data: cloneNodeData(src.type, src.data),
          selected: true
        }
      ]);
      setSelectedId(newId);
    },
    [setNodes]
  );

  const deleteNode = useCallback(
    (id) => {
      const n = nodesRef.current.find((x) => x.id === id);
      if (!n || n.type === 'start') return;
      setNodes((nds) => nds.filter((x) => x.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [setNodes, setEdges]
  );

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setInspectorOpen(false);
    setNodes((nds) => unselect(nds));
  }, [setNodes]);

  // bloco novo/selecionado → no celular abre o inspetor em tela cheia
  useEffect(() => {
    if (selectedId) setInspectorOpen(true);
  }, [selectedId]);
  // no celular, fechar o inspetor mantém o bloco selecionado (o próximo bloco da gaveta encaixa depois dele)
  const closeInspector = useCallback(() => {
    if (downSm) setInspectorOpen(false);
    else clearSelection();
  }, [downSm, clearSelection]);
  const addFromDrawer = useCallback(
    (type) => {
      setPaletteOpen(false);
      addFromPalette(type);
    },
    [addFromPalette]
  );

  const onConnect = useCallback(
    (params) => {
      const h = params.sourceHandle || 'out';
      setEdges((eds) =>
        addEdge(
          withWa({ ...params, sourceHandle: h, targetHandle: params.targetHandle || 'in', id: uid('e') }),
          eds.filter((e) => !(e.source === params.source && (e.sourceHandle || 'out') === h))
        )
      );
    },
    [setEdges]
  );

  // soltar a conexão no vazio → menu para criar o próximo bloco já ligado
  const onConnectStart = useCallback((_, p) => {
    connectingRef.current = p?.handleType === 'source' && p?.nodeId ? { source: p.nodeId, sourceHandle: p.handleId || 'out' } : null;
  }, []);
  const onConnectEnd = useCallback((event) => {
    const from = connectingRef.current;
    connectingRef.current = null;
    if (!from) return;
    const target = event?.target;
    if (!target?.classList?.contains('react-flow__pane')) return;
    const pt = event.changedTouches?.[0] || event;
    setConnectMenu({ x: pt.clientX, y: pt.clientY, ...from });
  }, []);

  // --------------------------------------------------------------- arrastar blocos da paleta
  const onDragOver = useCallback((e) => {
    if (!e.dataTransfer.types.includes(DND_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);
  const onDrop = useCallback(
    (e) => {
      const type = e.dataTransfer.getData(DND_TYPE);
      setDraggingBlock(null);
      if (!type || !NODE_META[type] || type === 'start') return;
      e.preventDefault();
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(type, { x: p.x - NODE_HALF_W, y: p.y - 23 });
    },
    [rf, addNode]
  );

  // --------------------------------------------------------------- avisos
  const structKey = useMemo(() => {
    try {
      return JSON.stringify([nodes.map((n) => [n.id, n.type, n.data]), edges.map((e) => [e.source, e.sourceHandle, e.target])]);
    } catch {
      return String(Math.random());
    }
  }, [nodes, edges]);
  const bookCatalog = useBookCatalog(); // serviços da agenda (valida os blocos "Agendar")
  const bookServices = bookCatalog.services;
  const ticketCategories = useTicketCatalog().categories; // categorias de chamado (valida os blocos "Abrir chamado")
  const orderCatalog = useOrderCatalog(); // catálogo de pedidos (valida os blocos "Fazer pedido")
  const catalogCategories = orderCatalog.categories;
  const customFieldMap = crmSettings?.custom_field_map || null;
  const issues = useMemo(
    () =>
      validateFlow(nodesRef.current, edgesRef.current, {
        settings,
        tags,
        attendants,
        gateway,
        products,
        crmSettings,
        bookServices,
        ticketCategories,
        catalogCategories,
        customFieldMap
      }).sort(
        (a, b) => (a.level === 'error' ? 0 : a.level === 'warning' ? 1 : 2) - (b.level === 'error' ? 0 : b.level === 'warning' ? 1 : 2)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      structKey,
      settings,
      tags,
      attendants,
      gateway,
      products,
      crmSettings,
      bookServices,
      ticketCategories,
      catalogCategories,
      customFieldMap
    ]
  );
  const issuesByNode = useMemo(() => {
    const m = {};
    issues.forEach((i) => {
      if (!i.nodeId) return;
      (m[i.nodeId] = m[i.nodeId] || []).push(i);
    });
    return m;
  }, [issues]);
  const errorCount = issues.filter((i) => i.level === 'error').length;
  const settingsIssues = issues.filter((i) => !i.nodeId).length;
  const issueTone = !issues.length
    ? { fg: WA_OK, bg: '#22C55E' }
    : errorCount
      ? { fg: 'error.main', bg: '#EF4444' }
      : { fg: WA_WARN, bg: '#F59E0B' };

  const focusIssue = useCallback(
    (issue) => {
      setIssuesEl(null);
      if (!issue.nodeId) {
        setTab('settings');
        return;
      }
      setTab('flow');
      setSelectedId(issue.nodeId);
      setNodes((nds) => nds.map((n) => (n.selected === (n.id === issue.nodeId) ? n : { ...n, selected: n.id === issue.nodeId })));
      setTimeout(() => {
        const n = rf.getNode?.(issue.nodeId);
        if (n) centerOn((n.position?.x || 0) + (n.width || 284) / 2, (n.position?.y || 0) + (n.height || 160) / 2);
      }, 80);
    },
    [rf, centerOn, setNodes]
  );

  // --------------------------------------------------------------- ligar / desligar
  const status = botStatusOf(meta.active, settings);
  const requestToggle = (target) => {
    if (!canManage) return;
    setActDialog({ target, error: null });
  };
  const confirmToggle = async () => {
    const target = actDialog?.target;
    setActBusy(true);
    try {
      if (target) {
        const r = await ensureSaved();
        if (!r.ok) {
          setActDialog((d) => (d ? { ...d, error: r.message || 'Salve o fluxo antes de ligar.' } : d));
          return;
        }
      }
      const r = await post(`${flowUrl(flowId)}/active`, { active: target });
      onFlowChanged(r && typeof r.active === 'boolean' ? r : { id: flowId, active: target });
      toast.success(target ? 'Bot ligado! 🎉' : 'Bot desligado.');
      setActDialog(null);
    } catch (e) {
      if (is404(e)) {
        setActDialog(null);
        gone();
        return;
      }
      const message = botErr(e, target ? 'Não foi possível ligar o bot.' : 'Não foi possível desligar o bot.');
      setActDialog((d) => (d ? { ...d, error: message } : d));
    } finally {
      setActBusy(false);
    }
  };

  // --------------------------------------------------------------- atalhos
  useEffect(() => {
    const fn = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        manualSave();
      } else if (e.key === 'Escape' && selectedId) {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') clearSelection();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [manualSave, selectedId, clearSelection]);

  // --------------------------------------------------------------- etiquetas (criar inline)
  const createTag = useCallback(
    async (name) => {
      const color = TAG_COLORS[tags.length % TAG_COLORS.length];
      try {
        const t = await post('/whatsapp/tags', { name, color });
        if (t?.id) {
          setTags((p) => [...p.filter((x) => x.id !== t.id), t]);
          toast.success(`Etiqueta “${t.name}” criada.`);
          return t;
        }
      } catch (e) {
        toast.error(botErr(e, 'Não foi possível criar a etiqueta.'));
      }
      return null;
    },
    [tags.length]
  );

  // --------------------------------------------------------------- contexto
  const varsKey = questionVars(nodes).join('|');
  const vars = useMemo(() => (varsKey ? varsKey.split('|') : []), [varsKey]);
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const actions = useMemo(
    () => ({
      onTitleChange: (id, title) => updateNodeData(id, { title }),
      onDuplicate: duplicateNode,
      onDelete: deleteNode,
      onDeleteEdge: (eid) => setEdges((eds) => eds.filter((e) => e.id !== eid))
    }),
    [updateNodeData, duplicateNode, deleteNode, setEdges]
  );
  const ctx = useMemo(
    () => ({
      tags,
      tagsById,
      attendants,
      gateway,
      products,
      crmSettings,
      customFieldMap,
      orderCatalog,
      catalogCategories,
      settings,
      vars,
      issuesByNode,
      simNodeId,
      actions,
      createTag
    }),
    [
      tags,
      tagsById,
      attendants,
      gateway,
      products,
      crmSettings,
      customFieldMap,
      orderCatalog,
      catalogCategories,
      settings,
      vars,
      issuesByNode,
      simNodeId,
      actions,
      createTag
    ]
  );

  // simulador: fluxo salvo → só flow_id; rascunho alterado → definition/settings atuais
  const getPayload = useCallback(() => {
    const { nodes: n, edges: e, settings: s } = latest.current;
    if (payloadSig(n, e, s) === savedSigRef.current) return { flow_id: flowId };
    return { flow_id: flowId, definition: cleanDefinition(n, e), settings: s };
  }, [flowId]);
  const flowKey = useMemo(() => payloadSig(nodes, edges, settings), [nodes, edges, settings]);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedId) || null, [nodes, selectedId]);
  // bloco selecionado com alguma saída livre → o próximo bloco da gaveta (celular) encaixa depois dele (mesma regra do addFromPalette)
  const chainAfter = useMemo(() => {
    if (!selectedNode || tab !== 'flow') return null;
    const outs = outputsOf(selectedNode.type, selectedNode.data, settings, products);
    const used = new Set(edges.filter((e) => e.source === selectedNode.id).map((e) => e.sourceHandle || 'out'));
    return outs.some((o) => !used.has(o.id)) ? selectedNode : null;
  }, [selectedNode, edges, settings, products, tab]);
  const paletteCompact = downLg || (simOpen && narrow);
  const stats = meta.stats || {};

  const openMenu = (fn) => () => {
    setMenuEl(null);
    fn?.();
  };

  // --------------------------------------------------------------- render
  return (
    <Box>
      <BotFlowStyles />

      {loadError ? (
        <Alert
          severity="warning"
          sx={{ mb: 1.5, borderRadius: 2, py: 0.25 }}
          action={
            <Button color="inherit" size="small" onClick={load} sx={{ fontWeight: 700, textTransform: 'none' }}>
              Tentar de novo
            </Button>
          }
        >
          {loadError.message}
        </Alert>
      ) : null}

      {/* identidade do fluxo aberto: nome, status, números, ligar/desligar, menu
          (celular: empilhado — nome/status, números, e uma linha só para o toggle + ⋮) */}
      <Stack
        direction={downSm ? 'column' : 'row'}
        alignItems={downSm ? 'stretch' : 'center'}
        flexWrap={downSm ? 'nowrap' : 'wrap'}
        useFlexGap
        sx={{ mb: 1.25, columnGap: 1.5, rowGap: downSm ? 1 : 0.75, minWidth: 0 }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flex: downSm ? '0 0 auto' : '1 1 280px', minWidth: 0 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              flexShrink: 0,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              background: meta.active ? `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})` : 'linear-gradient(135deg, #94A3B8, #64748B)'
            }}
          >
            <IconRobot size={21} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Tooltip title="Renomear">
                <Typography
                  component="button"
                  type="button"
                  onClick={onRename}
                  sx={{
                    all: 'unset',
                    display: 'block',
                    maxWidth: '100%',
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: 17,
                    lineHeight: 1.2,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'text.primary',
                    '&:hover': { color: WA_ACCENT }
                  }}
                >
                  {meta.name || 'Fluxo do bot'}
                </Typography>
              </Tooltip>
              <BotStatusPill status={status} />
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.4 }}>
              <FlowNumbers sessions={flowSessions} max={4} emptyText="Nenhum número usa este fluxo" />
              <Tooltip title={canManage ? 'Escolher os números do WhatsApp que usam este fluxo' : 'Só administradores atribuem números.'}>
                <span>
                  <Button
                    size="small"
                    onClick={onManageSessions}
                    disabled={!canManage}
                    startIcon={<IconDeviceMobile size={14} />}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, py: 0, minHeight: 24, color: WA_ACCENT }}
                  >
                    Números
                  </Button>
                </span>
              </Tooltip>
              {meta.active && stats.active_sessions != null && !downSm ? (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  · {Number(stats.active_sessions).toLocaleString('pt-BR')} {Number(stats.active_sessions) === 1 ? 'conversa' : 'conversas'}{' '}
                  com o bot agora
                </Typography>
              ) : null}
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0, minWidth: 0 }}>
          <Tooltip title={canManage ? '' : 'Só administradores podem ligar ou desligar o bot.'}>
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              sx={{
                pl: 1.25,
                pr: 0.5,
                py: 0.3,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                flexShrink: 0
              }}
            >
              {!canManage ? <IconLock size={15} style={{ opacity: 0.55 }} /> : null}
              <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{meta.active ? 'Ligado' : 'Desligado'}</Typography>
              <Switch
                checked={Boolean(meta.active)}
                disabled={!canManage || loading || actBusy}
                onChange={(e) => requestToggle(e.target.checked)}
                inputProps={{ 'aria-label': meta.active ? 'Desligar o bot' : 'Ligar o bot' }}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: WA_GREEN },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: WA_GREEN, opacity: 0.55 }
                }}
              />
            </Stack>
          </Tooltip>
          {downSm ? (
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
              <SaveIndicator
                saving={saving}
                dirty={dirty}
                offline={Boolean(loadError)}
                error={saveError && saveError.sig === sig ? saveError.message : null}
                savedAt={savedAt}
              />
            </Box>
          ) : null}
          <Tooltip title="Mais ações">
            <IconButton
              size="small"
              onClick={(e) => setMenuEl(e.currentTarget)}
              aria-label="Mais ações do fluxo"
              sx={{ ml: downSm ? 'auto' : undefined, width: downSm ? 40 : undefined, height: downSm ? 40 : undefined }}
            >
              <IconDotsVertical size={19} />
            </IconButton>
          </Tooltip>
          <Menu
            open={Boolean(menuEl)}
            anchorEl={menuEl}
            onClose={() => setMenuEl(null)}
            slotProps={{ paper: { sx: { borderRadius: 2.5, minWidth: 220, py: 0.25 } } }}
          >
            <MenuItem dense onClick={openMenu(onRename)}>
              <ListItemIcon>
                <IconPencil size={17} />
              </ListItemIcon>
              <ListItemText primary="Renomear" />
            </MenuItem>
            <MenuItem dense onClick={openMenu(onDuplicate)}>
              <ListItemIcon>
                <IconCopy size={17} />
              </ListItemIcon>
              <ListItemText primary="Duplicar" />
            </MenuItem>
            <MenuItem dense onClick={openMenu(onManageSessions)} disabled={!canManage}>
              <ListItemIcon>
                <IconDeviceMobile size={17} />
              </ListItemIcon>
              <ListItemText primary="Números que usam este fluxo…" />
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem dense onClick={openMenu(onDelete)} disabled={!canManage} sx={{ color: 'error.main' }}>
              <ListItemIcon sx={{ color: 'inherit' }}>
                <IconTrash size={17} />
              </ListItemIcon>
              <ListItemText primary="Excluir fluxo" />
            </MenuItem>
          </Menu>
        </Stack>
      </Stack>

      {/* abas + ações */}
      <Stack
        direction="row"
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 1.5, columnGap: 1, rowGap: 0.75 }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant={downSm ? 'scrollable' : 'standard'}
          scrollButtons={downSm ? 'auto' : false}
          allowScrollButtonsMobile
          sx={{
            minHeight: 44,
            mr: 'auto',
            minWidth: 0,
            maxWidth: '100%',
            width: downSm ? '100%' : undefined,
            '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 700, fontSize: 14, px: 1.5 },
            '& .MuiTab-root.Mui-selected': { color: WA_ACCENT },
            '& .MuiTabs-indicator': { bgcolor: WA_GREEN, height: 3, borderRadius: 3 }
          }}
        >
          <Tab value="flow" icon={<IconSitemap size={17} />} iconPosition="start" label="Fluxo" />
          <Tab
            value="settings"
            icon={<IconAdjustments size={17} />}
            iconPosition="start"
            label={
              <Stack component="span" direction="row" spacing={0.75} alignItems="center">
                <span>Configurações</span>
                {settingsIssues ? <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#F59E0B' }} /> : null}
              </Stack>
            }
          />
          <Tab
            value="monitor"
            icon={<IconMessageChatbot size={17} />}
            iconPosition="start"
            label={
              <Stack component="span" direction="row" spacing={0.75} alignItems="center">
                <span>Conversas</span>
                {stats.active_sessions ? (
                  <Box
                    component="span"
                    sx={{
                      px: 0.6,
                      borderRadius: 5,
                      fontSize: 11,
                      fontWeight: 800,
                      lineHeight: '18px',
                      color: '#fff',
                      bgcolor: WA_GREEN
                    }}
                  >
                    {Number(stats.active_sessions).toLocaleString('pt-BR')}
                  </Box>
                ) : null}
              </Stack>
            }
          />
        </Tabs>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            pb: downSm ? 1 : 0.5,
            width: downSm ? '100%' : undefined,
            minWidth: 0,
            '& > *': downSm ? { flex: 1, minWidth: 0 } : undefined
          }}
        >
          <Button
            size="small"
            onClick={(e) => setIssuesEl(e.currentTarget)}
            startIcon={
              issues.length ? errorCount ? <IconAlertCircle size={16} /> : <IconAlertTriangle size={16} /> : <IconCircleCheck size={16} />
            }
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              px: 1.25,
              whiteSpace: 'nowrap',
              color: issueTone.fg,
              bgcolor: hexA(issueTone.bg, 0.12),
              '&:hover': {
                bgcolor: hexA(issueTone.bg, 0.2)
              }
            }}
          >
            {issues.length ? `${issues.length} ${issues.length === 1 ? 'aviso' : 'avisos'}` : 'Tudo certo'}
          </Button>
          {!downSm ? (
            <SaveIndicator
              saving={saving}
              dirty={dirty}
              offline={Boolean(loadError)}
              error={saveError && saveError.sig === sig ? saveError.message : null}
              savedAt={savedAt}
            />
          ) : null}
          <Button
            size="small"
            variant={simOpen && tab === 'flow' ? 'contained' : 'outlined'}
            disableElevation
            startIcon={<IconDeviceMobile size={17} />}
            onClick={() => {
              if (tab !== 'flow') {
                setTab('flow');
                setSimOpen(true);
              } else setSimOpen((v) => !v);
            }}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              whiteSpace: 'nowrap',
              ...(simOpen && tab === 'flow'
                ? { bgcolor: WA_DARK, color: '#fff', '&:hover': { bgcolor: '#0e6f64' } }
                : {
                    color: WA_ACCENT,
                    borderColor: hexA(WA_DARK, 0.45),
                    '&:hover': { borderColor: WA_DARK, bgcolor: hexA(WA_GREEN, 0.08) }
                  })
            }}
          >
            {downSm ? 'Testar' : 'Testar fluxo'}
          </Button>
          <Tooltip title="Salvar agora (Ctrl/⌘ + S)">
            <span style={downSm ? { display: 'flex' } : undefined}>
              <Button
                size="small"
                variant="contained"
                disableElevation
                fullWidth={downSm}
                onClick={manualSave}
                disabled={saving || loading}
                startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <IconDeviceFloppy size={17} />}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
              >
                Salvar
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <BotProvider value={ctx}>
        {tab === 'settings' ? (
          <BotSettingsTab
            settings={settings}
            onChange={setSettings}
            status={status}
            meta={meta}
            canManage={canManage}
            onToggleActive={requestToggle}
            toggling={actBusy}
            disabled={loading}
            connected={anyConnected}
            flowSessions={flowSessions}
            onManageSessions={onManageSessions}
          />
        ) : tab === 'monitor' ? (
          <BotMonitor flowId={flowId} flowName={meta.name || 'Fluxo do bot'} sessions={allSessions} byId={byId} nodes={nodes} />
        ) : (
          <Box
            ref={frameRef}
            sx={(t) => ({
              height: frameH ? `${frameH}px` : 'calc(100dvh - 280px)',
              minHeight: downSm ? 360 : 440,
              display: 'flex',
              minWidth: 0,
              maxWidth: '100%',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              overflow: 'hidden',
              bgcolor: 'background.paper',
              '--wa-ctrl-bg': t.vars.palette.background.paper,
              '--wa-ctrl-fg': t.vars.palette.text.secondary,
              '--wa-ctrl-border': t.vars.palette.divider,
              '--wa-ctrl-hover': t.vars.palette.action.hover,
              '--wa-handle-border': t.vars.palette.background.paper
            })}
          >
            {!downSm ? <BotPalette compact={paletteCompact} onAdd={addFromPalette} onDragBlock={setDraggingBlock} /> : null}

            <Box
              ref={wrapperRef}
              onDragOver={onDragOver}
              onDrop={onDrop}
              sx={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden' }}
            >
              {loading ? (
                <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: '100%' }}>
                  <CircularProgress sx={{ color: WA_GREEN }} />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Carregando o fluxo…
                  </Typography>
                </Stack>
              ) : (
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onConnectStart={onConnectStart}
                  onConnectEnd={onConnectEnd}
                  onNodeClick={(_, n) => {
                    setSelectedId(n.id);
                    setInspectorOpen(true);
                  }}
                  onPaneClick={clearSelection}
                  onNodesDelete={(del) => {
                    if (del.some((d) => d.id === selectedId)) setSelectedId(null);
                  }}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  defaultEdgeOptions={{ type: 'wa' }}
                  deleteKeyCode={['Backspace', 'Delete']}
                  onMoveEnd={(_, vp) => {
                    viewportRef.current = vp;
                  }}
                  snapToGrid
                  snapGrid={[16, 16]}
                  minZoom={0.2}
                  maxZoom={1.6}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background gap={18} size={1.2} color={isDark ? '#1f2c33' : '#d5dde5'} />
                  <Controls showInteractive={false} />
                  {!downSm ? (
                    <MiniMap
                      pannable
                      zoomable
                      nodeStrokeWidth={2}
                      nodeBorderRadius={6}
                      nodeColor={(n) => NODE_META[n.type]?.color || '#94A3B8'}
                      nodeStrokeColor={isDark ? '#0b141a' : '#f0f2f5'}
                      maskColor={isDark ? 'rgba(6,10,14,0.66)' : 'rgba(226,232,240,0.55)'}
                      style={{
                        width: 150,
                        height: 104,
                        borderRadius: 10,
                        border: `1px solid ${isDark ? '#233138' : '#e2e8f0'}`,
                        background: isDark ? '#0b141a' : '#f0f2f5'
                      }}
                    />
                  ) : null}
                </ReactFlow>
              )}

              {/* dica ao arrastar */}
              {draggingBlock ? (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 8,
                    pointerEvents: 'none',
                    borderRadius: 3,
                    border: '2px dashed',
                    borderColor: WA_GREEN,
                    bgcolor: hexA(WA_GREEN, 0.04),
                    display: 'grid',
                    placeItems: 'end center',
                    zIndex: 4
                  }}
                >
                  <Box
                    sx={{
                      mb: 2,
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 5,
                      bgcolor: WA_DARK,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      boxShadow: 3
                    }}
                  >
                    Solte para criar o bloco “{NODE_META[draggingBlock]?.label}”
                  </Box>
                </Box>
              ) : null}

              {/* dica quando nada selecionado */}
              {!loading && !selectedNode && !draggingBlock ? (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 5,
                    whiteSpace: 'nowrap',
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: 1,
                    color: 'text.secondary',
                    fontSize: 11.5,
                    fontWeight: 600,
                    zIndex: 3,
                    display: { xs: 'none', md: 'block' }
                  }}
                >
                  Clique num bloco para editar · puxe uma bolinha até o vazio para criar o próximo passo
                </Box>
              ) : null}

              {/* celular: botão flutuante que abre a gaveta de blocos */}
              {downSm && !loading ? (
                <Fab
                  variant="extended"
                  size="medium"
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Adicionar bloco"
                  sx={{
                    position: 'absolute',
                    right: 12,
                    bottom: 12,
                    zIndex: 4,
                    textTransform: 'none',
                    fontWeight: 800,
                    fontSize: 14,
                    gap: 0.75,
                    color: '#fff',
                    bgcolor: WA_GREEN,
                    boxShadow: `0 8px 20px ${hexA(WA_DARK, 0.35)}`,
                    '&:hover, &:active': { bgcolor: WA_DARK }
                  }}
                >
                  <IconPlus size={19} />
                  Blocos
                </Fab>
              ) : null}

              {/* inspetor (desktop: painel lateral deslizante) */}
              {!downSm ? (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: INSPECTOR_W,
                    maxWidth: '100%',
                    bgcolor: 'background.default',
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                    boxShadow: selectedNode ? '-8px 0 24px rgba(0,0,0,0.14)' : 'none',
                    transform: selectedNode ? 'translateX(0)' : 'translateX(105%)',
                    transition: 'transform .22s ease',
                    zIndex: 5,
                    pointerEvents: selectedNode ? 'auto' : 'none'
                  }}
                >
                  {selectedNode ? (
                    <BotInspector
                      node={selectedNode}
                      onChange={updateNodeData}
                      onDelete={deleteNode}
                      onDuplicate={duplicateNode}
                      onClose={closeInspector}
                      onOpenSettings={() => setTab('settings')}
                    />
                  ) : null}
                </Box>
              ) : null}
            </Box>

            {simOpen && !downSm ? (
              <Box sx={{ width: 360, flexShrink: 0, borderLeft: '1px solid', borderColor: 'divider', minWidth: 0 }}>
                <BotSimulator getPayload={getPayload} flowSig={flowKey} onClose={() => setSimOpen(false)} onCurrentNode={setSimNodeId} />
              </Box>
            ) : null}
          </Box>
        )}

        {/* celular: inspetor do bloco em tela cheia */}
        {downSm ? (
          <Dialog
            fullScreen
            open={Boolean(selectedNode) && inspectorOpen && tab === 'flow'}
            onClose={closeInspector}
            slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}
          >
            {selectedNode ? (
              <BotInspector
                node={selectedNode}
                onChange={updateNodeData}
                onDelete={deleteNode}
                onDuplicate={duplicateNode}
                onClose={closeInspector}
                onOpenSettings={() => {
                  setInspectorOpen(false);
                  setTab('settings');
                }}
              />
            ) : null}
          </Dialog>
        ) : null}

        {/* celular: simulador em tela cheia */}
        {downSm && simOpen ? (
          <Dialog fullScreen open onClose={() => setSimOpen(false)}>
            <BotSimulator getPayload={getPayload} flowSig={flowKey} onClose={() => setSimOpen(false)} onCurrentNode={setSimNodeId} />
          </Dialog>
        ) : null}

        {/* celular: gaveta inferior com os blocos */}
        {downSm ? (
          <Drawer
            anchor="bottom"
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            slotProps={{
              paper: {
                sx: {
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                  maxHeight: '82dvh',
                  bgcolor: 'background.default',
                  backgroundImage: 'none'
                }
              }
            }}
          >
            <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: 1 }} />
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, pt: 1, pb: 0.75, flexShrink: 0 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Adicionar bloco</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.35 }}>
                  {chainAfter
                    ? `Entra logo depois de “${chainAfter.type === 'start' ? 'Início' : chainAfter.data?.title || NODE_META[chainAfter.type]?.label}”.`
                    : 'Toque num bloco para colocá-lo no canvas.'}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setPaletteOpen(false)} aria-label="Fechar" sx={{ width: 40, height: 40 }}>
                <IconX size={18} />
              </IconButton>
            </Stack>
            <Box sx={{ overflowY: 'auto', overscrollBehavior: 'contain', px: 2, pb: 'calc(16px + env(safe-area-inset-bottom))' }}>
              <PaletteList grid onAdd={addFromDrawer} />
            </Box>
          </Drawer>
        ) : null}
      </BotProvider>

      {/* menu "criar próximo bloco" ao soltar a conexão no vazio */}
      <Menu
        open={Boolean(connectMenu)}
        onClose={() => setConnectMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={connectMenu ? { top: connectMenu.y, left: connectMenu.x } : undefined}
        slotProps={{ paper: { sx: { borderRadius: 2.5, minWidth: 250, py: 0.25 } } }}
      >
        <Typography variant="caption" sx={{ px: 2, pt: 0.75, pb: 0.5, display: 'block', color: 'text.secondary', fontWeight: 700 }}>
          Criar o próximo bloco
        </Typography>
        {PALETTE_GROUPS.flatMap((g) => g.items).map((type) => {
          const m = NODE_META[type];
          const I = m.icon;
          return (
            <MenuItem
              key={type}
              dense
              onClick={() => {
                const c = connectMenu;
                setConnectMenu(null);
                if (!c) return;
                const p = rf.screenToFlowPosition({ x: c.x, y: c.y });
                addNode(type, { x: p.x + 8, y: p.y - 23 }, { source: c.source, sourceHandle: c.sourceHandle });
              }}
            >
              <ListItemIcon>
                <Box
                  sx={{ width: 24, height: 24, borderRadius: 1.25, display: 'grid', placeItems: 'center', color: '#fff', bgcolor: m.color }}
                >
                  <I size={14} />
                </Box>
              </ListItemIcon>
              <ListItemText primary={m.label} primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }} />
            </MenuItem>
          );
        })}
      </Menu>

      <IssuesPopover anchorEl={issuesEl} onClose={() => setIssuesEl(null)} issues={issues} nodes={nodes} onPick={focusIssue} />

      <ActivationDialog
        state={actDialog}
        busy={actBusy}
        onClose={() => setActDialog(null)}
        onConfirm={confirmToggle}
        settings={settings}
        issues={issues}
        flowName={meta.name || 'Fluxo do bot'}
        flowSessions={flowSessions}
      />

      <Dialog
        open={confirmOverwrite}
        onClose={() => setConfirmOverwrite(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
            Substituir o fluxo salvo?
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Não conseguimos carregar o fluxo que está salvo no servidor. Se salvar agora, ele será substituído pelo que está na tela. Se
            preferir, tente carregar de novo antes.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            color="inherit"
            onClick={() => {
              setConfirmOverwrite(false);
              load();
            }}
            sx={{ textTransform: 'none' }}
          >
            Carregar de novo
          </Button>
          <Button
            variant="contained"
            color="warning"
            disableElevation
            onClick={() => {
              setConfirmOverwrite(false);
              saveNow({ manual: true });
            }}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            Salvar mesmo assim
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// =============================================================================
// Página: lista de fluxos + fluxo aberto (?flow=<id>)
// =============================================================================
function BotPage() {
  const { user } = useAuth();
  const canManage = MANAGERS.includes(user?.user?.role);
  const { sessions, byId, connected: anyConnected, loading: sessionsLoading, reload: reloadSessions } = useWaSessions(30000);
  const [searchParams, setSearchParams] = useSearchParams();
  const flowParam = searchParams.get('flow') || '';
  // `setSearchParams` muda de identidade a cada mudança de URL → ref para manter os callbacks estáveis
  const setParamsRef = useRef(setSearchParams);
  setParamsRef.current = setSearchParams;

  const [flows, setFlows] = useState(null); // null = carregando
  const [flowsError, setFlowsError] = useState(null);
  const [form, setForm] = useState(null); // { mode, flow? }
  const [formBusy, setFormBusy] = useState(false);
  const [assign, setAssign] = useState(null); // { flow, preselect? }
  const [assignBusy, setAssignBusy] = useState(false);
  const [del, setDel] = useState(null); // flow
  const [delBusy, setDelBusy] = useState(false);
  const seq = useRef(0);
  const rtTimer = useRef(null);

  // --------------------------------------------------------------- lista
  const loadFlows = useCallback(async ({ silent = false } = {}) => {
    const s = ++seq.current;
    try {
      const r = await get('/whatsapp/bot/flows');
      if (s !== seq.current) return;
      setFlows(asList(r));
      setFlowsError(null);
    } catch (e) {
      if (s !== seq.current) return;
      if (!silent) setFlowsError(botErr(e, 'Não foi possível carregar os fluxos do bot.'));
      setFlows((p) => p || []);
    }
  }, []);
  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  // stats/números a cada 60 s com a aba visível
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') loadFlows({ silent: true });
    }, FLOWS_POLL_MS);
    return () => clearInterval(id);
  }, [loadFlows]);

  // número criado/removido/alterado (ex.: fluxo trocado em Configurações) → lista na hora (com folga de 400 ms)
  const rtReload = useCallback(() => {
    if (rtTimer.current) clearTimeout(rtTimer.current);
    rtTimer.current = setTimeout(() => loadFlows({ silent: true }), 400);
  }, [loadFlows]);
  useRealtimeEvent('wa:sessions', rtReload);
  useRealtimeEvent('wa:session', rtReload);
  useEffect(() => () => rtTimer.current && clearTimeout(rtTimer.current), []);

  const patchFlow = useCallback((r) => {
    if (!r?.id) return;
    setFlows((p) => (p || []).map((f) => (f.id === r.id ? { ...f, ...flowListFields(r) } : f)));
  }, []);

  // --------------------------------------------------------------- seleção (URL)
  const selectFlow = useCallback(
    (id, { replace = false } = {}) =>
      setParamsRef.current(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (id) n.set('flow', id);
          else n.delete('flow');
          return n;
        },
        { replace }
      ),
    []
  );
  const selected = useMemo(() => (flows || []).find((f) => f.id === flowParam) || null, [flows, flowParam]);
  useEffect(() => {
    if (!flows) return;
    if (flowParam && flows.some((f) => f.id === flowParam)) return;
    const pick = flows.find((f) => f.active && f.sessions?.length) || flows.find((f) => f.sessions?.length) || flows[0];
    if (pick) selectFlow(pick.id, { replace: true });
    else if (flowParam) selectFlow(null, { replace: true });
  }, [flows, flowParam, selectFlow]);

  const onGone = useCallback(
    (id) => {
      toast.error('Este fluxo não existe mais.');
      setFlows((p) => (p || []).filter((f) => f.id !== id));
      selectFlow(null, { replace: true });
      loadFlows({ silent: true });
      reloadSessions();
    },
    [selectFlow, loadFlows, reloadSessions]
  );

  // --------------------------------------------------------------- ações
  const submitForm = async ({ mode, name, clone_of, flow }) => {
    setFormBusy(true);
    try {
      if (mode === 'rename') {
        const r = await put(flowUrl(flow.id), { name });
        patchFlow(r);
        toast.success('Fluxo renomeado.');
      } else {
        const body = clone_of ? { name, clone_of } : { name, ...defaultPayload() };
        const r = await post('/whatsapp/bot/flows', body);
        if (r?.id) {
          setFlows((p) => [
            ...(p || []),
            { sessions: [], stats: { active_sessions: 0, started_24h: 0, handoffs_24h: 0 }, ...flowListFields(r), id: r.id }
          ]);
          selectFlow(r.id);
        } else loadFlows({ silent: true });
        toast.success(mode === 'duplicate' ? 'Fluxo duplicado.' : 'Fluxo criado! Ele nasce desligado e em Modo teste.');
      }
      setForm(null);
    } catch (e) {
      toast.error(botErr(e, 'Não foi possível salvar o fluxo.'));
    } finally {
      setFormBusy(false);
    }
  };

  const submitAssign = async (ids) => {
    if (!assign?.flow) return;
    setAssignBusy(true);
    try {
      const r = await put(`${flowUrl(assign.flow.id)}/sessions`, { session_ids: ids });
      patchFlow(r);
      toast.success(ids.length ? `Fluxo atribuído a ${ids.length} ${ids.length === 1 ? 'número' : 'números'}.` : 'Fluxo sem números.');
      setAssign(null);
      // os outros fluxos também mudam (número sai de um e entra no outro)
      loadFlows({ silent: true });
      reloadSessions();
    } catch (e) {
      toast.error(botErr(e, 'Não foi possível atribuir os números.'));
    } finally {
      setAssignBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!del) return;
    setDelBusy(true);
    try {
      await remove(flowUrl(del.id));
      toast.success(`Fluxo “${del.name}” excluído.`);
      setFlows((p) => (p || []).filter((f) => f.id !== del.id));
      if (flowParam === del.id) selectFlow(null, { replace: true });
      setDel(null);
      reloadSessions();
    } catch (e) {
      toast.error(botErr(e, 'Não foi possível excluir o fluxo.'));
    } finally {
      setDelBusy(false);
    }
  };

  const openAssign = useCallback(
    (flow, preselect) => {
      if (!canManage) {
        toast.error('Só administradores atribuem números a um fluxo.');
        return;
      }
      if (!flow) return;
      setAssign({ flow, preselect: preselect || [] });
    },
    [canManage]
  );

  // números conectados sem fluxo
  const unassigned = useMemo(() => sessions.filter((s) => (s.connected || s.status === 'ready') && !s.bot_flow_id), [sessions]);
  const noConnection = !sessionsLoading && !anyConnected;
  const bannerKey = `${unassigned.length}|${noConnection ? 1 : 0}|${flows?.length || 0}`;
  const canCreate = (flows?.length || 0) < MAX_FLOWS;

  // --------------------------------------------------------------- render
  return (
    <Box>
      <WaPageHeader
        icon={IconRobot}
        title="Fluxo do Bot"
        subtitle="Monte o atendimento automático do seu WhatsApp: mensagens, opções, perguntas, cobrança PIX e transferência para atendentes. Cada número usa um fluxo."
        sx={{ mb: 2 }}
        action={
          flows && flows.length ? (
            <Tooltip title={canCreate ? '' : `Limite de ${MAX_FLOWS} fluxos por organização.`}>
              <span>
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<IconPlus size={18} />}
                  disabled={!canCreate}
                  onClick={() => setForm({ mode: 'create' })}
                  sx={{ ...waButtonSx, whiteSpace: 'nowrap' }}
                >
                  Novo fluxo
                </Button>
              </span>
            </Tooltip>
          ) : null
        }
      />

      {flowsError ? (
        <Alert
          severity="warning"
          sx={{ mb: 1.5, borderRadius: 2, py: 0.25 }}
          action={
            <Button color="inherit" size="small" onClick={() => loadFlows()} sx={{ fontWeight: 700, textTransform: 'none' }}>
              Tentar de novo
            </Button>
          }
        >
          {flowsError}
        </Alert>
      ) : null}

      {noConnection ? (
        <Alert
          severity="info"
          icon={<IconDeviceMobile size={20} />}
          sx={{ mb: 1.5, borderRadius: 2, py: 0.25 }}
          action={
            <Button
              component={RouterLink}
              to="/whatsapp/settings"
              color="inherit"
              size="small"
              sx={{ fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}
            >
              Conectar
            </Button>
          }
        >
          Nenhum número do WhatsApp está conectado. Você pode montar e testar os fluxos, mas o bot só responde clientes por um número
          conectado.
        </Alert>
      ) : null}

      {flows && flows.length ? (
        <UnassignedBanner
          sessions={unassigned}
          canManage={canManage}
          sx={{ mb: 1.5 }}
          onAssign={() =>
            openAssign(
              selected || flows[0],
              unassigned.map((s) => s.id)
            )
          }
        />
      ) : null}

      {flows === null ? (
        <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 10 }}>
          <CircularProgress sx={{ color: WA_GREEN }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Carregando os fluxos…
          </Typography>
        </Stack>
      ) : !flows.length ? (
        <TgEmptyState
          icon={IconRobot}
          title="Nenhum fluxo do bot ainda"
          description={
            unassigned.length
              ? `Você tem ${unassigned.length === 1 ? 'um número conectado' : `${unassigned.length} números conectados`}. Crie o primeiro fluxo (ele nasce com boas-vindas → menu → atendente, desligado e em Modo teste) e escolha em quais números ele responde.`
              : 'Crie o primeiro fluxo: ele nasce com boas-vindas → menu → atendente, desligado e em Modo teste. Depois escolha quais números do WhatsApp usam o fluxo.'
          }
          action={
            <Button
              variant="contained"
              disableElevation
              size="large"
              startIcon={<IconPlus size={18} />}
              onClick={() => setForm({ mode: 'create' })}
              sx={waButtonSx}
            >
              Criar primeiro fluxo
            </Button>
          }
        />
      ) : (
        <>
          <FlowStrip
            flows={flows}
            selectedId={selected?.id || null}
            onSelect={(id) => selectFlow(id)}
            onCreate={() => setForm({ mode: 'create' })}
            canCreate={canCreate}
            sx={{ mb: 1.5 }}
          />
          {selected ? (
            <BotBuilder
              key={selected.id}
              flowId={selected.id}
              flow={selected}
              allSessions={sessions}
              byId={byId}
              anyConnected={anyConnected}
              canManage={canManage}
              bannerKey={bannerKey}
              onFlowChanged={patchFlow}
              onManageSessions={() => openAssign(selected)}
              onRename={() => setForm({ mode: 'rename', flow: selected })}
              onDuplicate={() =>
                canCreate ? setForm({ mode: 'duplicate', flow: selected }) : toast.error(`Limite de ${MAX_FLOWS} fluxos.`)
              }
              onDelete={() => (canManage ? setDel(selected) : toast.error('Só administradores excluem fluxos.'))}
              onGone={onGone}
            />
          ) : null}
        </>
      )}

      <FlowFormDialog state={form} flows={flows || []} busy={formBusy} onClose={() => !formBusy && setForm(null)} onSubmit={submitForm} />

      <AssignNumbersDialog
        flow={assign?.flow || null}
        preselect={assign?.preselect}
        flows={flows || []}
        sessions={sessions}
        busy={assignBusy}
        onClose={() => !assignBusy && setAssign(null)}
        onSubmit={submitAssign}
      />

      <TgConfirmDialog
        open={Boolean(del)}
        onClose={() => !delBusy && setDel(null)}
        onConfirm={confirmDelete}
        loading={delBusy}
        danger
        icon={IconTrash}
        title={del ? `Excluir o fluxo “${del.name}”?` : 'Excluir fluxo?'}
        message={
          del?.sessions?.length
            ? `${del.sessions.length === 1 ? 'O número' : 'Os números'} ${del.sessions.map((s) => s.label || s.phone || 'Número').join(', ')} ${del.sessions.length === 1 ? 'fica' : 'ficam'} sem bot, e as conversas que ele estava conduzindo são encerradas. Isso não pode ser desfeito.`
            : 'Os blocos e as configurações deste fluxo serão apagados. Isso não pode ser desfeito.'
        }
        confirmLabel="Excluir fluxo"
      />
    </Box>
  );
}

export default function WhatsAppBot() {
  return (
    <ReactFlowProvider>
      <BotPage />
    </ReactFlowProvider>
  );
}
