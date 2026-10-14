// =============================================================================
// WhatsApp — Fluxo do Bot: átomos de UI compartilhados (construtor, inspetor,
// simulador e aba Configurações). Cores fixas do WhatsApp com override dark
// via applyStyles; tokens do tema via theme.vars (NUNCA theme.palette em sx).
// =============================================================================
import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
  createFilterOptions,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  IconArrowsExchange,
  IconArrowsSplit2,
  IconCalendarEvent,
  IconCalendarPlus,
  IconClipboardList,
  IconClockPlus,
  IconCreditCard,
  IconFileInvoice,
  IconFlag3,
  IconHeadset,
  IconHourglass,
  IconListNumbers,
  IconMessage2,
  IconMessageQuestion,
  IconMoodSmile,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconQrcode,
  IconReceipt,
  IconReceipt2,
  IconShoppingCart,
  IconTags,
  IconTicket,
  IconUserEdit,
  IconUserPlus,
  IconUserSearch,
  IconUserX,
  IconX
} from '@tabler/icons-react';

import { get } from 'api/api';
import { EmojiPicker } from '../waShared';
import { BASE_VARS, fmtBRL } from './botModel';

export const WA_GREEN = '#25D366';
export const WA_DARK = '#128C7E';
export const WA_TEAL = '#075E54';
export const WA_GRADIENT = `linear-gradient(135deg, ${WA_GREEN} 0%, ${WA_DARK} 100%)`;
// texto de destaque que troca no dark (definido em BotFlowStyles via [data-color-scheme])
export const WA_ACCENT = 'var(--wa-accent, #128C7E)';
export const WA_TOKEN = 'var(--wa-token, #0B6B61)';
export const WA_WARN = 'var(--wa-warn, #B45309)';
export const WA_OK = 'var(--wa-ok, #15803D)';

// hex → rgba (cores fixas valem nos dois temas)
export const hexA = (hex, a) => {
  const h = String(hex || '#000000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
export const tint = (t, token, a) => `rgba(${t.vars.palette[token].mainChannel} / ${a})`;
// valor light + override dark (cores reais do WhatsApp)
export const dual = (light, dark) => (t) => ({ ...light, ...t.applyStyles('dark', dark) });

export const WA_COLORS = {
  wallpaper: ['#efeae2', '#0b141a'],
  out: ['#d9fdd3', '#005c4b'], // balão enviado (o bot, visto do painel)
  in: ['#ffffff', '#202c33'], // balão recebido
  text: ['#111b21', '#e9edef'],
  meta: ['rgba(17,27,33,0.5)', 'rgba(233,237,239,0.6)']
};
export const waBg = (key) => dual({ bgcolor: WA_COLORS[key][0] }, { bgcolor: WA_COLORS[key][1] });
export const waFg = (key) => dual({ color: WA_COLORS[key][0] }, { color: WA_COLORS[key][1] });

export const TONE = {
  good: '#16A34A',
  bad: '#EA580C',
  neutral: '#1FA855'
};

// ---------------------------------------------------------------------------
// Metadados visuais de cada bloco
// ---------------------------------------------------------------------------
export const NODE_META = {
  start: { label: 'Início', color: WA_GREEN, icon: IconPlayerPlay, hint: 'Quando o cliente manda mensagem' },
  message: { label: 'Mensagem', color: '#1FA855', icon: IconMessage2, hint: 'Texto, foto, vídeo ou áudio' },
  menu: { label: 'Opções numeradas', color: '#0EA5E9', icon: IconListNumbers, hint: 'O cliente escolhe um número' },
  question: { label: 'Pergunta', color: '#8B5CF6', icon: IconMessageQuestion, hint: 'Guarda a resposta do cliente' },
  condition: { label: 'Condição', color: '#F59E0B', icon: IconArrowsSplit2, hint: 'Caminho Sim ou Não' },
  tags: { label: 'Etiquetas', color: '#EC4899', icon: IconTags, hint: 'Marca ou desmarca o contato' },
  wait: { label: 'Espera', color: '#64748B', icon: IconHourglass, hint: 'Pausa antes de continuar' },
  pix: { label: 'Cobrança PIX', color: '#0D9488', icon: IconQrcode, hint: 'Gera o PIX e aguarda' },
  handoff: { label: 'Transferir para atendente', color: '#2563EB', icon: IconHeadset, hint: 'Passa para uma pessoa' },
  end: { label: 'Encerrar', color: '#DC2626', icon: IconFlag3, hint: 'Finaliza o atendimento' },
  // --- Cliente (CRM / assinaturas) — família roxo → índigo → teal
  crm_identify: { label: 'Identificar cliente', color: '#6D28D9', icon: IconUserSearch, hint: 'Pelo número, CPF/CNPJ ou código' },
  crm_register: { label: 'Cadastrar cliente', color: '#7C3AED', icon: IconUserPlus, hint: 'Pergunta os dados e cria o cadastro' },
  crm_subscribe: { label: 'Assinar plano', color: '#4F46E5', icon: IconCreditCard, hint: 'Escolhe o plano, cobra e ativa' },
  crm_info: { label: 'Informar situação', color: '#4338CA', icon: IconFileInvoice, hint: 'Plano, vencimento, dados…' },
  crm_invoice: { label: '2ª via da cobrança', color: '#0E7490', icon: IconReceipt2, hint: 'Reenvia a cobrança em aberto' },
  crm_cancel: { label: 'Cancelar assinatura', color: '#BE185D', icon: IconUserX, hint: 'Motivo, retenção e confirmação' },
  crm_pause: { label: 'Pausar assinatura', color: '#0F766E', icon: IconPlayerPause, hint: 'Pausa por alguns dias' },
  crm_change_plan: { label: 'Trocar de plano', color: '#5B21B6', icon: IconArrowsExchange, hint: 'Migra para outro produto' },
  crm_update: { label: 'Atualizar dados', color: '#6366F1', icon: IconUserEdit, hint: 'Altera e-mail, endereço…' },
  // --- Agenda (Fase 6) — família laranja/âmbar
  book_service: { label: 'Agendar', color: '#EA580C', icon: IconCalendarPlus, hint: 'Serviço, dia, horário e pagamento' },
  my_appointments: { label: 'Meus agendamentos', color: '#C2410C', icon: IconCalendarEvent, hint: 'Confirmar, remarcar ou cancelar' },
  waitlist_join: { label: 'Lista de espera', color: '#B45309', icon: IconClockPlus, hint: 'Avisa quando abrir um horário' },
  // --- Chamados (Fase 6B) — família azul-ardósia
  open_ticket: { label: 'Abrir chamado', color: '#0369A1', icon: IconTicket, hint: 'Categoria, descrição, fotos e protocolo' },
  my_tickets: { label: 'Meus chamados', color: '#1E40AF', icon: IconClipboardList, hint: 'Consultar protocolo e mandar mais informações' },
  // --- Pedidos (Fase 7) — família verde-limão
  order_cart: { label: 'Fazer pedido', color: '#65A30D', icon: IconShoppingCart, hint: 'Catálogo, carrinho, entrega e pagamento' },
  my_orders: { label: 'Meus pedidos', color: '#4D7C0F', icon: IconReceipt, hint: 'Situação dos pedidos do cliente' }
};

export const PALETTE_GROUPS = [
  { group: 'Mensagens', items: ['message', 'menu', 'question'] },
  { group: 'Lógica', items: ['condition', 'tags', 'wait'] },
  { group: 'Vendas', items: ['pix'] },
  {
    group: 'Cliente',
    items: [
      'crm_identify',
      'crm_register',
      'crm_subscribe',
      'crm_info',
      'crm_invoice',
      'crm_cancel',
      'crm_pause',
      'crm_change_plan',
      'crm_update'
    ]
  },
  { group: 'Agenda', items: ['book_service', 'my_appointments', 'waitlist_join'] },
  { group: 'Chamados', items: ['open_ticket', 'my_tickets'] },
  { group: 'Pedidos', items: ['order_cart', 'my_orders'] },
  { group: 'Atendimento', items: ['handoff', 'end'] }
];

export const TAG_COLORS = ['#25D366', '#0EA5E9', '#8B5CF6', '#F59E0B', '#EC4899', '#EF4444', '#14B8A6', '#6366F1', '#84CC16', '#F97316'];

// ---------------------------------------------------------------------------
// Contexto do construtor (catálogos + ações p/ nós/edges)
// ---------------------------------------------------------------------------
const BotCtx = createContext({
  tags: [],
  tagsById: new Map(),
  attendants: [],
  gateway: null,
  products: null, // GET /whatsapp/products (null = ainda carregando)
  crmSettings: null, // GET /whatsapp/crm-settings → { custom_fields (lista de CLIENTES), custom_field_map (por entidade), identity }
  customFieldMap: null, // mapa de campos personalizados por entidade (null = carregando)
  orderCatalog: { catalog: null, categories: null, settings: null }, // GET /whatsapp/orders/catalog + settings
  catalogCategories: null, // nomes das categorias do catálogo de pedidos (null = carregando)
  settings: null,
  vars: [],
  issuesByNode: {},
  simNodeId: null,
  actions: {}
});
export const BotProvider = ({ value, children }) => <BotCtx.Provider value={value}>{children}</BotCtx.Provider>;
export const useBot = () => useContext(BotCtx);

// ---------------------------------------------------------------------------
// Catálogo da agenda (Fase 6): serviços e profissionais/recursos para os blocos de agenda,
// buscado uma vez e guardado por 60 s (GET /whatsapp/scheduling/services | /resources).
// null = ainda carregando OU agenda indisponível (não valida nada); [] = carregado e vazio.
// ---------------------------------------------------------------------------
const bookCatalog = { services: null, resources: null, at: 0, p: null };
const asList = (r) => (Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : Array.isArray(r?.services) ? r.services : null);
export function useBookCatalog() {
  const [st, setSt] = useState({ services: bookCatalog.services, resources: bookCatalog.resources });
  useEffect(() => {
    let alive = true;
    if (!bookCatalog.p || Date.now() - bookCatalog.at > 60_000) {
      bookCatalog.at = Date.now();
      bookCatalog.p = Promise.all([
        get('/whatsapp/scheduling/services').catch(() => null),
        get('/whatsapp/scheduling/resources').catch(() => null)
      ]).then(([sv, rs]) => {
        bookCatalog.services = asList(sv);
        bookCatalog.resources = asList(rs);
        return bookCatalog;
      });
    }
    bookCatalog.p.then(() => {
      if (alive) setSt({ services: bookCatalog.services, resources: bookCatalog.resources });
    });
    return () => {
      alive = false;
    };
  }, []);
  return st;
}

// ---------------------------------------------------------------------------
// Catálogo dos chamados (Fase 6B): categorias da organização para os blocos de chamado,
// buscado uma vez e guardado por 60 s (GET /whatsapp/tickets/settings → categories).
// null = ainda carregando OU chamados indisponíveis (não valida nada); [] = carregado e vazio.
// ---------------------------------------------------------------------------
const ticketCatalog = { categories: null, at: 0, p: null };
export function useTicketCatalog() {
  const [st, setSt] = useState({ categories: ticketCatalog.categories });
  useEffect(() => {
    let alive = true;
    if (!ticketCatalog.p || Date.now() - ticketCatalog.at > 60_000) {
      ticketCatalog.at = Date.now();
      ticketCatalog.p = get('/whatsapp/tickets/settings')
        .catch(() => null)
        .then((r) => {
          ticketCatalog.categories = Array.isArray(r?.categories) ? r.categories : null;
          return ticketCatalog;
        });
    }
    ticketCatalog.p.then(() => {
      if (alive) setSt({ categories: ticketCatalog.categories });
    });
    return () => {
      alive = false;
    };
  }, []);
  return st;
}

// ---------------------------------------------------------------------------
// Catálogo de pedidos (Fase 7): produtos avulsos ativos por categoria + configurações de pedidos,
// buscados uma vez e guardados por 60 s (GET /whatsapp/orders/catalog | /whatsapp/orders/settings).
// `catalog` null = ainda carregando OU pedidos indisponíveis (não valida nada); `categories` = nomes.
// ---------------------------------------------------------------------------
const orderCatalog = { catalog: null, categories: null, settings: null, at: 0, p: null };
export function useOrderCatalog() {
  const [st, setSt] = useState({ catalog: orderCatalog.catalog, categories: orderCatalog.categories, settings: orderCatalog.settings });
  useEffect(() => {
    let alive = true;
    if (!orderCatalog.p || Date.now() - orderCatalog.at > 60_000) {
      orderCatalog.at = Date.now();
      orderCatalog.p = Promise.all([
        get('/whatsapp/orders/catalog').catch(() => null),
        get('/whatsapp/orders/settings').catch(() => null)
      ]).then(([cat, set]) => {
        const cats = Array.isArray(cat?.categories) ? cat.categories.filter((c) => c && String(c.name || '').trim()) : null;
        orderCatalog.catalog = cats ? { categories: cats, total: Number(cat?.total) || 0 } : null;
        orderCatalog.categories = cats ? cats.map((c) => String(c.name).trim()) : null;
        orderCatalog.settings = set && typeof set === 'object' ? set : null;
        return orderCatalog;
      });
    }
    orderCatalog.p.then(() => {
      if (alive) setSt({ catalog: orderCatalog.catalog, categories: orderCatalog.categories, settings: orderCatalog.settings });
    });
    return () => {
      alive = false;
    };
  }, []);
  return st;
}

// ---------------------------------------------------------------------------
// Texto no estilo WhatsApp: *negrito* _itálico_ ~riscado~ ```mono``` + {{variáveis}}
// ---------------------------------------------------------------------------
const FMT_RE = /(\{\{\s*[\w.]+\s*\}\}|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|```[^`]+```)/g;

export function VarToken({ name }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline',
        px: 0.5,
        py: '1px',
        borderRadius: 1,
        fontSize: '0.92em',
        fontWeight: 700,
        color: WA_TOKEN,
        bgcolor: hexA(WA_GREEN, 0.18),
        whiteSpace: 'nowrap'
      }}
    >
      {`{{${name}}}`}
    </Box>
  );
}

export function WaText({ text, vars = false, sx }) {
  const parts = String(text || '').split(FMT_RE);
  return (
    <Box component="span" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...sx }}>
      {parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith('{{') && p.endsWith('}}')) {
          const name = p.slice(2, -2).trim();
          return vars ? <VarToken key={i} name={name} /> : <Fragment key={i}>{p}</Fragment>;
        }
        if (p.length > 2 && p.startsWith('*') && p.endsWith('*')) return <b key={i}>{p.slice(1, -1)}</b>;
        if (p.length > 2 && p.startsWith('_') && p.endsWith('_')) return <i key={i}>{p.slice(1, -1)}</i>;
        if (p.length > 2 && p.startsWith('~') && p.endsWith('~')) return <s key={i}>{p.slice(1, -1)}</s>;
        if (p.length > 6 && p.startsWith('```') && p.endsWith('```'))
          return (
            <Box key={i} component="span" sx={{ fontFamily: 'monospace', fontSize: '0.92em' }}>
              {p.slice(3, -3)}
            </Box>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------
export function TagChip({ tag, prefix, size = 'sm', onDelete, missing }) {
  const color = missing ? '#94A3B8' : tag?.color || WA_GREEN;
  const small = size === 'sm';
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        maxWidth: '100%',
        pl: small ? 0.75 : 1,
        pr: onDelete ? 0.25 : small ? 0.85 : 1.1,
        py: small ? 0.2 : 0.35,
        borderRadius: 5,
        fontSize: small ? 11 : 12.5,
        fontWeight: 700,
        lineHeight: 1.3,
        color,
        bgcolor: hexA(color, 0.14),
        border: `1px solid ${hexA(color, 0.35)}`,
        textDecoration: missing ? 'line-through' : 'none'
      }}
    >
      {prefix ? <Box component="span">{prefix}</Box> : null}
      <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {missing ? 'Etiqueta removida' : tag?.name}
      </Box>
      {onDelete ? (
        <Box
          component="span"
          role="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onDelete}
          sx={{ ml: 0.25, px: 0.4, cursor: 'pointer', opacity: 0.7, '&:hover': { opacity: 1 } }}
        >
          ×
        </Box>
      ) : null}
    </Box>
  );
}

const tagFilter = createFilterOptions({ stringify: (o) => o.name || '' });

/**
 * Seletor de etiquetas com criação inline.
 * value: string[] (multiple) | string|null (single)
 */
export function TagSelect({ value, onChange, multiple = true, label, placeholder, helperText, size = 'small', disabled }) {
  const { tags, tagsById, createTag } = useBot();
  const [creating, setCreating] = useState(false);
  const ids = multiple ? value || [] : value ? [value] : [];
  const selected = ids.map((id) => tagsById.get(id) || { id, name: 'Etiqueta removida', color: '#94A3B8', missing: true });

  const handle = async (_, v) => {
    const list = multiple ? v : v ? [v] : [];
    const last = list[list.length - 1];
    if (last && last.__create) {
      if (!createTag) return;
      setCreating(true);
      const t = await createTag(last.__create);
      setCreating(false);
      if (!t) return;
      const rest = list.slice(0, -1).map((x) => x.id);
      onChange(multiple ? [...new Set([...rest, t.id])] : t.id);
      return;
    }
    onChange(multiple ? list.map((x) => x.id) : last?.id || null);
  };

  return (
    <Autocomplete
      multiple={multiple}
      size={size}
      disabled={disabled}
      options={tags}
      value={multiple ? selected : selected[0] || null}
      onChange={handle}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      getOptionLabel={(o) => (o.__create ? o.__create : o.name || '')}
      filterOptions={(opts, params) => {
        const filtered = tagFilter(opts, params);
        const q = params.inputValue.trim();
        if (q && createTag && !opts.some((o) => o.name.toLowerCase() === q.toLowerCase()))
          filtered.push({ id: `__create_${q}`, __create: q.slice(0, 40), name: q });
        return filtered;
      }}
      renderOption={(props, o) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {o.__create ? (
              <>
                <IconPlus size={15} />
                <Typography variant="body2">
                  Criar etiqueta <b>“{o.__create}”</b>
                </Typography>
              </>
            ) : (
              <>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: o.color || WA_GREEN, flexShrink: 0 }} />
                <Typography variant="body2">{o.name}</Typography>
              </>
            )}
          </Box>
        );
      }}
      renderTags={(vals, getTagProps) =>
        vals.map((t, i) => {
          const { key, onDelete } = getTagProps({ index: i });
          return (
            <Box key={key} sx={{ m: 0.25, maxWidth: '100%' }}>
              <TagChip tag={t} missing={t.missing} onDelete={onDelete} size="md" />
            </Box>
          );
        })
      }
      noOptionsText={tags.length ? 'Nenhuma etiqueta encontrada' : 'Digite um nome para criar a primeira etiqueta'}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={ids.length && multiple ? '' : placeholder}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {creating ? <CircularProgress size={16} sx={{ color: WA_DARK }} /> : null}
                {params.InputProps.endAdornment}
              </>
            )
          }}
        />
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Palavras-chave (chips; Enter / vírgula / sair do campo adiciona)
// ---------------------------------------------------------------------------
export function KeywordsInput({ value, onChange, label, placeholder, helperText, normalize = (s) => s.trim().toLowerCase() }) {
  const [input, setInput] = useState('');
  const list = value || [];
  const addMany = (raw) => {
    const extra = String(raw || '')
      .split(',')
      .map((s) => normalize(s))
      .filter(Boolean);
    if (!extra.length) return;
    onChange([...new Set([...list, ...extra])]);
  };
  return (
    <Autocomplete
      multiple
      freeSolo
      size="small"
      options={[]}
      value={list}
      inputValue={input}
      onInputChange={(_, v, reason) => {
        if (reason === 'reset') return;
        if (v.includes(',')) {
          addMany(v);
          setInput('');
        } else setInput(v);
      }}
      onChange={(_, v) => {
        onChange([...new Set(v.map((s) => normalize(String(s))).filter(Boolean))]);
        setInput('');
      }}
      onBlur={() => {
        if (input.trim()) {
          addMany(input);
          setInput('');
        }
      }}
      renderTags={(vals, getTagProps) =>
        vals.map((v, i) => {
          const { key, ...rest } = getTagProps({ index: i });
          return <Chip key={key} size="small" label={v} {...rest} sx={{ fontWeight: 600, borderRadius: 1.5 }} />;
        })
      }
      renderInput={(params) => <TextField {...params} label={label} placeholder={list.length ? '' : placeholder} helperText={helperText} />}
    />
  );
}

// ---------------------------------------------------------------------------
// Campo de texto com chips de variáveis + emoji (insere no cursor)
// ---------------------------------------------------------------------------
export function VarTextField({
  value,
  onChange,
  label,
  placeholder,
  minRows = 2,
  maxRows = 10,
  extraVars = [],
  helperText,
  maxLength = 4000,
  single = false,
  showFormatHint = true
}) {
  const { vars } = useBot();
  const ref = useRef(null);
  const [emojiEl, setEmojiEl] = useState(null);
  const all = useMemo(() => {
    const list = [...BASE_VARS, ...extraVars, ...(vars || []).map((k) => ({ key: k, label: k }))];
    const seen = new Set();
    return list.filter((v) => (seen.has(v.key) ? false : seen.add(v.key)));
  }, [vars, extraVars]);

  const insert = (token) => {
    const el = ref.current;
    const v = value || '';
    const s = el && typeof el.selectionStart === 'number' ? el.selectionStart : v.length;
    const e = el && typeof el.selectionEnd === 'number' ? el.selectionEnd : v.length;
    const next = `${v.slice(0, s)}${token}${v.slice(e)}`.slice(0, maxLength);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = s + token.length;
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        /* input sem seleção */
      }
    });
  };

  return (
    <Box>
      <TextField
        inputRef={ref}
        fullWidth
        size="small"
        multiline={!single}
        minRows={single ? undefined : minRows}
        maxRows={single ? undefined : maxRows}
        label={label}
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        helperText={helperText}
        InputLabelProps={placeholder && label ? { shrink: true } : undefined}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end" sx={{ alignSelf: single ? 'center' : 'flex-start', mt: single ? 0 : 1 }}>
              <Tooltip title="Emoji">
                <IconButton size="small" onClick={(e) => setEmojiEl(e.currentTarget)} sx={{ mr: -0.75 }}>
                  <IconMoodSmile size={17} />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          )
        }}
        sx={{ '& .MuiInputBase-root': { alignItems: single ? 'center' : 'flex-start' } }}
      />
      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
        {all.map((v) => (
          <Tooltip key={v.key} title={`Inserir ${v.label}`} enterDelay={400}>
            <Box
              component="button"
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(`{{${v.key}}}`)}
              sx={{
                border: '1px dashed',
                borderColor: hexA(WA_DARK, 0.45),
                bgcolor: 'transparent',
                color: WA_ACCENT,
                cursor: 'pointer',
                borderRadius: 1.5,
                px: 0.75,
                py: 0.15,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'inherit',
                lineHeight: 1.6,
                transition: 'background-color .12s',
                '&:hover': { bgcolor: hexA(WA_GREEN, 0.14) }
              }}
            >
              {`{{${v.key}}}`}
            </Box>
          </Tooltip>
        ))}
        {showFormatHint && !single ? (
          <Typography variant="caption" sx={{ color: 'text.disabled', ml: 'auto !important', fontSize: 10.5 }}>
            *negrito* _itálico_ ~riscado~
          </Typography>
        ) : null}
      </Stack>
      <EmojiPicker
        anchorEl={emojiEl}
        onClose={() => setEmojiEl(null)}
        onPick={(em) => {
          insert(em);
          setEmojiEl(null);
        }}
        placement="bottom-end"
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Dinheiro estilo caixa eletrônico (digita 4990 → R$ 49,90)
// ---------------------------------------------------------------------------
export function MoneyField({ valueCents, onChange, label = 'Valor', helperText = 'Digite só os números: 4990 vira R$ 49,90' }) {
  const display = (Number(valueCents) || 0) === 0 ? '' : fmtBRL(valueCents).replace(/^R\$\s?/, '');
  return (
    <TextField
      size="small"
      fullWidth
      label={label}
      value={display}
      placeholder="0,00"
      onChange={(e) => {
        const digits = String(e.target.value || '')
          .replace(/\D+/g, '')
          .slice(0, 9);
        onChange(digits ? parseInt(digits, 10) : 0);
      }}
      InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
      inputProps={{ inputMode: 'numeric' }}
      helperText={helperText}
    />
  );
}

// ---------------------------------------------------------------------------
// Número inteiro com limites (vazio permitido = usa o padrão)
// ---------------------------------------------------------------------------
export function IntField({ value, onChange, min = 0, max = 9999, label, helperText, placeholder, allowEmpty = false, suffix, sx }) {
  const [draft, setDraft] = useState(null);
  const shown = draft != null ? draft : value == null ? '' : String(value);
  const commit = (raw) => {
    setDraft(null);
    const s = String(raw ?? '').trim();
    if (!s) {
      onChange(allowEmpty ? undefined : min);
      return;
    }
    const n = parseInt(s, 10);
    if (!Number.isFinite(n)) return;
    onChange(Math.min(max, Math.max(min, n)));
  };
  return (
    <TextField
      size="small"
      label={label}
      value={shown}
      placeholder={placeholder}
      helperText={helperText}
      onChange={(e) => {
        const s = e.target.value.replace(/[^\d]/g, '').slice(0, 6);
        setDraft(s);
        if (s) {
          const n = parseInt(s, 10);
          if (n >= min && n <= max) onChange(n);
        }
      }}
      onBlur={(e) => commit(e.target.value)}
      inputProps={{ inputMode: 'numeric' }}
      InputLabelProps={placeholder && label ? { shrink: true } : undefined}
      InputProps={suffix ? { endAdornment: <InputAdornment position="end">{suffix}</InputAdornment> } : undefined}
      sx={sx}
    />
  );
}

// ---------------------------------------------------------------------------
// Seções / dicas
// ---------------------------------------------------------------------------
export function SectionTitle({ title, subtitle, action, sx }) {
  return (
    <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 1, ...sx }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{title}</Typography>
        {subtitle ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.4 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {action || null}
    </Stack>
  );
}

export function Hint({ icon: Icon, children, color = WA_DARK, sx }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="flex-start"
      sx={{
        p: 1.25,
        borderRadius: 2,
        border: `1px solid ${hexA(color, 0.28)}`,
        bgcolor: hexA(color, 0.07),
        ...sx
      }}
    >
      {Icon ? (
        <Box sx={{ color, mt: '1px', flexShrink: 0, display: 'flex' }}>
          <Icon size={16} />
        </Box>
      ) : null}
      <Typography variant="caption" component="div" sx={{ color: 'text.primary', lineHeight: 1.5, fontSize: 12 }}>
        {children}
      </Typography>
    </Stack>
  );
}

// segmented control compacto (pílulas)
export function Segmented({ value, onChange, options, size = 'md', fullWidth }) {
  const small = size === 'sm';
  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ p: 0.4, borderRadius: 2, bgcolor: 'action.hover', width: fullWidth ? '100%' : 'fit-content', maxWidth: '100%' }}
    >
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <Box
            key={o.value}
            role="button"
            tabIndex={0}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange(o.value);
              }
            }}
            sx={{
              flex: fullWidth ? 1 : 'none',
              cursor: 'pointer',
              px: small ? 1 : 1.25,
              py: small ? 0.4 : 0.6,
              borderRadius: 1.5,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              fontSize: small ? 11.5 : 12.5,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              color: on ? WA_ACCENT : 'text.secondary',
              bgcolor: on ? 'background.paper' : 'transparent',
              boxShadow: on ? '0 1px 3px rgba(0,0,0,0.14)' : 'none',
              transition: 'color .12s, background-color .12s',
              '&:hover': { color: on ? WA_ACCENT : 'text.primary' },
              outline: 'none',
              '&:focus-visible': { boxShadow: `0 0 0 2px ${hexA(WA_GREEN, 0.5)}` }
            }}
          >
            {Icon ? <Icon size={small ? 13 : 15} /> : null}
            {o.label}
          </Box>
        );
      })}
    </Stack>
  );
}

// "digitando…" (3 pontinhos)
export function TypingDots({ color, size = 4 }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          component="span"
          className="wa-typing-dot"
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            display: 'inline-block',
            animationDelay: `${i * 0.16}s`,
            bgcolor: color || 'currentColor'
          }}
        />
      ))}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Status do bot (Ativo / Modo teste / Pausado)
// ---------------------------------------------------------------------------
export const BOT_STATUS = {
  active: { label: 'Ativo', color: '#16A34A', desc: 'Respondendo todos os contatos que mandarem mensagem.' },
  tags: { label: 'Ativo · só etiquetas', color: '#16A34A', desc: 'Respondendo só os contatos com as etiquetas escolhidas.' },
  test: { label: 'Modo teste', color: '#D97706', desc: 'Respondendo só os contatos de teste.' },
  paused: { label: 'Pausado', color: '#64748B', desc: 'O bot não responde ninguém. Você pode editar e testar à vontade.' }
};

export const botStatusOf = (active, settings) => {
  if (!active) return 'paused';
  const mode = settings?.audience?.mode;
  if (mode === 'test') return 'test';
  if (mode === 'tags') return 'tags';
  return 'active';
};

export function BotStatusPill({ status = 'paused', size = 'sm', sx }) {
  const cfg = BOT_STATUS[status] || BOT_STATUS.paused;
  const live = status !== 'paused';
  const small = size === 'sm';
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        pl: small ? 0.9 : 1.1,
        pr: small ? 1.1 : 1.4,
        py: small ? 0.35 : 0.55,
        borderRadius: 5,
        fontSize: small ? 11.5 : 13,
        fontWeight: 800,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color: cfg.color,
        bgcolor: hexA(cfg.color, 0.14),
        border: `1px solid ${hexA(cfg.color, 0.3)}`,
        ...sx
      }}
    >
      <Box
        component="span"
        sx={{
          width: small ? 7 : 8,
          height: small ? 7 : 8,
          borderRadius: '50%',
          bgcolor: cfg.color,
          ...(live
            ? {
                animation: 'waLivePulse 1.8s infinite',
                '@keyframes waLivePulse': {
                  '0%': { boxShadow: `0 0 0 0 ${hexA(cfg.color, 0.55)}` },
                  '70%': { boxShadow: `0 0 0 7px ${hexA(cfg.color, 0)}` },
                  '100%': { boxShadow: `0 0 0 0 ${hexA(cfg.color, 0)}` }
                }
              }
            : {})
        }}
      />
      {cfg.label}
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Responsivo: celular = abaixo de `sm` (< 600 px)
// -----------------------------------------------------------------------------
export const useXs = () => {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
};

// Modal padrão do módulo (mesma cara do TgModal), em tela cheia no celular.
// Cabeçalho e rodapé fixos; só o conteúdo rola.
export function BotModal({ open, onClose, title, subtitle, footer, maxWidth = 'sm', children, disableClose, contentSx }) {
  const xs = useXs();
  return (
    <Dialog
      open={open}
      onClose={() => !disableClose && onClose?.()}
      maxWidth={maxWidth}
      fullWidth
      fullScreen={xs}
      slotProps={{ paper: { sx: { borderRadius: xs ? 0 : 3, overflow: 'hidden' } } }}
    >
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          pt: { xs: 1.75, sm: 2.25 },
          pb: { xs: 1.5, sm: 2 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          bgcolor: 'background.paper'
        }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }} noWrap>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          <IconButton size="small" onClick={() => onClose?.()} disabled={disableClose} aria-label="Fechar" sx={{ mt: -0.5, mr: -0.5 }}>
            <IconX size={18} />
          </IconButton>
        </Stack>
      </Box>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 }, ...contentSx }}>{children}</DialogContent>
      {footer ? (
        <DialogActions
          sx={{
            px: { xs: 2, sm: 3 },
            pt: 1.5,
            pb: xs ? 'calc(12px + env(safe-area-inset-bottom))' : 1.75,
            borderTop: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
            bgcolor: 'background.paper',
            flexWrap: 'wrap',
            gap: 1,
            '& > :not(:first-of-type)': { ml: 0 }
          }}
        >
          {footer}
        </DialogActions>
      ) : null}
    </Dialog>
  );
}
