// =============================================================================
// WhatsApp — Fluxo do Bot: inspetor (painel lateral) com o editor de cada bloco.
// =============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Slider,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  IconAdjustments,
  IconArrowDown,
  IconArrowUp,
  IconBulb,
  IconClock,
  IconCopy,
  IconFile,
  IconInfoCircle,
  IconMessage2,
  IconMicrophone,
  IconPhoto,
  IconPlus,
  IconTrash,
  IconVideo,
  IconX
} from '@tabler/icons-react';

import WhatsAppMediaField from '../WhatsAppMediaField';
import {
  APPOINTMENT_KEYS,
  BASE_VARS,
  BOOK_RESOURCE_MODES,
  BOOK_VARS,
  CANCEL_POLICIES,
  CONDITION_SOURCES,
  CRM_CHARGE_VARS,
  CRM_CUSTOMER_VARS,
  CRM_PRODUCT_VARS,
  CRM_SUBSCRIPTION_VARS,
  CRM_TEXTS,
  CRM_VARS,
  CUSTOMER_KEYS,
  CUSTOMER_STATUS_OPTIONS,
  DEFAULT_UNAVAILABLE_TEXT,
  IDENTIFY_MODES,
  INFO_WHATS,
  INVOICE_METHODS,
  INVOICE_WHICH,
  MAX_MENU_OPTIONS,
  OP_LABEL,
  ORDER_KEYS,
  ORDER_PAYMENT_OPTIONS,
  ORDER_SHOW_MODES,
  ORDER_VARS,
  PIX_VARS,
  REGISTER_FIELDS,
  SAVE_TO_CONTACT,
  SOURCE_OPS,
  SUBSCRIBE_METHODS,
  SUBSCRIPTION_PICK,
  TICKET_KEYS,
  TICKET_PRIORITY_OPTIONS,
  TICKET_SHOW_MODES,
  TICKET_VARS,
  VALIDATE_OPTIONS,
  WAITLIST_PERIOD_MODES,
  WAITLIST_PRODUCT_MODES,
  WAIT_UNITS,
  appointmentKeyMeta,
  askedCustomFields,
  bookDefault,
  normText,
  orderDefault,
  orderKeyMeta,
  customerKeyOf,
  customerOps,
  fmtMinutes,
  isReservedVar,
  newField,
  newMessage,
  newOption,
  newRule,
  opNeedsValue,
  optionPrefix,
  productLabel,
  productsFor,
  registerFieldMeta,
  renderMenuText,
  sanitizeVarName,
  ticketDefault,
  ticketKeyMeta,
  validateMeta,
  visibleCustomFields
} from './botModel';
import {
  Hint,
  IntField,
  KeywordsInput,
  MoneyField,
  NODE_META,
  SectionTitle,
  Segmented,
  TagSelect,
  VarTextField,
  WA_ACCENT,
  WA_DARK,
  WA_GREEN,
  WA_WARN,
  WaText,
  hexA,
  useBookCatalog,
  useBot,
  useTicketCatalog,
  waBg,
  waFg
} from './botUi';

const KIND_OPTS = [
  { value: 'text', label: 'Texto', icon: IconMessage2 },
  { value: 'image', label: 'Imagem', icon: IconPhoto },
  { value: 'video', label: 'Vídeo', icon: IconVideo },
  { value: 'audio', label: 'Áudio', icon: IconMicrophone },
  { value: 'document', label: 'Doc', icon: IconFile }
];
const FIELD_KIND = { image: 'image', video: 'video', audio: 'voice', document: 'document' };
const toMsgKind = (k) => (k === 'voice' || k === 'audio' ? 'audio' : ['image', 'video', 'document'].includes(k) ? k : 'document');

const cardSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2.5,
  p: 1.5,
  bgcolor: 'background.paper'
};

const smallBtnSx = {
  textTransform: 'none',
  fontWeight: 700,
  borderRadius: 2,
  color: WA_ACCENT,
  '&:hover': { bgcolor: hexA(WA_GREEN, 0.1) }
};

function MiniPreview({ text, lines }) {
  return (
    <Box
      sx={[
        {
          p: 1.25,
          borderRadius: 2.5,
          backgroundImage: 'radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)',
          backgroundSize: '12px 12px'
        },
        waBg('wallpaper')
      ]}
    >
      <Box
        sx={[
          {
            ml: 'auto',
            width: 'fit-content',
            maxWidth: '92%',
            px: 1.1,
            py: 0.75,
            borderRadius: '9px',
            borderTopRightRadius: '3px',
            fontSize: 13,
            lineHeight: 1.42,
            boxShadow: '0 1px 1px rgba(0,0,0,0.12)'
          },
          waBg('out'),
          waFg('text')
        ]}
      >
        {text?.trim() ? (
          <WaText text={text} vars />
        ) : (
          <Box component="span" sx={{ opacity: 0.6, fontStyle: 'italic' }}>
            Sem texto
          </Box>
        )}
        {lines}
      </Box>
    </Box>
  );
}

// =============================================================================
// Mensagem
// =============================================================================
function MessageEditor({ data, setD }) {
  const { settings } = useBot();
  const msgs = data.messages || [];
  const endRef = useRef(null);
  const prevLen = useRef(msgs.length);
  useEffect(() => {
    if (msgs.length > prevLen.current) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    prevLen.current = msgs.length;
  }, [msgs.length]);

  const setMsgs = (arr) => setD({ messages: arr });
  const setMsg = (mid, patch) => setMsgs(msgs.map((m) => (m.id === mid ? { ...m, ...patch } : m)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= msgs.length) return;
    const arr = [...msgs];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setMsgs(arr);
  };
  const setKind = (m, kind) => {
    if (kind === m.kind) return;
    const keep = m.media && toMsgKind(m.media.kind) === kind;
    setMsg(m.id, { kind, media: kind === 'text' || !keep ? null : m.media });
  };

  return (
    <Box>
      <SectionTitle
        title="Mensagens"
        subtitle={`Enviadas em sequência, uma depois da outra. ${settings?.typing ? 'Antes de cada uma o cliente vê "digitando…".' : ''}`}
      />
      <Stack spacing={1.5}>
        {msgs.map((m, i) => (
          <Box key={m.id} sx={cardSx}>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1.25 }}>
              <Chip size="small" label={`Mensagem ${i + 1}`} sx={{ fontWeight: 700, borderRadius: 1.5 }} />
              <Box sx={{ flex: 1 }} />
              <Tooltip title="Subir">
                <span>
                  <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)}>
                    <IconArrowUp size={15} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Descer">
                <span>
                  <IconButton size="small" disabled={i === msgs.length - 1} onClick={() => move(i, 1)}>
                    <IconArrowDown size={15} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={msgs.length > 1 ? 'Remover mensagem' : 'O bloco precisa de pelo menos uma mensagem'}>
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    disabled={msgs.length <= 1}
                    onClick={() => setMsgs(msgs.filter((x) => x.id !== m.id))}
                  >
                    <IconTrash size={15} />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>

            <Segmented size="sm" fullWidth value={m.kind} onChange={(k) => setKind(m, k)} options={KIND_OPTS} />

            {m.kind !== 'text' ? (
              <Box sx={{ mt: 1.25 }}>
                <WhatsAppMediaField
                  key={`${m.id}-${m.kind}`}
                  value={m.media}
                  kinds={[FIELD_KIND[m.kind]]}
                  autoOpen={!m.media?.url}
                  label={`Escolher ${KIND_OPTS.find((k) => k.value === m.kind)?.label.toLowerCase() || 'arquivo'}`}
                  onChange={(media) => {
                    if (!media) {
                      setMsg(m.id, { media: null });
                      return;
                    }
                    const kind = toMsgKind(media.kind);
                    setMsg(m.id, {
                      kind,
                      media: { id: media.id, url: media.url, kind, mime: media.mime, filename: media.filename }
                    });
                  }}
                />
              </Box>
            ) : null}

            {m.kind === 'audio' ? (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                O áudio chega como mensagem de voz. Áudios não têm legenda no WhatsApp — se precisar de texto, adicione outra mensagem.
              </Typography>
            ) : (
              <Box sx={{ mt: 1.25 }}>
                <VarTextField
                  value={m.text}
                  onChange={(text) => setMsg(m.id, { text })}
                  label={m.kind === 'text' ? 'Texto' : 'Legenda (opcional)'}
                  placeholder={m.kind === 'text' ? 'Ex.: Olá, {{primeiro_nome}}! Tudo bem?' : 'Aparece junto com o arquivo'}
                  minRows={m.kind === 'text' ? 3 : 1}
                />
              </Box>
            )}

            <Box sx={{ mt: 1.5, px: 0.5 }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <IconClock size={14} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {settings?.typing ? '"Digitando…"' : 'Espera'} antes de enviar: <b>{m.delay_seconds || 0}s</b>
                </Typography>
              </Stack>
              <Slider
                size="small"
                min={0}
                max={30}
                step={1}
                valueLabelDisplay="auto"
                value={m.delay_seconds || 0}
                onChange={(_, v) => setMsg(m.id, { delay_seconds: v })}
                marks={[
                  { value: 0, label: '0s' },
                  { value: 10, label: '10s' },
                  { value: 20, label: '20s' },
                  { value: 30, label: '30s' }
                ]}
                sx={{ color: WA_GREEN, '& .MuiSlider-markLabel': { fontSize: 10.5 } }}
              />
            </Box>
          </Box>
        ))}
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5, mb: 0.75, fontWeight: 600 }}>
        Adicionar outra mensagem:
      </Typography>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap ref={endRef}>
        {KIND_OPTS.map((k) => {
          const I = k.icon;
          return (
            <Button
              key={k.value}
              size="small"
              variant="outlined"
              startIcon={<I size={15} />}
              onClick={() => setMsgs([...msgs, newMessage(k.value)])}
              sx={{ ...smallBtnSx, borderColor: 'divider' }}
            >
              {k.label === 'Doc' ? 'Documento' : k.label}
            </Button>
          );
        })}
      </Stack>
    </Box>
  );
}

// =============================================================================
// Opções numeradas
// =============================================================================
function MenuEditor({ data, setD }) {
  const { settings, products } = useBot();
  const opts = data.options || [];
  const numbering = data.numbering || settings?.numbering || 'emoji';
  const isProducts = data.source === 'products';
  const prodList = isProducts ? productsFor(products || [], data.product_ids) : [];
  const setOpts = (arr) => setD({ options: arr });
  const setOpt = (oid, patch) => setOpts(opts.map((o) => (o.id === oid ? { ...o, ...patch } : o)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= opts.length) return;
    const arr = [...opts];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setOpts(arr);
  };
  const preview = renderMenuText(
    isProducts ? { ...data, numbering, options: prodList.map((p) => ({ id: p.id, label: productLabel(p) })) } : { ...data, numbering },
    settings
  );
  const tries = data.max_retries || settings?.max_retries || 3;

  return (
    <Stack spacing={2}>
      <Segmented
        fullWidth
        value={isProducts ? 'products' : 'options'}
        onChange={(v) => setD(v === 'products' ? { source: 'products', product_ids: data.product_ids || [] } : { source: undefined })}
        options={[
          { value: 'options', label: 'Opções fixas' },
          { value: 'products', label: 'Produtos do catálogo' }
        ]}
      />

      <VarTextField
        value={data.text}
        onChange={(text) => setD({ text })}
        label="Texto acima das opções"
        placeholder={isProducts ? 'Ex.: Qual plano você quer conhecer?' : 'Ex.: Como posso te ajudar? Responda com o número:'}
        minRows={2}
        extraVars={CRM_CUSTOMER_VARS}
      />

      {isProducts ? (
        <Box>
          <SectionTitle
            title="Produtos listados"
            subtitle="Cada produto ativo vira uma opção numerada (“Nome · R$ X/mês”) com a sua saída. A escolha fica em {{produto}} / {{produto_id}} — o bloco “Assinar plano” pode usá-la."
            action={
              <Segmented
                size="sm"
                value={numbering}
                onChange={(v) => setD({ numbering: v })}
                options={[
                  { value: 'emoji', label: '1️⃣ Emoji' },
                  { value: 'number', label: '1. Número' }
                ]}
              />
            }
          />
          <ProductMultiSelect
            value={data.product_ids || []}
            onChange={(product_ids) => setD({ product_ids })}
            label="Quais produtos"
            helperText="Vazio = todos os produtos ativos."
          />
          {products && !prodList.length ? (
            <Alert severity="warning" sx={{ borderRadius: 2, mt: 1.25 }} action={<ProductsLink />}>
              Nenhum produto ativo para listar.
            </Alert>
          ) : null}
          <VarTextField
            value={data.unavailable_text || ''}
            onChange={(v) => setD({ unavailable_text: v || undefined })}
            label="Se o produto escolhido não tiver saída ligada"
            placeholder={DEFAULT_UNAVAILABLE_TEXT}
            minRows={1}
            extraVars={CRM_CUSTOMER_VARS}
            helperText="Produto sem ligação cai em “Não entendeu”; sem ela, o bot manda este aviso e repete o menu."
            showFormatHint={false}
          />
        </Box>
      ) : null}

      <Box sx={{ display: isProducts ? 'none' : 'block' }}>
        <SectionTitle
          title={`Opções (${opts.length}/${MAX_MENU_OPTIONS})`}
          subtitle="Cada opção tem a sua saída no bloco — ligue-a ao próximo passo."
          action={
            <Segmented
              size="sm"
              value={numbering}
              onChange={(v) => setD({ numbering: v })}
              options={[
                { value: 'emoji', label: '1️⃣ Emoji' },
                { value: 'number', label: '1. Número' }
              ]}
            />
          }
        />
        <Stack spacing={1}>
          {opts.map((o, i) => (
            <Box key={o.id} sx={{ ...cardSx, p: 1.1 }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box
                  sx={{
                    minWidth: 30,
                    height: 30,
                    px: 0.5,
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: numbering === 'emoji' ? 16 : 13,
                    color: WA_ACCENT,
                    bgcolor: hexA(WA_GREEN, 0.14),
                    flexShrink: 0
                  }}
                >
                  {optionPrefix(i, numbering)}
                </Box>
                <TextField
                  size="small"
                  fullWidth
                  placeholder={`Opção ${i + 1}`}
                  value={o.label}
                  onChange={(e) => setOpt(o.id, { label: e.target.value.slice(0, 80) })}
                />
                <Stack direction="row">
                  <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)}>
                    <IconArrowUp size={14} />
                  </IconButton>
                  <IconButton size="small" disabled={i === opts.length - 1} onClick={() => move(i, 1)}>
                    <IconArrowDown size={14} />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => setOpts(opts.filter((x) => x.id !== o.id))}>
                    <IconTrash size={14} />
                  </IconButton>
                </Stack>
              </Stack>
              <Box sx={{ mt: 1 }}>
                <KeywordsInput
                  value={o.keywords}
                  onChange={(keywords) => setOpt(o.id, { keywords })}
                  label="Palavras-chave (opcional)"
                  placeholder="ex.: preço, valor — Enter para adicionar"
                />
              </Box>
            </Box>
          ))}
        </Stack>
        <Button
          size="small"
          startIcon={<IconPlus size={15} />}
          disabled={opts.length >= MAX_MENU_OPTIONS}
          onClick={() => setOpts([...opts, newOption(`Opção ${opts.length + 1}`)])}
          sx={{ ...smallBtnSx, mt: 1 }}
        >
          Adicionar opção
        </Button>
      </Box>

      <Hint icon={IconInfoCircle}>
        O cliente pode responder com o <b>número</b> (ex.: 1), com o <b>texto da opção</b> ou com uma das <b>palavras-chave</b>. No WhatsApp
        não existem botões para números comuns — por isso as opções vão numeradas no texto.
      </Hint>

      <Box>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75 }}>
          COMO O CLIENTE VAI VER
        </Typography>
        <MiniPreview text={preview} />
      </Box>

      <Divider />

      <Box>
        <SectionTitle
          title="Se a resposta não for uma opção"
          subtitle={`O bot repete o aviso abaixo. Depois de ${tries} ${tries === 1 ? 'tentativa' : 'tentativas'}, segue pela saída "Não entendeu".`}
        />
        <Stack spacing={1.5}>
          <VarTextField
            value={data.invalid_text || ''}
            onChange={(v) => setD({ invalid_text: v || undefined })}
            label="Aviso de opção inválida"
            placeholder={settings?.invalid_option_text || 'Usa o texto padrão das Configurações'}
            minRows={1}
            showFormatHint={false}
            helperText="Deixe vazio para usar o texto padrão das Configurações."
          />
          <IntField
            label="Tentativas"
            value={data.max_retries}
            allowEmpty
            min={1}
            max={10}
            placeholder={`${settings?.max_retries || 3} (padrão)`}
            onChange={(v) => setD({ max_retries: v })}
            helperText="Vazio = padrão das Configurações."
            sx={{ width: 180 }}
          />
        </Stack>
      </Box>
    </Stack>
  );
}

// =============================================================================
// Pergunta
// =============================================================================
function QuestionEditor({ data, setD }) {
  const { settings } = useBot();
  const v = validateMeta(data.validate);
  const reserved = data.var && isReservedVar(data.var);
  return (
    <Stack spacing={2}>
      <VarTextField value={data.text} onChange={(text) => setD({ text })} label="Pergunta" placeholder="Ex.: Qual é o seu e-mail?" />

      <TextField
        size="small"
        fullWidth
        label="Salvar a resposta na variável"
        value={data.var || ''}
        onChange={(e) => setD({ var: sanitizeVarName(e.target.value) })}
        error={!data.var || reserved}
        helperText={
          reserved
            ? 'Esse nome é reservado pelo sistema. Escolha outro.'
            : data.var
              ? `Use {{${data.var}}} nos próximos textos e nas condições.`
              : 'Só letras minúsculas, números e _ (ex.: email, cidade).'
        }
        InputProps={{
          startAdornment: <InputAdornment position="start">{'{{'}</InputAdornment>,
          endAdornment: <InputAdornment position="end">{'}}'}</InputAdornment>
        }}
      />

      <Box>
        <TextField
          select
          size="small"
          fullWidth
          label="Tipo de resposta esperada"
          value={data.validate || 'any'}
          onChange={(e) => setD({ validate: e.target.value })}
        >
          {VALIDATE_OPTIONS.map((o) => (
            <MenuItem key={o.id} value={o.id}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, pl: 0.25 }}>
          {v.hint}
        </Typography>
      </Box>

      {data.validate && data.validate !== 'any' ? (
        <Stack spacing={1.5}>
          <VarTextField
            value={data.invalid_text || ''}
            onChange={(val) => setD({ invalid_text: val || undefined })}
            label="Aviso quando a resposta não for válida"
            placeholder={v.invalid}
            minRows={1}
            showFormatHint={false}
            helperText="Deixe vazio para usar a mensagem sugerida."
          />
          <IntField
            label="Tentativas"
            value={data.max_retries}
            allowEmpty
            min={1}
            max={10}
            placeholder={`${settings?.max_retries || 3} (padrão)`}
            onChange={(val) => setD({ max_retries: val })}
            helperText='Depois disso, segue por "Resposta inválida".'
            sx={{ width: 200 }}
          />
        </Stack>
      ) : null}

      <TextField
        select
        size="small"
        fullWidth
        label="Guardar também no contato"
        value={data.save_to_contact || ''}
        onChange={(e) => setD({ save_to_contact: e.target.value || null })}
        helperText="Atualiza a ficha do contato no Pub Mail com a resposta."
      >
        {SAVE_TO_CONTACT.map((o) => (
          <MenuItem key={o.id} value={o.id}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}

// =============================================================================
// Condição
// =============================================================================
function CustomerRuleFields({ rule, onChange }) {
  const { crmSettings } = useBot();
  const ck = customerKeyOf(rule.key);
  const ops = customerOps(rule.key);
  const customFields = crmSettings?.custom_fields || [];
  const setKey = (k) => {
    const next = k === 'custom' ? `custom.${customFields[0]?.key || ''}` : k;
    const o = customerOps(next)[0];
    onChange({
      ...rule,
      key: next,
      op: o,
      value: k === 'status' ? 'ok' : k === 'verified' || k === 'has_open_charge' || k === 'has_subscription' ? 'true' : ''
    });
  };
  return (
    <>
      <TextField select size="small" fullWidth label="Dado do cliente" value={ck} onChange={(e) => setKey(e.target.value)}>
        {CUSTOMER_KEYS.map((k) => (
          <MenuItem key={k.id} value={k.id}>
            {k.label}
          </MenuItem>
        ))}
      </TextField>
      {ck === 'custom' ? (
        <TextField
          select
          size="small"
          fullWidth
          label="Campo personalizado"
          value={String(rule.key || '').slice(7)}
          onChange={(e) => onChange({ ...rule, key: `custom.${e.target.value}` })}
          helperText={customFields.length ? ' ' : 'Cadastre campos em WhatsApp → Clientes → Campos personalizados.'}
        >
          {customFields.map((f) => (
            <MenuItem key={f.key} value={f.key}>
              {f.label}
            </MenuItem>
          ))}
          {rule.key && String(rule.key).length > 7 && !customFields.some((f) => `custom.${f.key}` === rule.key) ? (
            <MenuItem value={String(rule.key).slice(7)}>{String(rule.key).slice(7)} (removido)</MenuItem>
          ) : null}
        </TextField>
      ) : null}
      {ck === 'status' ? (
        <Stack direction="row" spacing={1}>
          <TextField
            select
            size="small"
            label="Condição"
            value={rule.op}
            onChange={(e) => onChange({ ...rule, op: e.target.value })}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="is">É</MenuItem>
            <MenuItem value="is_not">Não é</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            fullWidth
            label="Situação"
            value={rule.value || 'ok'}
            onChange={(e) => onChange({ ...rule, value: e.target.value })}
          >
            {CUSTOMER_STATUS_OPTIONS.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      ) : null}
      {ck === 'product' ? (
        <Stack direction="row" spacing={1}>
          <TextField
            select
            size="small"
            label="Condição"
            value={rule.op}
            onChange={(e) => onChange({ ...rule, op: e.target.value })}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="is">Tem</MenuItem>
            <MenuItem value="is_not">Não tem</MenuItem>
          </TextField>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <ProductSelect value={rule.value || ''} onChange={(value) => onChange({ ...rule, value })} label="Plano" />
          </Box>
        </Stack>
      ) : null}
      {ck === 'days_overdue' || ck === 'no_shows' ? (
        <Stack direction="row" spacing={1}>
          <TextField
            select
            size="small"
            label="Comparação"
            value={rule.op}
            onChange={(e) => onChange({ ...rule, op: e.target.value })}
            sx={{ minWidth: 150 }}
          >
            {ops.map((op) => (
              <MenuItem key={op} value={op}>
                {OP_LABEL[op]}
              </MenuItem>
            ))}
          </TextField>
          <IntField
            label={ck === 'no_shows' ? 'Faltas' : 'Dias'}
            value={rule.value === '' || rule.value == null ? undefined : Number(rule.value)}
            allowEmpty
            min={0}
            max={9999}
            onChange={(v) => onChange({ ...rule, value: v == null ? '' : String(v) })}
            sx={{ flex: 1 }}
          />
        </Stack>
      ) : null}
      {ck === 'verified' || ck === 'has_open_charge' || ck === 'has_subscription' ? (
        <Segmented
          fullWidth
          size="sm"
          value={rule.value === 'false' ? 'false' : 'true'}
          onChange={(value) => onChange({ ...rule, op: 'is', value })}
          options={[
            { value: 'true', label: 'Sim' },
            { value: 'false', label: 'Não' }
          ]}
        />
      ) : null}
      {ck === 'custom' ? (
        <Stack direction="row" spacing={1}>
          <TextField
            select
            size="small"
            label="Comparação"
            value={rule.op}
            onChange={(e) => onChange({ ...rule, op: e.target.value })}
            sx={{ minWidth: 150, flex: opNeedsValue(rule.op) ? 'none' : 1 }}
          >
            {ops.map((op) => (
              <MenuItem key={op} value={op}>
                {OP_LABEL[op]}
              </MenuItem>
            ))}
          </TextField>
          {opNeedsValue(rule.op) ? (
            <TextField
              size="small"
              fullWidth
              label="Valor"
              value={rule.value || ''}
              onChange={(e) => onChange({ ...rule, value: e.target.value.slice(0, 200) })}
            />
          ) : null}
        </Stack>
      ) : null}
    </>
  );
}

function AppointmentRuleFields({ rule, onChange }) {
  const meta = appointmentKeyMeta(rule.key);
  const setKey = (k) => {
    const m = appointmentKeyMeta(k);
    onChange({ ...rule, key: m.id, op: m.ops[0], value: m.values === 'bool' ? 'true' : '' });
  };
  return (
    <>
      <TextField select size="small" fullWidth label="Dado do agendamento" value={meta.id} onChange={(e) => setKey(e.target.value)}>
        {APPOINTMENT_KEYS.map((k) => (
          <MenuItem key={k.id} value={k.id}>
            {k.label}
          </MenuItem>
        ))}
      </TextField>
      {meta.id === 'next_in_hours' ? (
        <Stack direction="row" spacing={1}>
          <TextField
            select
            size="small"
            label="Comparação"
            value={rule.op === 'gt' ? 'gt' : 'lte'}
            onChange={(e) => onChange({ ...rule, op: e.target.value })}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="lte">Em até</MenuItem>
            <MenuItem value="gt">Daqui a mais de</MenuItem>
          </TextField>
          <IntField
            label="Horas"
            value={rule.value === '' || rule.value == null ? undefined : Number(rule.value)}
            allowEmpty
            min={0}
            max={9999}
            onChange={(v) => onChange({ ...rule, value: v == null ? '' : String(v) })}
            sx={{ flex: 1 }}
          />
        </Stack>
      ) : (
        <Segmented
          fullWidth
          size="sm"
          value={rule.value === 'false' ? 'false' : 'true'}
          onChange={(value) => onChange({ ...rule, op: 'is', value })}
          options={[
            { value: 'true', label: 'Sim' },
            { value: 'false', label: 'Não' }
          ]}
        />
      )}
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Olha os próximos agendamentos do contato e dos clientes dele (marcados, confirmados ou aguardando pagamento).
      </Typography>
    </>
  );
}

function TicketRuleFields({ rule, onChange }) {
  const meta = ticketKeyMeta(rule.key);
  return (
    <>
      <TextField
        select
        size="small"
        fullWidth
        label="Dado do chamado"
        value={meta.id}
        onChange={(e) => onChange({ ...rule, key: e.target.value, op: 'is', value: rule.value === 'false' ? 'false' : 'true' })}
      >
        {TICKET_KEYS.map((k) => (
          <MenuItem key={k.id} value={k.id}>
            {k.label}
          </MenuItem>
        ))}
      </TextField>
      <Segmented
        fullWidth
        size="sm"
        value={rule.value === 'false' ? 'false' : 'true'}
        onChange={(value) => onChange({ ...rule, op: 'is', value })}
        options={[
          { value: 'true', label: 'Sim' },
          { value: 'false', label: 'Não' }
        ]}
      />
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Olha os chamados em andamento do contato e dos clientes dele (abertos ou aguardando resposta). Um chamado aberto antes, no mesmo
        fluxo, também conta.
      </Typography>
    </>
  );
}

function OrderRuleFields({ rule, onChange }) {
  const meta = orderKeyMeta(rule.key);
  return (
    <>
      <TextField
        select
        size="small"
        fullWidth
        label="Dado do pedido"
        value={meta.id}
        onChange={(e) => onChange({ ...rule, key: e.target.value, op: 'is', value: rule.value === 'false' ? 'false' : 'true' })}
      >
        {ORDER_KEYS.map((k) => (
          <MenuItem key={k.id} value={k.id}>
            {k.label}
          </MenuItem>
        ))}
      </TextField>
      <Segmented
        fullWidth
        size="sm"
        value={rule.value === 'false' ? 'false' : 'true'}
        onChange={(value) => onChange({ ...rule, op: 'is', value })}
        options={[
          { value: 'true', label: 'Sim' },
          { value: 'false', label: 'Não' }
        ]}
      />
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Olha os pedidos em andamento do contato e dos clientes dele (recebidos, confirmados, em preparo ou saindo para entrega). Um pedido
        feito antes, no mesmo fluxo, também conta.
      </Typography>
    </>
  );
}

function RuleEditor({ rule, index, onChange, onRemove, canRemove }) {
  const { vars, settings } = useBot();
  const ops = SOURCE_OPS[rule.source] || [];
  const varOptions = useMemo(() => [...(vars || []), ...BASE_VARS.map((v) => v.key)], [vars]);
  const setSource = (source) => onChange({ ...newRule(source), id: rule.id });

  return (
    <Box sx={{ ...cardSx, p: 1.25 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', flex: 1 }}>
          REGRA {index + 1}
        </Typography>
        {canRemove ? (
          <IconButton size="small" color="error" onClick={onRemove}>
            <IconTrash size={14} />
          </IconButton>
        ) : null}
      </Stack>
      <Stack spacing={1.25}>
        <TextField select size="small" fullWidth label="O que verificar" value={rule.source} onChange={(e) => setSource(e.target.value)}>
          {CONDITION_SOURCES.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>

        {rule.source === 'var' ? (
          <Autocomplete
            freeSolo
            size="small"
            options={varOptions}
            value={rule.key || ''}
            onChange={(_, v) => onChange({ ...rule, key: sanitizeVarName(v || '') })}
            onInputChange={(_, v, reason) => {
              if (reason === 'input') onChange({ ...rule, key: sanitizeVarName(v) });
            }}
            renderInput={(params) => <TextField {...params} label="Variável" placeholder="ex.: email" />}
          />
        ) : null}

        {rule.source === 'tag' ? (
          <Stack direction="row" spacing={1}>
            <TextField
              select
              size="small"
              label="Condição"
              value={rule.op}
              onChange={(e) => onChange({ ...rule, op: e.target.value })}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="has">Tem</MenuItem>
              <MenuItem value="not_has">Não tem</MenuItem>
            </TextField>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <TagSelect
                multiple={false}
                value={rule.key || null}
                onChange={(id) => onChange({ ...rule, key: id || '' })}
                label="Etiqueta"
              />
            </Box>
          </Stack>
        ) : null}

        {rule.source === 'business_hours' ? (
          <>
            <Segmented
              fullWidth
              size="sm"
              value={rule.op}
              onChange={(op) => onChange({ ...rule, op })}
              options={[
                { value: 'open', label: 'Dentro do horário' },
                { value: 'closed', label: 'Fora do horário' }
              ]}
            />
            {!settings?.business_hours?.enabled ? (
              <Typography variant="caption" sx={{ color: WA_WARN, fontWeight: 600 }}>
                O horário de atendimento está desligado. Configure-o na aba Configurações.
              </Typography>
            ) : null}
          </>
        ) : null}

        {rule.source === 'contact_saved' ? (
          <Segmented
            fullWidth
            size="sm"
            value={rule.value === 'false' ? 'false' : 'true'}
            onChange={(value) => onChange({ ...rule, op: 'eq', value })}
            options={[
              { value: 'true', label: 'Está salvo na agenda' },
              { value: 'false', label: 'Não está salvo' }
            ]}
          />
        ) : null}

        {rule.source === 'customer' ? <CustomerRuleFields rule={rule} onChange={onChange} /> : null}

        {rule.source === 'appointment' ? <AppointmentRuleFields rule={rule} onChange={onChange} /> : null}

        {rule.source === 'ticket' ? <TicketRuleFields rule={rule} onChange={onChange} /> : null}

        {rule.source === 'order' ? <OrderRuleFields rule={rule} onChange={onChange} /> : null}

        {rule.source === 'var' || rule.source === 'last_input' ? (
          <Stack direction="row" spacing={1}>
            <TextField
              select
              size="small"
              label="Comparação"
              value={rule.op}
              onChange={(e) => onChange({ ...rule, op: e.target.value })}
              sx={{ minWidth: 150, flex: opNeedsValue(rule.op) ? 'none' : 1 }}
            >
              {ops.map((op) => (
                <MenuItem key={op} value={op}>
                  {OP_LABEL[op]}
                </MenuItem>
              ))}
            </TextField>
            {opNeedsValue(rule.op) ? (
              <TextField
                size="small"
                fullWidth
                label="Valor"
                value={rule.value || ''}
                onChange={(e) => onChange({ ...rule, value: e.target.value.slice(0, 200) })}
                placeholder={rule.op === 'gt' || rule.op === 'lt' ? 'ex.: 18' : 'ex.: sim'}
              />
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}

function ConditionEditor({ data, setD }) {
  const rules = data.rules || [];
  const setRules = (arr) => setD({ rules: arr });
  return (
    <Stack spacing={2}>
      {rules.length > 1 ? (
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75 }}>
            SEGUE POR “SIM” QUANDO
          </Typography>
          <Segmented
            fullWidth
            value={data.match || 'all'}
            onChange={(match) => setD({ match })}
            options={[
              { value: 'all', label: 'Todas as regras valem' },
              { value: 'any', label: 'Qualquer regra vale' }
            ]}
          />
        </Box>
      ) : null}
      <Stack spacing={1.25}>
        {rules.map((r, i) => (
          <RuleEditor
            key={r.id}
            rule={r}
            index={i}
            canRemove={rules.length > 1}
            onChange={(next) => setRules(rules.map((x) => (x.id === r.id ? next : x)))}
            onRemove={() => setRules(rules.filter((x) => x.id !== r.id))}
          />
        ))}
      </Stack>
      <Button
        size="small"
        startIcon={<IconPlus size={15} />}
        onClick={() => setRules([...rules, newRule('last_input')])}
        sx={{ ...smallBtnSx, alignSelf: 'flex-start' }}
      >
        Adicionar regra
      </Button>
      <Hint icon={IconInfoCircle}>
        Se a condição for verdadeira, o bot segue pela saída <b>Sim</b>; senão, pela saída <b>Não</b>. Textos são comparados sem diferenciar
        maiúsculas de minúsculas.
      </Hint>
    </Stack>
  );
}

// =============================================================================
// Etiquetas
// =============================================================================
function TagsEditor({ data, setD }) {
  return (
    <Stack spacing={2}>
      <TagSelect
        value={data.add || []}
        onChange={(add) => setD({ add })}
        label="Adicionar etiquetas"
        placeholder="Escolha ou digite para criar"
        helperText="Ex.: Lead quente, Pediu orçamento"
      />
      <TagSelect
        value={data.remove || []}
        onChange={(remove) => setD({ remove })}
        label="Remover etiquetas"
        placeholder="Escolha as etiquetas"
      />
      <Hint icon={IconBulb}>
        As etiquetas aparecem na conversa, no Chat, e servem para filtrar atendimentos e montar condições (por exemplo, “se o cliente tem a
        etiqueta VIP”).
      </Hint>
    </Stack>
  );
}

// =============================================================================
// Espera
// =============================================================================
const WAIT_PRESETS = [
  { amount: 30, unit: 'seconds', label: '30 s' },
  { amount: 5, unit: 'minutes', label: '5 min' },
  { amount: 30, unit: 'minutes', label: '30 min' },
  { amount: 1, unit: 'hours', label: '1 h' },
  { amount: 24, unit: 'hours', label: '1 dia' }
];

function WaitEditor({ data, setD }) {
  const u = WAIT_UNITS.find((x) => x.id === data.unit) || WAIT_UNITS[1];
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1}>
        <IntField label="Esperar" value={data.amount} min={1} max={u.max} onChange={(amount) => setD({ amount })} sx={{ width: 120 }} />
        <TextField select size="small" label="Unidade" value={u.id} onChange={(e) => setD({ unit: e.target.value })} sx={{ flex: 1 }}>
          {WAIT_UNITS.map((x) => (
            <MenuItem key={x.id} value={x.id}>
              {x.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {WAIT_PRESETS.map((p) => {
          const on = Number(data.amount) === p.amount && data.unit === p.unit;
          return (
            <Chip
              key={p.label}
              size="small"
              label={p.label}
              onClick={() => setD({ amount: p.amount, unit: p.unit })}
              sx={{
                fontWeight: 700,
                borderRadius: 1.5,
                color: on ? '#fff' : 'text.secondary',
                bgcolor: on ? WA_ACCENT : 'action.hover',
                '&:hover': { bgcolor: on ? WA_ACCENT : 'action.selected' }
              }}
            />
          );
        })}
      </Stack>
      <Hint icon={IconInfoCircle}>
        O bot aguarda esse tempo e depois continua sozinho pelo próximo bloco. Útil para lembretes, como “Ainda está por aí? 🙂”.
      </Hint>
    </Stack>
  );
}

// =============================================================================
// PIX
// =============================================================================
const EXPIRE_PRESETS = [15, 30, 60, 1440];

function PixEditor({ data, setD }) {
  const { gateway } = useBot();
  const notReady = gateway && gateway.ready === false;
  return (
    <Stack spacing={2}>
      {notReady ? (
        <Alert
          severity="warning"
          sx={{ borderRadius: 2 }}
          action={
            <Button
              component={RouterLink}
              to="/settings/payments"
              size="small"
              color="inherit"
              sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Configurar
            </Button>
          }
        >
          <b>Gateway PIX não configurado.</b> Sem ele o bot não consegue gerar a cobrança.
        </Alert>
      ) : gateway?.ready ? (
        <Alert severity="success" sx={{ borderRadius: 2, py: 0.25 }}>
          Gateway pronto{gateway.provider ? ` (${gateway.provider === 'pushinpay' ? 'PushinPay' : 'Mercado Pago'})` : ''}.
        </Alert>
      ) : null}

      <MoneyField valueCents={data.amount_cents} onChange={(amount_cents) => setD({ amount_cents })} label="Valor da cobrança" />
      <TextField
        size="small"
        fullWidth
        label="Produto ou serviço"
        placeholder="Ex.: Consultoria de 1 hora"
        value={data.description || ''}
        onChange={(e) => setD({ description: e.target.value.slice(0, 120) })}
        helperText="Aparece na cobrança e no extrato do cliente."
      />
      <VarTextField
        value={data.text}
        onChange={(text) => setD({ text })}
        label="Mensagem enviada com o PIX"
        extraVars={PIX_VARS}
        minRows={3}
        helperText="Logo depois vem o código copia e cola (e o QR Code, se ligado)."
      />
      <FormControlLabel
        control={
          <Switch
            checked={data.send_qr !== false}
            onChange={(e) => setD({ send_qr: e.target.checked })}
            sx={{
              '& .Mui-checked': { color: `${WA_GREEN} !important` },
              '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${WA_GREEN} !important` }
            }}
          />
        }
        label={<Typography variant="body2">Enviar também a imagem do QR Code</Typography>}
      />
      <Box>
        <IntField
          label="O PIX vale por"
          value={data.expires_minutes}
          min={5}
          max={1440}
          suffix="min"
          onChange={(expires_minutes) => setD({ expires_minutes })}
          helperText={`Entre 5 minutos e 24 horas (${fmtMinutes(data.expires_minutes)}).`}
          sx={{ width: 220 }}
        />
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
          {EXPIRE_PRESETS.map((m) => (
            <Chip
              key={m}
              size="small"
              label={fmtMinutes(m)}
              onClick={() => setD({ expires_minutes: m })}
              sx={{
                fontWeight: 700,
                borderRadius: 1.5,
                color: data.expires_minutes === m ? '#fff' : 'text.secondary',
                bgcolor: data.expires_minutes === m ? WA_DARK : 'action.hover'
              }}
            />
          ))}
        </Stack>
      </Box>
      <Divider />
      <VarTextField
        value={data.paid_text}
        onChange={(paid_text) => setD({ paid_text })}
        label="Quando o pagamento for confirmado"
        extraVars={PIX_VARS}
        minRows={2}
      />
      <VarTextField
        value={data.expired_text}
        onChange={(expired_text) => setD({ expired_text })}
        label="Quando o PIX expirar sem pagamento"
        extraVars={PIX_VARS}
        minRows={2}
      />
      <Hint icon={IconInfoCircle}>
        Enquanto espera, o bot confere o pagamento <b>sozinho</b> — o cliente não precisa mandar comprovante. Pago, segue pela saída{' '}
        <b>Pago</b> (entregue o produto ali). Se o tempo acabar, segue por <b>Expirou sem pagar</b>.
      </Hint>
    </Stack>
  );
}

// =============================================================================
// Transferir / Encerrar
// =============================================================================
function HandoffEditor({ data, setD }) {
  const { attendants } = useBot();
  const list = attendants || [];
  const missing = data.assign_user_id && !list.some((a) => a.id === data.assign_user_id);
  return (
    <Stack spacing={2}>
      <VarTextField
        value={data.text}
        onChange={(text) => setD({ text })}
        label="Mensagem antes de transferir (opcional)"
        placeholder="Ex.: Já vou te passar para um atendente 🙂"
      />
      <TextField
        select
        size="small"
        fullWidth
        label="Enviar para"
        value={data.assign_user_id || ''}
        onChange={(e) => setD({ assign_user_id: e.target.value || null })}
        helperText={missing ? 'O atendente escolhido não existe mais — a conversa irá para a fila.' : ' '}
        error={Boolean(missing)}
      >
        <MenuItem value="">Fila de atendimento (quem estiver disponível)</MenuItem>
        {list.map((a) => (
          <MenuItem key={a.id} value={a.id}>
            {a.name}
          </MenuItem>
        ))}
        {missing ? <MenuItem value={data.assign_user_id}>Atendente removido</MenuItem> : null}
      </TextField>
      <Hint icon={IconInfoCircle}>
        O bot <b>para aqui</b>. A conversa fica aguardando atendimento no Chat
        {data.assign_user_id ? ', já atribuída à pessoa escolhida' : ''}. Quando alguém responder, o bot não interfere mais nessa conversa.
      </Hint>
    </Stack>
  );
}

function EndEditor({ data, setD }) {
  return (
    <Stack spacing={2}>
      <VarTextField
        value={data.text}
        onChange={(text) => setD({ text })}
        label="Mensagem de despedida (opcional)"
        placeholder="Ex.: Obrigado pelo contato! 👋"
      />
      <FormControlLabel
        control={
          <Switch
            checked={data.close !== false}
            onChange={(e) => setD({ close: e.target.checked })}
            sx={{
              '& .Mui-checked': { color: `${WA_GREEN} !important` },
              '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${WA_GREEN} !important` }
            }}
          />
        }
        label={
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Marcar o atendimento como encerrado
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {data.close !== false
                ? 'A conversa sai da fila. Se o cliente escrever de novo, o bot recomeça.'
                : 'O bot para, mas a conversa continua aberta no Chat.'}
            </Typography>
          </Box>
        }
        sx={{ alignItems: 'flex-start', '& .MuiSwitch-root': { mt: -0.5 } }}
      />
    </Stack>
  );
}

// =============================================================================
// Início (somente leitura)
// =============================================================================
function StartInfo({ onOpenSettings }) {
  const { settings } = useBot();
  const trig = settings?.trigger;
  const aud = settings?.audience;
  return (
    <Stack spacing={2}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        O fluxo começa quando um cliente manda mensagem no seu WhatsApp. Ligue a saída deste bloco ao primeiro passo do atendimento.
      </Typography>
      <Box sx={cardSx}>
        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
          COMEÇA COM
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
          {trig?.mode === 'keywords'
            ? trig.keywords?.length
              ? `Mensagens que contenham: ${trig.keywords.join(', ')}`
              : 'Palavras-chave (nenhuma definida ainda)'
            : 'Qualquer mensagem de um contato'}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mt: 1.25 }}>
          QUEM O BOT ATENDE
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
          {aud?.mode === 'test'
            ? `Só os contatos de teste (${aud.test_chat_ids?.length || 0})`
            : aud?.mode === 'tags'
              ? 'Só contatos com as etiquetas escolhidas'
              : 'Todos os contatos'}
        </Typography>
      </Box>
      <Button
        variant="outlined"
        startIcon={<IconAdjustments size={17} />}
        onClick={onOpenSettings}
        sx={{ ...smallBtnSx, borderColor: hexA(WA_DARK, 0.4), alignSelf: 'flex-start' }}
      >
        Alterar nas Configurações
      </Button>
      <Hint icon={IconInfoCircle}>Grupos nunca são respondidos pelo bot — só conversas individuais.</Hint>
    </Stack>
  );
}

// =============================================================================
// Blocos de Cliente (CRM / assinaturas) — contrato: docs/whatsapp-assinaturas-contrato.md §1.2
// =============================================================================
const switchSx = {
  '& .MuiSwitch-switchBase.Mui-checked': { color: WA_GREEN },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: WA_GREEN }
};

function ToggleRow({ checked, onChange, label, hint }) {
  return (
    <FormControlLabel
      control={<Switch checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} sx={switchSx} />}
      label={
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          {hint ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {hint}
            </Typography>
          ) : null}
        </Box>
      }
      sx={{ alignItems: 'flex-start', '& .MuiSwitch-root': { mt: -0.5 }, mr: 0 }}
    />
  );
}

function ProductsLink() {
  return (
    <Button component={RouterLink} to="/whatsapp/products" size="small" color="inherit" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
      Produtos
    </Button>
  );
}

/** Seletor de 1 produto (GET /whatsapp/products). `extra` = opções especiais no topo. */
function ProductSelect({ value, onChange, label = 'Produto', extra = [], helperText }) {
  const { products } = useBot();
  const list = (products || []).filter((p) => p.kind !== 'service' && (p.active !== false || p.id === value));
  const missing = value && !extra.some((x) => x.id === value) && products && !list.some((p) => p.id === value);
  return (
    <TextField
      select
      size="small"
      fullWidth
      label={label}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      error={Boolean(missing)}
      helperText={
        missing
          ? 'O produto escolhido não existe mais (ou está inativo).'
          : helperText || (!products ? 'Carregando produtos…' : products.length ? ' ' : 'Nenhum produto cadastrado em WhatsApp → Produtos.')
      }
    >
      {extra.map((x) => (
        <MenuItem key={x.id} value={x.id}>
          {x.label}
        </MenuItem>
      ))}
      {extra.length && list.length ? <Divider /> : null}
      {list.map((p) => (
        <MenuItem key={p.id} value={p.id}>
          {productLabel(p)}
          {p.active === false ? ' (inativo)' : ''}
        </MenuItem>
      ))}
      {missing ? <MenuItem value={value}>Produto removido</MenuItem> : null}
    </TextField>
  );
}

function ProductMultiSelect({ value, onChange, label, helperText, exclude }) {
  const { products } = useBot();
  const list = (products || []).filter((p) => p.active !== false && p.kind !== 'service' && (!exclude || !exclude.includes(p.id)));
  const ids = value || [];
  const selected = ids.map((id) => list.find((p) => p.id === id) || { id, name: 'Produto removido', missing: true });
  return (
    <Autocomplete
      multiple
      size="small"
      options={list}
      value={selected}
      onChange={(_, v) => onChange(v.map((p) => p.id))}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      getOptionLabel={(p) => (p.missing ? 'Produto removido' : productLabel(p))}
      renderTags={(vals, getTagProps) =>
        vals.map((p, i) => {
          const { key, ...rest } = getTagProps({ index: i });
          return (
            <Chip
              key={key}
              size="small"
              label={p.missing ? 'Produto removido' : p.name}
              {...rest}
              sx={{ fontWeight: 600, borderRadius: 1.5, textDecoration: p.missing ? 'line-through' : 'none' }}
            />
          );
        })
      }
      noOptionsText={products ? 'Nenhum produto ativo' : 'Carregando…'}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={ids.length ? '' : 'Todos os ativos'} helperText={helperText} />
      )}
    />
  );
}

/** Texto com variáveis do CRM; placeholder = texto padrão do motor (vazio = usa o padrão). */
function CrmText({ value, onChange, label, def, vars = CRM_VARS, minRows = 2, helperText, single }) {
  return (
    <VarTextField
      value={value || ''}
      onChange={(v) => onChange(v)}
      label={label}
      placeholder={def || undefined}
      minRows={minRows}
      extraVars={vars}
      single={single}
      helperText={helperText || (def ? 'Vazio = usa o texto padrão.' : undefined)}
      showFormatHint={false}
    />
  );
}

/** Mensagens das saídas de erro (só enviadas quando a saída não está ligada). */
function FallbackTexts({ data, setD, keys }) {
  const [open, setOpen] = useState(false);
  const items = [
    { key: 'no_customer_text', label: 'Se não houver cadastro', def: CRM_TEXTS.no_customer },
    { key: 'no_subscription_text', label: 'Se não houver assinatura', def: CRM_TEXTS.no_subscription },
    { key: 'nothing_open_text', label: 'Se não houver cobrança em aberto', def: CRM_TEXTS.invoice.nothing_open_text },
    { key: 'failed_text', label: 'Se der erro', def: CRM_TEXTS.failed }
  ].filter((i) => keys.includes(i.key));
  return (
    <Box>
      <Button size="small" onClick={() => setOpen((v) => !v)} sx={{ ...smallBtnSx, px: 0.5 }}>
        {open ? 'Ocultar' : 'Mensagens de erro'} ({items.length})
      </Button>
      {open ? (
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Cada uma só é enviada quando a saída correspondente <b>não</b> está ligada a outro bloco — ligada, quem fala é o próximo bloco.
          </Typography>
          {items.map((i) => (
            <CrmText key={i.key} value={data[i.key]} onChange={(v) => setD({ [i.key]: v })} label={i.label} def={i.def} minRows={1} />
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}

// ---- campos personalizados que o bot pergunta / mostra (Fase 7)
const CF_TAB = { customer: 'Clientes', ticket: 'Chamados', order: 'Pedidos' };
function CfLink({ entity }) {
  return (
    <Button
      component={RouterLink}
      to="/whatsapp/customers"
      size="small"
      sx={{ ...smallBtnSx, p: 0, minWidth: 0, fontSize: 12, verticalAlign: 'baseline' }}
    >
      Clientes → Campos personalizados (aba {CF_TAB[entity]})
    </Button>
  );
}
/** Aviso com os campos personalizados da entidade que o bot vai PERGUNTAR (ask_in_bot ou obrigatório). */
function CustomFieldsAsked({ entity, exclude = [], what }) {
  const { customFieldMap } = useBot();
  if (!customFieldMap) return null;
  const list = askedCustomFields(customFieldMap, entity, exclude);
  if (!list.length)
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        Nenhum campo personalizado de {CF_TAB[entity].toLowerCase()} é pedido pelo bot. Para pedir (ex.: {what}), marque “Pedir no bot” em{' '}
        <CfLink entity={entity} />.
      </Typography>
    );
  return (
    <Alert severity="info" icon={<IconInfoCircle size={18} />} sx={{ borderRadius: 2, '& .MuiAlert-message': { minWidth: 0 } }}>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
        O bot vai perguntar também:
      </Typography>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>
        {list.map((f) => (
          <Chip
            key={f.key}
            size="small"
            label={`${f.label}${f.required ? ' · obrigatório' : ''}`}
            sx={{ fontWeight: 600, maxWidth: '100%' }}
          />
        ))}
      </Stack>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
        Um por vez, depois das perguntas do bloco (obrigatórios sempre são pedidos; os outros aceitam “pular”). Configure em{' '}
        <CfLink entity={entity} />.
      </Typography>
    </Alert>
  );
}
/** Lembrete: campos “visíveis ao cliente” entram nas consultas por {{x.campos}}. */
function CustomFieldsVisible({ entity, varName }) {
  const { customFieldMap } = useBot();
  const list = customFieldMap ? visibleCustomFields(customFieldMap, entity) : [];
  return (
    <Hint icon={IconInfoCircle}>
      Os campos personalizados marcados como “visíveis ao cliente” aparecem por <b>{`{{${varName}}}`}</b>
      {list.length ? ` (hoje: ${list.map((f) => f.label).join(', ')})` : ' (nenhum marcado hoje)'}. Configure em <CfLink entity={entity} />.
    </Hint>
  );
}

function CrmSettingsHint() {
  const { crmSettings } = useBot();
  if (!crmSettings) return null;
  const id = crmSettings.identity || {};
  return (
    <Hint icon={IconInfoCircle}>
      Identificação da organização: {id.require_doc ? <b>exige CPF/CNPJ</b> : <b>pelo número do WhatsApp</b>}
      {id.use_code ? ` · usa “${id.code_label || 'código'}”` : ''}.{' '}
      <Button
        component={RouterLink}
        to="/whatsapp/customers"
        size="small"
        sx={{ ...smallBtnSx, p: 0, minWidth: 0, fontSize: 12, verticalAlign: 'baseline' }}
      >
        Alterar em Clientes
      </Button>
    </Hint>
  );
}

// ---- Identificar cliente
function IdentifyEditor({ data, setD }) {
  const { crmSettings } = useBot();
  const mode = IDENTIFY_MODES.find((m) => m.id === data.mode) || IDENTIFY_MODES[0];
  const eff = data.mode === 'org' ? (crmSettings?.identity?.require_doc ? 'ask_doc' : 'phone') : data.mode;
  const asks = eff === 'ask_doc' || eff === 'ask_code';
  const code = crmSettings?.identity?.code_label || 'código de cliente';
  return (
    <Stack spacing={2}>
      <Box>
        <TextField
          select
          size="small"
          fullWidth
          label="Como identificar"
          value={data.mode || 'org'}
          onChange={(e) => setD({ mode: e.target.value })}
        >
          {IDENTIFY_MODES.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.label}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, pl: 0.25 }}>
          {mode.hint}
          {data.mode === 'org' && crmSettings ? ` Hoje: ${eff === 'phone' ? 'pelo número.' : 'pergunta o CPF/CNPJ.'}` : ''}
        </Typography>
      </Box>
      <CrmSettingsHint />
      {asks ? (
        <>
          <CrmText
            value={data.ask_text}
            onChange={(ask_text) => setD({ ask_text })}
            label="Pergunta"
            def={
              eff === 'ask_code'
                ? `Qual é o seu ${code}?`
                : crmSettings?.identity?.ask_doc_text || 'Para continuar, me informe o seu CPF ou CNPJ (só números).'
            }
            vars={BASE_VARS}
          />
          <CrmText
            value={data.invalid_text}
            onChange={(invalid_text) => setD({ invalid_text })}
            label="Se o formato for inválido"
            def={
              eff === 'ask_code'
                ? 'Não reconheci esse código. Pode conferir?'
                : crmSettings?.identity?.doc_invalid_text || 'Esse documento não parece válido. Pode conferir e enviar de novo?'
            }
            vars={BASE_VARS}
            minRows={1}
          />
          <IntField
            label="Tentativas"
            value={data.retries}
            min={1}
            max={10}
            onChange={(retries) => setD({ retries })}
            helperText='Depois disso, segue por "Documento inválido" (ou "Não encontrado").'
            sx={{ width: 200 }}
          />
        </>
      ) : null}
      <CrmText
        value={data.not_found_text}
        onChange={(not_found_text) => setD({ not_found_text })}
        label="Se não encontrar o cadastro"
        def={asks ? crmSettings?.identity?.doc_not_found_text || 'Não encontrei um cadastro com esse documento.' : ''}
        helperText={
          asks
            ? 'Vazio = usa o texto de Configurações → Clientes.'
            : 'Pelo número, o padrão é não dizer nada: ligue a saída "Não encontrado" a um cadastro ou mensagem.'
        }
        vars={BASE_VARS}
        minRows={1}
      />
      <CrmText
        value={data.choose_text}
        onChange={(choose_text) => setD({ choose_text })}
        label="Se houver mais de um cadastro no número"
        def={CRM_TEXTS.identify.choose_text}
        vars={BASE_VARS}
        minRows={1}
      />
      <CrmText
        value={data.found_text}
        onChange={(found_text) => setD({ found_text })}
        label="Ao encontrar (opcional)"
        def="Ex.: Oi, {{cliente.primeiro_nome}}! Achei seu cadastro 🙂"
        helperText="Vazio = não envia nada."
        vars={[...BASE_VARS, ...CRM_CUSTOMER_VARS]}
        minRows={1}
      />
      <Hint icon={IconBulb}>
        Depois deste bloco, as variáveis <b>{'{{cliente.*}}'}</b> ficam disponíveis em todos os textos e os blocos de Cliente agem sobre
        esse cadastro.
      </Hint>
    </Stack>
  );
}

// ---- campos (cadastro / atualização)
function FieldsEditor({ fields, onChange }) {
  const { crmSettings } = useBot();
  const customFields = crmSettings?.custom_fields || [];
  const [addEl, setAddEl] = useState(null);
  const list = fields || [];
  const setField = (fid, patch) => onChange(list.map((f) => (f.id === fid ? { ...f, ...patch } : f)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const arr = [...list];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  };
  const used = new Set(list.map((f) => f.key));
  const addable = [
    ...REGISTER_FIELDS.map((f) => ({ key: f.key, label: f.label })),
    ...customFields.map((f) => ({ key: `custom.${f.key}`, label: `${f.label} (personalizado)` }))
  ].filter((f) => !used.has(f.key));
  return (
    <Box>
      <SectionTitle
        title={`Campos (${list.length})`}
        subtitle="Perguntados nesta ordem, um por vez. Em qualquer pergunta o cliente pode responder “cancelar”."
      />
      <Stack spacing={1}>
        {list.map((f, i) => {
          const meta = registerFieldMeta(f.key, customFields);
          const isCustom = meta.custom;
          return (
            <Box key={f.id || f.key} sx={{ ...cardSx, p: 1.1 }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box
                  sx={{
                    minWidth: 26,
                    height: 26,
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 12,
                    color: WA_ACCENT,
                    bgcolor: hexA(WA_GREEN, 0.14),
                    flexShrink: 0
                  }}
                >
                  {i + 1}
                </Box>
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 13 }}>
                  {f.label || meta.label}
                  {isCustom && meta.missing ? (
                    <Typography component="span" sx={{ color: WA_WARN, fontSize: 11, ml: 0.5 }}>
                      (campo removido)
                    </Typography>
                  ) : null}
                </Typography>
                <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)}>
                  <IconArrowUp size={14} />
                </IconButton>
                <IconButton size="small" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                  <IconArrowDown size={14} />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => onChange(list.filter((x) => x.id !== f.id))}>
                  <IconTrash size={14} />
                </IconButton>
              </Stack>
              <Stack spacing={1.25} sx={{ mt: 1.25 }}>
                <VarTextField
                  value={f.question || ''}
                  onChange={(question) => setField(f.id, { question })}
                  label="Pergunta"
                  placeholder={meta.question || `Qual é o seu ${(f.label || meta.label).toLowerCase()}?`}
                  minRows={1}
                  showFormatHint={false}
                  helperText="Vazio = pergunta padrão."
                />
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    label="Rótulo no resumo"
                    value={f.label || ''}
                    onChange={(e) => setField(f.id, { label: e.target.value.slice(0, 60) })}
                    placeholder={meta.label}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    select
                    size="small"
                    label="Validação"
                    value={f.validate || meta.validate || 'any'}
                    onChange={(e) => setField(f.id, { validate: e.target.value })}
                    sx={{ minWidth: 150 }}
                  >
                    {VALIDATE_OPTIONS.map((o) => (
                      <MenuItem key={o.id} value={o.id}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <ToggleRow
                  checked={f.required !== false}
                  onChange={(required) => setField(f.id, { required })}
                  label="Obrigatório"
                  hint={f.required === false ? 'O cliente pode responder “pular”.' : undefined}
                />
              </Stack>
            </Box>
          );
        })}
      </Stack>
      <Button
        size="small"
        startIcon={<IconPlus size={15} />}
        disabled={!addable.length}
        onClick={(e) => setAddEl(e.currentTarget)}
        sx={{ ...smallBtnSx, mt: 1 }}
      >
        Adicionar campo
      </Button>
      <Menu anchorEl={addEl} open={Boolean(addEl)} onClose={() => setAddEl(null)}>
        {addable.map((a) => (
          <MenuItem
            key={a.key}
            onClick={() => {
              setAddEl(null);
              onChange([...list, newField(a.key, customFields)]);
            }}
          >
            {a.label}
          </MenuItem>
        ))}
      </Menu>
      {!customFields.length ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
          Campos personalizados (ex.: “Unidade”, “Plano de TV”) são cadastrados em{' '}
          <Button
            component={RouterLink}
            to="/whatsapp/customers"
            size="small"
            sx={{ ...smallBtnSx, p: 0, minWidth: 0, fontSize: 11.5, verticalAlign: 'baseline' }}
          >
            Clientes → Campos personalizados
          </Button>
          .
        </Typography>
      ) : null}
    </Box>
  );
}

function RegisterEditor({ data, setD }) {
  return (
    <Stack spacing={2}>
      <CrmText
        value={data.intro_text}
        onChange={(intro_text) => setD({ intro_text })}
        label="Mensagem inicial (opcional)"
        def="Ex.: Vamos fazer o seu cadastro — leva menos de um minuto 🙂"
        helperText="Vazio = vai direto à primeira pergunta."
        vars={BASE_VARS}
      />
      <FieldsEditor fields={data.fields} onChange={(fields) => setD({ fields })} />
      <CustomFieldsAsked
        entity="customer"
        what="unidade, plano de TV"
        exclude={(data.fields || [])
          .map((f) => String(f?.key || ''))
          .filter((k) => k.startsWith('custom.'))
          .map((k) => k.slice(7).toLowerCase())}
      />
      <Divider />
      <ToggleRow
        checked={data.confirm !== false}
        onChange={(confirm) => setD({ confirm })}
        label="Mostrar o resumo e pedir confirmação"
        hint="Se o cliente responder 2, segue por “Cliente desistiu”."
      />
      {data.confirm !== false ? (
        <CrmText
          value={data.confirm_text}
          onChange={(confirm_text) => setD({ confirm_text })}
          label="Confirmação"
          def={CRM_TEXTS.register.confirm_text}
          vars={[{ key: 'resumo', label: 'Resumo dos dados' }, ...BASE_VARS]}
          minRows={3}
        />
      ) : null}
      <CrmText
        value={data.done_text}
        onChange={(done_text) => setD({ done_text })}
        label="Ao concluir"
        def={CRM_TEXTS.register.done_text}
        vars={[...BASE_VARS, ...CRM_CUSTOMER_VARS]}
        minRows={1}
      />
      <FallbackTexts data={data} setD={setD} keys={['failed_text']} />
      <Hint icon={IconInfoCircle}>
        Cria o cliente ligado a este número do WhatsApp (ou atualiza, se o número já tiver cadastro). Depois dele, <b>{'{{cliente.*}}'}</b>{' '}
        já funciona.
      </Hint>
    </Stack>
  );
}

function UpdateEditor({ data, setD }) {
  return (
    <Stack spacing={2}>
      <FieldsEditor fields={data.fields} onChange={(fields) => setD({ fields })} />
      <Divider />
      <ToggleRow checked={data.confirm !== false} onChange={(confirm) => setD({ confirm })} label="Mostrar o resumo e pedir confirmação" />
      {data.confirm !== false ? (
        <CrmText
          value={data.confirm_text}
          onChange={(confirm_text) => setD({ confirm_text })}
          label="Confirmação"
          def={CRM_TEXTS.update.confirm_text}
          vars={[{ key: 'resumo', label: 'Resumo dos dados' }, ...BASE_VARS]}
          minRows={3}
        />
      ) : null}
      <CrmText
        value={data.done_text}
        onChange={(done_text) => setD({ done_text })}
        label="Ao concluir"
        def={CRM_TEXTS.update.done_text}
        vars={[...BASE_VARS, ...CRM_CUSTOMER_VARS]}
        minRows={1}
      />
      <FallbackTexts data={data} setD={setD} keys={['no_customer_text', 'failed_text']} />
      <Hint icon={IconInfoCircle}>
        Só altera os campos perguntados; precisa de um cliente identificado (pelo número ou pelo bloco “Identificar cliente”).
      </Hint>
    </Stack>
  );
}

// ---- Assinar plano
function SubscribeEditor({ data, setD }) {
  const { products, gateway } = useBot();
  const pid = data.product_id || 'choose';
  const pixPossible = data.method !== 'boleto';
  const notReady = data.charge_now !== false && pixPossible && gateway && gateway.ready === false;
  return (
    <Stack spacing={2}>
      {notReady ? (
        <Alert
          severity="warning"
          sx={{ borderRadius: 2 }}
          action={
            <Button
              component={RouterLink}
              to="/settings/payments"
              size="small"
              color="inherit"
              sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Configurar
            </Button>
          }
        >
          <b>Gateway PIX não configurado.</b> Sem ele o bot não consegue gerar a cobrança.
        </Alert>
      ) : null}
      <ProductSelect
        value={pid}
        onChange={(product_id) => setD({ product_id })}
        label="Qual plano"
        extra={[
          { id: 'choose', label: 'O cliente escolhe (lista numerada)' },
          { id: 'from_var', label: 'O escolhido num menu de produtos antes' }
        ]}
        helperText={pid === 'from_var' ? 'Use um bloco “Opções numeradas” no modo Produtos do catálogo antes deste.' : ' '}
      />
      {pid === 'choose' ? (
        <>
          <ProductMultiSelect
            value={data.product_ids || []}
            onChange={(product_ids) => setD({ product_ids })}
            label="Planos oferecidos"
            helperText="Vazio = todos os produtos ativos. Com um só, o bot nem pergunta."
          />
          {products && !productsFor(products, data.product_ids).length ? (
            <Alert severity="warning" sx={{ borderRadius: 2 }} action={<ProductsLink />}>
              Nenhum produto ativo para oferecer.
            </Alert>
          ) : null}
          <CrmText
            value={data.choose_text}
            onChange={(choose_text) => setD({ choose_text })}
            label="Pergunta do plano"
            def={CRM_TEXTS.subscribe.choose_text}
            vars={[...BASE_VARS, ...CRM_CUSTOMER_VARS]}
            minRows={1}
          />
        </>
      ) : null}
      <TextField
        select
        size="small"
        fullWidth
        label="Forma de pagamento"
        value={data.method || 'pix'}
        onChange={(e) => setD({ method: e.target.value })}
      >
        {SUBSCRIBE_METHODS.map((m) => (
          <MenuItem key={m.id} value={m.id}>
            {m.label}
          </MenuItem>
        ))}
      </TextField>
      {data.method === 'ask' ? (
        <CrmText
          value={data.ask_method_text}
          onChange={(ask_method_text) => setD({ ask_method_text })}
          label="Pergunta da forma de pagamento"
          def={CRM_TEXTS.subscribe.ask_method_text}
          vars={BASE_VARS}
        />
      ) : null}
      {data.method !== 'pix' ? (
        <Hint icon={IconInfoCircle}>
          Boleto exige CPF/CNPJ, e-mail e endereço no cadastro (regra do gateway) — garanta esses campos no bloco “Cadastrar cliente”.
        </Hint>
      ) : null}
      <ToggleRow
        checked={data.charge_now !== false}
        onChange={(charge_now) => setD({ charge_now })}
        label="Gerar a 1ª cobrança agora e esperar o pagamento"
        hint={
          data.charge_now !== false
            ? 'Pagou → saída “Pagou”. Venceu → “Cobrança venceu”. Produtos com trial ou valor 0 saem direto por “Assinou”.'
            : 'A assinatura é criada e a cobrança fica para a régua normal; sai por “Assinou (sem cobrança)”.'
        }
      />
      <Divider />
      <ToggleRow checked={data.confirm !== false} onChange={(confirm) => setD({ confirm })} label="Pedir confirmação antes de assinar" />
      {data.confirm !== false ? (
        <CrmText
          value={data.confirm_text}
          onChange={(confirm_text) => setD({ confirm_text })}
          label="Confirmação"
          def={CRM_TEXTS.subscribe.confirm_text}
          vars={[...CRM_PRODUCT_VARS, ...BASE_VARS]}
          minRows={3}
        />
      ) : null}
      <CrmText
        value={data.declined_text}
        onChange={(declined_text) => setD({ declined_text })}
        label="Se o cliente disser não"
        def={CRM_TEXTS.subscribe.declined_text}
        vars={[...CRM_PRODUCT_VARS, ...BASE_VARS]}
        minRows={1}
      />
      {data.charge_now !== false ? (
        <>
          <CrmText
            value={data.paid_text}
            onChange={(paid_text) => setD({ paid_text })}
            label="Quando o pagamento for confirmado"
            def={CRM_TEXTS.subscribe.paid_text}
            vars={[...CRM_PRODUCT_VARS, ...CRM_SUBSCRIPTION_VARS, ...BASE_VARS]}
          />
          <CrmText
            value={data.expired_text}
            onChange={(expired_text) => setD({ expired_text })}
            label="Quando a cobrança vencer sem pagamento"
            def={CRM_TEXTS.subscribe.expired_text}
            vars={[...CRM_PRODUCT_VARS, ...BASE_VARS]}
          />
          <CrmText
            value={data.waiting_text}
            onChange={(waiting_text) => setD({ waiting_text })}
            label="Se o cliente escrever enquanto a cobrança está em aberto"
            def={CRM_TEXTS.subscribe.waiting_text}
            vars={[{ key: 'comando_reiniciar', label: 'Palavra de reinício (ex.: menu)' }, ...CRM_PRODUCT_VARS, ...BASE_VARS]}
            helperText="Vazio = usa o texto padrão. “Paguei” confere o pagamento; a palavra de reinício sai do bloco."
          />
        </>
      ) : null}
      <CrmText
        value={data.already_text}
        onChange={(already_text) => setD({ already_text })}
        label="Se o cliente já assina esse plano"
        def={CRM_TEXTS.subscribe.already_text}
        vars={[...CRM_PRODUCT_VARS, ...BASE_VARS]}
        minRows={1}
        helperText="Plano já assinado (ativo, em atraso ou pausado) não entra de novo; o bot avisa e sai por “Deu erro”."
      />
      <CrmText
        value={data.subscribed_text}
        onChange={(subscribed_text) => setD({ subscribed_text })}
        label="Quando ativar sem cobrança (trial, valor 0 ou “não cobrar agora”)"
        def={CRM_TEXTS.subscribe.subscribed_text}
        vars={[...CRM_PRODUCT_VARS, ...CRM_SUBSCRIPTION_VARS, ...BASE_VARS]}
      />
      <FallbackTexts data={data} setD={setD} keys={['no_customer_text', 'failed_text']} />
      <Hint icon={IconInfoCircle}>
        A cobrança vai pelo caminho normal das Cobranças (PIX/boleto com a régua da organização). Enquanto espera, o bot confere o pagamento
        sozinho; o cliente também pode dizer “paguei”.
      </Hint>
    </Stack>
  );
}

// ---- Informar situação
function InfoEditor({ data, setD }) {
  const what = INFO_WHATS.find((w) => w.id === data.what) || INFO_WHATS[0];
  return (
    <Stack spacing={2}>
      <TextField
        select
        size="small"
        fullWidth
        label="O que informar"
        value={data.what || 'status'}
        onChange={(e) => setD({ what: e.target.value })}
      >
        {INFO_WHATS.map((w) => (
          <MenuItem key={w.id} value={w.id}>
            {w.label}
          </MenuItem>
        ))}
      </TextField>
      <CrmText
        value={data.template}
        onChange={(template) => setD({ template })}
        label={what.id === 'custom' ? 'Texto' : 'Texto (vazio = modelo padrão)'}
        def={
          what.id === 'custom'
            ? 'Ex.: Olá {{cliente.primeiro_nome}}, seu plano {{cliente.produto}} vence dia {{cliente.vencimento}}.'
            : CRM_TEXTS.info[what.id]
        }
        minRows={4}
        helperText={what.id === 'custom' ? 'Monte o texto com as variáveis abaixo.' : 'Vazio = usa o modelo padrão mostrado.'}
      />
      <Hint icon={IconBulb}>
        <b>assinaturas.lista</b> e <b>cobrancas.lista</b> viram uma linha por item (“• Produto — R$ X — vence DD/MM — em dia”). Só funciona
        com cliente identificado.
      </Hint>
      {what.id === 'data' || what.id === 'custom' ? <CustomFieldsVisible entity="customer" varName="cliente.campos" /> : null}
      <FallbackTexts data={data} setD={setD} keys={['no_customer_text']} />
    </Stack>
  );
}

// ---- 2ª via
function InvoiceEditor({ data, setD }) {
  return (
    <Stack spacing={2}>
      <TextField
        select
        size="small"
        fullWidth
        label="Qual cobrança reenviar"
        value={data.which || 'open'}
        onChange={(e) => setD({ which: e.target.value })}
      >
        {INVOICE_WHICH.map((w) => (
          <MenuItem key={w.id} value={w.id}>
            {w.label}
          </MenuItem>
        ))}
      </TextField>
      {data.which === 'choose' ? (
        <CrmText
          value={data.choose_text}
          onChange={(choose_text) => setD({ choose_text })}
          label="Pergunta"
          def={CRM_TEXTS.invoice.choose_text}
          vars={[...BASE_VARS, ...CRM_CUSTOMER_VARS]}
          minRows={1}
        />
      ) : null}
      <TextField
        select
        size="small"
        fullWidth
        label="Como enviar"
        value={data.method || 'same'}
        onChange={(e) => setD({ method: e.target.value })}
      >
        {INVOICE_METHODS.map((m) => (
          <MenuItem key={m.id} value={m.id}>
            {m.label}
          </MenuItem>
        ))}
      </TextField>
      <CrmText
        value={data.sent_text}
        onChange={(sent_text) => setD({ sent_text })}
        label="Depois de enviar"
        def={CRM_TEXTS.invoice.sent_text}
        vars={[...CRM_CHARGE_VARS, ...BASE_VARS]}
        minRows={1}
      />
      <FallbackTexts data={data} setD={setD} keys={['nothing_open_text', 'no_customer_text', 'failed_text']} />
      <Hint icon={IconInfoCircle}>
        A 2ª via recalcula juros e multa (Configurações → Cobranças) e manda o PIX/boleto na conversa — por isso o texto acima diz “acima
        👆”.
      </Hint>
    </Stack>
  );
}

// ---- Cancelar
function CancelEditor({ data, setD }) {
  return (
    <Stack spacing={2}>
      <TextField
        select
        size="small"
        fullWidth
        label="Qual assinatura"
        value={data.subscription || 'single'}
        onChange={(e) => setD({ subscription: e.target.value })}
      >
        {SUBSCRIPTION_PICK.map((o) => (
          <MenuItem key={o.id} value={o.id}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
      <CrmText
        value={data.choose_text}
        onChange={(choose_text) => setD({ choose_text })}
        label="Pergunta de qual assinatura"
        def={CRM_TEXTS.cancel.choose_text}
        vars={BASE_VARS}
        minRows={1}
      />
      <Divider />
      <ToggleRow
        checked={data.ask_reason !== false}
        onChange={(ask_reason) => setD({ ask_reason })}
        label="Perguntar o motivo"
        hint="Lista numerada; qualquer outro texto vale como motivo livre. Fica registrado na assinatura."
      />
      {data.ask_reason !== false ? (
        <>
          <CrmText
            value={data.reason_text}
            onChange={(reason_text) => setD({ reason_text })}
            label="Pergunta do motivo"
            def={CRM_TEXTS.cancel.reason_text}
            vars={[...BASE_VARS, ...CRM_SUBSCRIPTION_VARS]}
            minRows={1}
          />
          <KeywordsInput
            value={data.reasons || []}
            onChange={(reasons) => setD({ reasons })}
            label="Motivos (opcional)"
            placeholder="ex.: Está caro — Enter para adicionar"
            helperText="Vazio = usa a lista da organização (Configurações → Cobranças)."
            normalize={(v) => v.trim().slice(0, 80)}
          />
        </>
      ) : null}
      <CrmText
        value={data.retention_text}
        onChange={(retention_text) => setD({ retention_text })}
        label="Tentativa de retenção (opcional)"
        def="Ex.: Antes de cancelar: que tal 20% de desconto por 3 meses? Responda “quero” e eu aplico."
        helperText="Enviada logo antes da confirmação. Vazio = não envia."
        vars={[...CRM_SUBSCRIPTION_VARS, ...BASE_VARS]}
      />
      <CrmText
        value={data.confirm_text}
        onChange={(confirm_text) => setD({ confirm_text })}
        label="Confirmação"
        def={CRM_TEXTS.cancel.confirm_text}
        vars={[...CRM_SUBSCRIPTION_VARS, ...BASE_VARS]}
        minRows={3}
      />
      <TextField
        select
        size="small"
        fullWidth
        label="Quando o cancelamento vale"
        value={data.policy || 'product'}
        onChange={(e) => setD({ policy: e.target.value })}
        helperText="“Como está no produto” usa a política definida em cada produto."
      >
        {CANCEL_POLICIES.map((o) => (
          <MenuItem key={o.id} value={o.id}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
      <CrmText
        value={data.canceled_text}
        onChange={(canceled_text) => setD({ canceled_text })}
        label="Depois de cancelar"
        def={CRM_TEXTS.cancel.canceled_text}
        vars={[...CRM_SUBSCRIPTION_VARS, ...BASE_VARS]}
        helperText="{{assinatura.fim_texto}} vira “Seu acesso continua até DD/MM.” ou “O cancelamento vale a partir de agora.”"
      />
      <CrmText
        value={data.kept_text}
        onChange={(kept_text) => setD({ kept_text })}
        label="Se o cliente mantiver"
        def={CRM_TEXTS.cancel.kept_text}
        vars={[...CRM_SUBSCRIPTION_VARS, ...BASE_VARS]}
        minRows={1}
      />
      <FallbackTexts data={data} setD={setD} keys={['no_subscription_text', 'no_customer_text', 'failed_text']} />
    </Stack>
  );
}

// ---- Pausar
function PauseEditor({ data, setD }) {
  return (
    <Stack spacing={2}>
      <CrmText
        value={data.choose_text}
        onChange={(choose_text) => setD({ choose_text })}
        label="Pergunta de qual assinatura (se houver mais de uma)"
        def={CRM_TEXTS.pause.choose_text}
        vars={BASE_VARS}
        minRows={1}
      />
      <ToggleRow
        checked={data.ask_until !== false}
        onChange={(ask_until) => setD({ ask_until })}
        label="Perguntar por quantos dias"
        hint={data.ask_until !== false ? 'O cliente responde com um número de dias.' : 'Pausa sempre pelo mesmo número de dias.'}
      />
      <Stack direction="row" spacing={1}>
        <IntField
          label="Máximo de dias"
          value={data.max_days}
          min={1}
          max={365}
          onChange={(max_days) => setD({ max_days })}
          sx={{ flex: 1 }}
        />
        {data.ask_until === false ? (
          <IntField label="Dias da pausa" value={data.days} min={1} max={365} onChange={(days) => setD({ days })} sx={{ flex: 1 }} />
        ) : null}
      </Stack>
      {data.ask_until !== false ? (
        <CrmText
          value={data.ask_text}
          onChange={(ask_text) => setD({ ask_text })}
          label="Pergunta dos dias"
          def={CRM_TEXTS.pause.ask_text}
          vars={[{ key: 'max_dias', label: 'Máximo de dias' }, ...BASE_VARS]}
          minRows={1}
        />
      ) : null}
      <CrmText
        value={data.paused_text}
        onChange={(paused_text) => setD({ paused_text })}
        label="Depois de pausar"
        def={CRM_TEXTS.pause.paused_text}
        vars={[...CRM_SUBSCRIPTION_VARS, ...BASE_VARS]}
        minRows={1}
      />
      {data.ask_until !== false ? (
        <CrmText
          value={data.canceled_text}
          onChange={(canceled_text) => setD({ canceled_text })}
          label="Se o cliente desistir (“cancelar”) na pergunta dos dias"
          def={CRM_TEXTS.pause.canceled_text}
          vars={[...CRM_SUBSCRIPTION_VARS, ...BASE_VARS]}
          minRows={1}
          helperText="Vazio = usa o texto padrão. Depois o bot sai por “Deu erro” (a assinatura continua como está)."
        />
      ) : null}
      <FallbackTexts data={data} setD={setD} keys={['no_subscription_text', 'no_customer_text', 'failed_text']} />
      <Hint icon={IconInfoCircle}>
        Enquanto pausada, nenhuma cobrança é gerada; o vencimento é empurrado ao retomar. Assinatura já pausada sai por “Sem assinatura”.
      </Hint>
    </Stack>
  );
}

// ---- Trocar de plano
function ChangePlanEditor({ data, setD }) {
  const { products } = useBot();
  return (
    <Stack spacing={2}>
      <ProductMultiSelect
        value={data.product_ids || []}
        onChange={(product_ids) => setD({ product_ids })}
        label="Planos permitidos"
        helperText="Vazio = todos os produtos ativos. O plano atual do cliente nunca aparece na lista."
      />
      {products && productsFor(products, data.product_ids).length < 2 ? (
        <Alert severity="warning" sx={{ borderRadius: 2 }} action={<ProductsLink />}>
          Com menos de 2 produtos ativos não há para onde trocar.
        </Alert>
      ) : null}
      <CrmText
        value={data.choose_sub_text}
        onChange={(choose_sub_text) => setD({ choose_sub_text })}
        label="Pergunta de qual assinatura (se houver mais de uma)"
        def={CRM_TEXTS.change_plan.choose_sub_text}
        vars={BASE_VARS}
        minRows={1}
      />
      <CrmText
        value={data.choose_text}
        onChange={(choose_text) => setD({ choose_text })}
        label="Pergunta do novo plano"
        def={CRM_TEXTS.change_plan.choose_text}
        vars={[...BASE_VARS, ...CRM_SUBSCRIPTION_VARS]}
        minRows={1}
      />
      <Divider />
      <ToggleRow checked={data.confirm !== false} onChange={(confirm) => setD({ confirm })} label="Pedir confirmação antes de trocar" />
      {data.confirm !== false ? (
        <CrmText
          value={data.confirm_text}
          onChange={(confirm_text) => setD({ confirm_text })}
          label="Confirmação"
          def={CRM_TEXTS.change_plan.confirm_text}
          vars={[...CRM_PRODUCT_VARS, ...CRM_SUBSCRIPTION_VARS, ...BASE_VARS]}
          minRows={3}
        />
      ) : null}
      <CrmText
        value={data.changed_text}
        onChange={(changed_text) => setD({ changed_text })}
        label="Depois de trocar"
        def={CRM_TEXTS.change_plan.changed_text}
        vars={[...CRM_PRODUCT_VARS, ...CRM_SUBSCRIPTION_VARS, ...BASE_VARS]}
        minRows={1}
      />
      <CrmText
        value={data.kept_text}
        onChange={(kept_text) => setD({ kept_text })}
        label="Se o cliente mantiver o atual"
        def={CRM_TEXTS.change_plan.kept_text}
        vars={[...CRM_SUBSCRIPTION_VARS, ...BASE_VARS]}
        minRows={1}
      />
      <FallbackTexts data={data} setD={setD} keys={['no_subscription_text', 'no_customer_text', 'failed_text']} />
      <Hint icon={IconInfoCircle}>
        O crédito do período não usado vira desconto na próxima cobrança (pró-rata do motor de assinaturas).
      </Hint>
    </Stack>
  );
}

// =============================================================================
// Agenda (Fase 6)
// =============================================================================
const BOOK_TEXT_VARS = [
  ...BOOK_VARS,
  ...BASE_VARS,
  { key: 'cliente.primeiro_nome', label: 'Primeiro nome do cliente' },
  { key: 'cobranca.valor', label: 'Valor a pagar (cobrança)' },
  { key: 'comando_reiniciar', label: 'Palavra para recomeçar' }
];
const SHORT_KEYS = new Set([
  'any_resource',
  'more_days',
  'first_days',
  'more_times',
  'first_times',
  'other_day',
  'opt_confirm',
  'opt_pay',
  'opt_reschedule',
  'opt_cancel',
  'opt_back'
]);
const BOOK_TEXT_GROUPS = {
  book_service: [
    {
      title: 'Perguntas',
      keys: [
        ['choose_service', 'Escolher o serviço'],
        ['choose_resource', 'Escolher com quem'],
        ['any_resource', 'Opção "tanto faz"'],
        ['choose_day', 'Escolher o dia'],
        ['choose_time', 'Escolher o horário'],
        ['confirm', 'Confirmação']
      ]
    },
    {
      title: 'Resultado e pagamento',
      keys: [
        ['booked', 'Agendado (pagamento no local / incluso no plano)'],
        ['pending_payment', 'Cobrança gerada (o código PIX vai logo depois)'],
        ['waiting', 'Resposta enquanto espera o pagamento'],
        ['paid', 'Pagamento confirmado'],
        ['expired', 'Prazo para pagar terminou']
      ]
    },
    {
      title: 'Avisos',
      keys: [
        ['no_slots', 'Sem horário livre'],
        ['no_services', 'Sem serviço disponível'],
        ['day_full', 'O dia escolhido esgotou'],
        ['conflict', 'Horário reservado por outra pessoa'],
        ['busy', 'Cliente já tem agendamento no horário'],
        ['cancel', 'Cliente desistiu'],
        ['failed', 'Erro (só quando a saída "Deu erro" não está ligada)']
      ]
    },
    {
      title: 'Botões das listas',
      keys: [
        ['more_days', 'Ver mais dias'],
        ['first_days', 'Voltar aos primeiros dias'],
        ['more_times', 'Mais horários'],
        ['first_times', 'Primeiros horários'],
        ['other_day', 'Outro dia']
      ]
    }
  ],
  my_appointments: [
    {
      title: 'Lista e ações',
      keys: [
        ['list', 'Escolher o agendamento (2 ou mais)'],
        ['none', 'Sem agendamentos'],
        ['choose_action', 'O que fazer com o agendamento'],
        ['details', 'Detalhes (quando não há ação liberada)'],
        ['opt_confirm', 'Opção "confirmar presença"'],
        ['opt_pay', 'Opção "ver o PIX"'],
        ['opt_reschedule', 'Opção "remarcar"'],
        ['opt_cancel', 'Opção "cancelar"'],
        ['opt_back', 'Opção "nada"'],
        ['pay_text', 'Antes de reenviar o PIX']
      ]
    },
    {
      title: 'Confirmar e cancelar',
      keys: [
        ['confirmed', 'Presença confirmada'],
        ['cancel_free', 'Cancelar dentro do prazo (sem custo)'],
        ['cancel_late', 'Cancelar fora do prazo'],
        ['canceled', 'Cancelado'],
        ['kept', 'Desistiu / manteve']
      ]
    },
    {
      title: 'Remarcar',
      keys: [
        ['choose_day', 'Escolher o dia'],
        ['choose_time', 'Escolher o horário'],
        ['confirm', 'Confirmar a remarcação'],
        ['rescheduled', 'Remarcado'],
        ['no_slots', 'Sem outro horário livre'],
        ['conflict', 'Horário reservado por outra pessoa'],
        ['failed', 'Erro (só quando a saída "Deu erro" não está ligada)']
      ]
    }
  ],
  waitlist_join: [
    {
      title: 'Textos',
      keys: [
        ['choose_service', 'Escolher o serviço'],
        ['choose_period', 'Escolher o período'],
        ['done', 'Entrou na lista'],
        ['cancel', 'Desistiu'],
        ['failed', 'Erro (só quando a saída "Deu erro" não está ligada)']
      ]
    }
  ]
};

/** Textos de um bloco de agenda, em grupos que abrem/fecham (vazio = texto padrão do motor). */
function BookTexts({ type, data, setD }) {
  const [open, setOpen] = useState(0);
  const texts = data.texts || {};
  const setT = (k, v) => setD({ texts: { ...texts, [k]: v } });
  return (
    <Stack spacing={0.75}>
      {(BOOK_TEXT_GROUPS[type] || []).map((g, gi) => (
        <Box key={g.title}>
          <Button size="small" onClick={() => setOpen(open === gi ? -1 : gi)} sx={{ ...smallBtnSx, px: 0.5 }}>
            {open === gi ? 'Ocultar' : 'Editar'}: {g.title} ({g.keys.length})
          </Button>
          {open === gi ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {g.keys.map(([k, label]) => (
                <CrmText
                  key={k}
                  value={texts[k]}
                  onChange={(v) => setT(k, v)}
                  label={label}
                  def={bookDefault(type, k)}
                  vars={BOOK_TEXT_VARS}
                  minRows={SHORT_KEYS.has(k) ? 1 : 2}
                  single={SHORT_KEYS.has(k)}
                />
              ))}
            </Stack>
          ) : null}
        </Box>
      ))}
    </Stack>
  );
}

function AgendaLinks() {
  return (
    <Stack direction="row" spacing={0.5}>
      <Button component={RouterLink} to="/whatsapp/products" size="small" color="inherit" sx={{ fontWeight: 700 }}>
        Serviços
      </Button>
      <Button component={RouterLink} to="/whatsapp/resources" size="small" color="inherit" sx={{ fontWeight: 700 }}>
        Profissionais
      </Button>
      <Button component={RouterLink} to="/whatsapp/agenda" size="small" color="inherit" sx={{ fontWeight: 700 }}>
        Agenda
      </Button>
    </Stack>
  );
}

const svcLabel = (x) =>
  [x.name, x.price_label || (x.price_cents ? fmtBRLi(x.price_cents) : ''), x.duration_label].filter(Boolean).join(' · ');
const fmtBRLi = (c) => ((Number(c) || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function ServicesMultiSelect({ value, onChange }) {
  const { services } = useBookCatalog();
  const list = services || [];
  const ids = value || [];
  const selected = ids.map((id) => list.find((x) => x.id === id) || { id, name: 'Serviço removido', missing: true });
  return (
    <Autocomplete
      multiple
      size="small"
      options={list}
      value={selected}
      onChange={(_, v) => onChange(v.map((x) => x.id))}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      getOptionLabel={(x) => (x.missing ? 'Serviço removido' : svcLabel(x))}
      renderTags={(vals, getTagProps) =>
        vals.map((x, i) => {
          const { key, ...rest } = getTagProps({ index: i });
          return (
            <Chip
              key={key}
              size="small"
              label={x.missing ? 'Serviço removido' : x.name}
              {...rest}
              sx={{ fontWeight: 600, borderRadius: 1.5, textDecoration: x.missing ? 'line-through' : 'none' }}
            />
          );
        })
      }
      noOptionsText={services ? 'Nenhum serviço cadastrado' : 'Carregando…'}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Serviços oferecidos"
          placeholder={ids.length ? '' : 'Todos os serviços'}
          helperText={
            services && !services.length
              ? 'Cadastre um produto do tipo Serviço em WhatsApp → Produtos.'
              : 'Vazio = todos os serviços ativos.'
          }
        />
      )}
    />
  );
}

function BookServiceEditor({ data, setD }) {
  const { services, resources } = useBookCatalog();
  const ids = data.services || [];
  // profissionais que atendem os serviços escolhidos (recurso sem lista de serviços = atende todos)
  const res = (resources || []).filter(
    (r) =>
      r.active !== false && (!ids.length || !Array.isArray(r.services) || !r.services.length || r.services.some((x) => ids.includes(x)))
  );
  const fixedMissing = !BOOK_RESOURCE_MODES.some((m) => m.id === data.resource) && resources && !res.some((r) => r.id === data.resource);
  const paid = (services || []).filter(
    (x) => (!ids.length || ids.includes(x.id)) && ['on_booking', 'deposit'].includes(x.booking?.payment)
  );
  return (
    <Stack spacing={2}>
      <ServicesMultiSelect value={ids} onChange={(services) => setD({ services })} />
      <TextField
        select
        size="small"
        fullWidth
        label="Com quem"
        value={data.resource || 'auto'}
        onChange={(e) => setD({ resource: e.target.value })}
        error={Boolean(fixedMissing)}
        helperText={
          fixedMissing
            ? 'O profissional escolhido não existe mais (ou não atende estes serviços).'
            : BOOK_RESOURCE_MODES.find((m) => m.id === data.resource)?.hint || 'Só este profissional/recurso.'
        }
      >
        {BOOK_RESOURCE_MODES.map((m) => (
          <MenuItem key={m.id} value={m.id}>
            {m.label}
          </MenuItem>
        ))}
        {res.length ? <Divider /> : null}
        {res.map((r) => (
          <MenuItem key={r.id} value={r.id}>
            Só com {r.name}
          </MenuItem>
        ))}
        {fixedMissing ? <MenuItem value={data.resource}>Profissional removido</MenuItem> : null}
      </TextField>
      <IntField
        label="Mostrar horários dos próximos (dias)"
        value={data.days_ahead ?? 14}
        min={1}
        max={60}
        onChange={(v) => setD({ days_ahead: v ?? 14 })}
      />
      <ToggleRow
        checked={data.confirm !== false}
        onChange={(confirm) => setD({ confirm })}
        label="Pedir confirmação antes de reservar"
        hint="Mostra serviço, profissional, dia, hora e valor com 1 Confirmar · 2 Outro horário · 3 Desistir."
      />
      {paid.length ? (
        <Hint icon={IconInfoCircle}>
          {paid.map((x) => x.name).join(', ')} {paid.length === 1 ? 'cobra' : 'cobram'} na reserva: o bot manda o PIX e o horário fica
          guardado até o prazo do serviço. Pago → saída <b>Agendou</b>; não pagou → <b>Não pagou no prazo</b>.
        </Hint>
      ) : null}
      <BookTexts type="book_service" data={data} setD={setD} />
      <Hint icon={IconBulb}>
        Pagamento (no local, PIX na reserva, sinal ou incluso no plano), duração e política de cancelamento são do serviço. O cliente pode
        digitar “14h”, “quarta” ou “15/10” além do número.
      </Hint>
      <AgendaLinks />
    </Stack>
  );
}

function MyAppointmentsEditor({ data, setD }) {
  return (
    <Stack spacing={2}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Lista os próximos agendamentos (até 5) do contato e dos clientes dele e oferece as ações abaixo.
      </Typography>
      <ToggleRow checked={data.allow_confirm !== false} onChange={(allow_confirm) => setD({ allow_confirm })} label="Confirmar presença" />
      <ToggleRow
        checked={data.allow_reschedule !== false}
        onChange={(allow_reschedule) => setD({ allow_reschedule })}
        label="Remarcar"
        hint="Respeita o limite de remarcações do serviço; mantém o pagamento."
      />
      <ToggleRow
        checked={data.allow_cancel !== false}
        onChange={(allow_cancel) => setD({ allow_cancel })}
        label="Cancelar"
        hint="Avisa se está dentro do prazo sem custo e pede confirmação."
      />
      <IntField
        label="Remarcar: horários dos próximos (dias)"
        value={data.days_ahead ?? 14}
        min={1}
        max={60}
        onChange={(v) => setD({ days_ahead: v ?? 14 })}
      />
      <BookTexts type="my_appointments" data={data} setD={setD} />
      <Hint icon={IconInfoCircle}>
        Segurança: só aparecem agendamentos deste contato ou de clientes vinculados ao número / conferidos pelo CPF/CNPJ. Quem se
        identificou só pelo código pode ver e confirmar, mas não remarca nem cancela.
      </Hint>
      <AgendaLinks />
    </Stack>
  );
}

function WaitlistEditor({ data, setD }) {
  const { services } = useBookCatalog();
  const list = services || [];
  const fixed = !WAITLIST_PRODUCT_MODES.some((m) => m.id === data.product_id);
  const missing = fixed && services && !list.some((x) => x.id === data.product_id);
  return (
    <Stack spacing={2}>
      <TextField
        select
        size="small"
        fullWidth
        label="Serviço"
        value={data.product_id || 'current'}
        onChange={(e) => setD({ product_id: e.target.value })}
        error={Boolean(missing)}
        helperText={
          missing ? 'O serviço escolhido não existe mais.' : WAITLIST_PRODUCT_MODES.find((m) => m.id === data.product_id)?.hint || ' '
        }
      >
        {WAITLIST_PRODUCT_MODES.map((m) => (
          <MenuItem key={m.id} value={m.id}>
            {m.label}
          </MenuItem>
        ))}
        {list.length ? <Divider /> : null}
        {list.map((x) => (
          <MenuItem key={x.id} value={x.id}>
            {svcLabel(x)}
          </MenuItem>
        ))}
        {missing ? <MenuItem value={data.product_id}>Serviço removido</MenuItem> : null}
      </TextField>
      <TextField
        select
        size="small"
        fullWidth
        label="Período"
        value={data.period || 'ask'}
        onChange={(e) => setD({ period: e.target.value })}
      >
        {WAITLIST_PERIOD_MODES.map((m) => (
          <MenuItem key={m.id} value={m.id}>
            {m.label}
          </MenuItem>
        ))}
      </TextField>
      <IntField
        label="Aceitar horários dos próximos (dias)"
        value={data.days_ahead ?? 14}
        min={1}
        max={60}
        onChange={(v) => setD({ days_ahead: v ?? 14 })}
      />
      <BookTexts type="waitlist_join" data={data} setD={setD} />
      <Hint icon={IconInfoCircle}>
        Quando um horário compatível abre, a agenda oferece ao 1º da fila por mensagem (ele responde “1” para reservar). Ligue a saída “Sem
        horário livre” do bloco Agendar a este bloco.
      </Hint>
    </Stack>
  );
}

// =============================================================================
// Chamados (Fase 6B)
// =============================================================================
const TICKET_TEXT_VARS = [...TICKET_VARS, ...BASE_VARS, { key: 'cliente.primeiro_nome', label: 'Primeiro nome do cliente' }];
const TICKET_SHORT_KEYS = new Set(['opt_add_info', 'opt_back', 'ask_protocol']);
const TICKET_TEXT_GROUPS = {
  open_ticket: [
    {
      title: 'Perguntas',
      keys: [
        ['choose_category', 'Escolher a categoria'],
        ['ask_subject', 'Perguntar o assunto'],
        ['ask_description', 'Pedir a descrição'],
        ['short_description', 'Descrição curta demais'],
        ['ask_photo', 'Pedir fotos/documentos']
      ]
    },
    {
      title: 'Fotos',
      keys: [
        ['photo_received', 'Foto recebida (use {{chamado.anexos}})'],
        ['photo_invalid', 'Mandou outra coisa na etapa das fotos'],
        ['media_failed', 'Arquivo que não chegou']
      ]
    },
    {
      title: 'Resultado',
      keys: [
        ['created', 'Chamado aberto (protocolo)'],
        ['cancel', 'Cliente desistiu'],
        ['failed', 'Erro (só quando a saída "Deu erro" não está ligada)']
      ]
    }
  ],
  my_tickets: [
    {
      title: 'Lista e detalhes',
      keys: [
        ['list', 'Escolher o chamado (2 ou mais)'],
        ['ask_protocol', 'Linha "ou digite o protocolo"'],
        ['none', 'Sem chamados'],
        ['not_found', 'Protocolo não encontrado'],
        ['details', 'Detalhes do chamado'],
        ['closed', 'Chamado encerrado']
      ]
    },
    {
      title: 'Enviar mais informações',
      keys: [
        ['opt_add_info', 'Opção 1'],
        ['opt_back', 'Opção 0'],
        ['ask_info', 'Pedir a informação'],
        ['info_added', 'Informação juntada'],
        ['media_failed', 'Arquivo que não chegou'],
        ['failed', 'Erro (só quando a saída "Deu erro" não está ligada)']
      ]
    }
  ]
};

/** Textos de um bloco de chamado, em grupos que abrem/fecham (vazio = texto padrão do motor). */
function TicketTexts({ type, data, setD }) {
  const [open, setOpen] = useState(-1);
  const texts = data.texts || {};
  const setT = (k, v) => setD({ texts: { ...texts, [k]: v } });
  return (
    <Stack spacing={0.75}>
      {(TICKET_TEXT_GROUPS[type] || []).map((g, gi) => (
        <Box key={g.title}>
          <Button size="small" onClick={() => setOpen(open === gi ? -1 : gi)} sx={{ ...smallBtnSx, px: 0.5 }}>
            {open === gi ? 'Ocultar' : 'Editar'}: {g.title} ({g.keys.length})
          </Button>
          {open === gi ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {g.keys.map(([k, label]) => (
                <CrmText
                  key={k}
                  value={texts[k]}
                  onChange={(v) => setT(k, v)}
                  label={label}
                  def={ticketDefault(type, k)}
                  vars={TICKET_TEXT_VARS}
                  minRows={TICKET_SHORT_KEYS.has(k) ? 1 : 2}
                  single={TICKET_SHORT_KEYS.has(k)}
                />
              ))}
            </Stack>
          ) : null}
        </Box>
      ))}
    </Stack>
  );
}

function TicketLinks() {
  return (
    <Stack direction="row" spacing={0.5}>
      <Button component={RouterLink} to="/whatsapp/tickets" size="small" color="inherit" sx={{ fontWeight: 700 }}>
        Chamados
      </Button>
    </Stack>
  );
}

function OpenTicketEditor({ data, setD }) {
  const { categories } = useTicketCatalog();
  const list = categories || [];
  const cat = String(data.category || 'ask');
  const fixed = cat !== 'ask';
  const cur = fixed ? list.find((c) => c.key === cat) : null;
  const missing = fixed && categories && !cur;
  const off = fixed && cur && cur.active === false;
  const activeCount = list.filter((c) => c.active !== false).length;
  return (
    <Stack spacing={2}>
      <TextField
        select
        size="small"
        fullWidth
        label="Categoria"
        value={cat}
        onChange={(e) => setD({ category: e.target.value })}
        error={Boolean(missing || off)}
        helperText={
          missing
            ? 'A categoria escolhida não existe mais.'
            : off
              ? 'Esta categoria está desativada — ative em Chamados → Configurações ou escolha outra.'
              : !fixed
                ? categories && !activeCount
                  ? 'Nenhuma categoria ativa — cadastre em Chamados → Configurações.'
                  : 'O bot lista as categorias ativas em menu numerado (com 1 só, escolhe sozinho).'
                : 'Todo chamado deste bloco cai nesta categoria.'
        }
      >
        <MenuItem value="ask">Perguntar ao cliente</MenuItem>
        {list.length ? <Divider /> : null}
        {list.map((c) => (
          <MenuItem key={c.key} value={c.key} disabled={c.active === false && c.key !== cat}>
            {c.label}
            {c.active === false ? ' (desativada)' : ''}
          </MenuItem>
        ))}
        {missing ? <MenuItem value={cat}>Categoria removida</MenuItem> : null}
      </TextField>
      <TextField
        select
        size="small"
        fullWidth
        label="Prioridade"
        value={data.priority || 'default'}
        onChange={(e) => setD({ priority: e.target.value })}
        helperText="Define o prazo (SLA) quando a categoria não tem prazo próprio."
      >
        {TICKET_PRIORITY_OPTIONS.map((o) => (
          <MenuItem key={o.id} value={o.id}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
      <ToggleRow
        checked={data.ask_subject === true}
        onChange={(ask_subject) => setD({ ask_subject })}
        label="Perguntar o assunto"
        hint="Desligado, o assunto é a 1ª linha da descrição."
      />
      <ToggleRow
        checked={data.ask_photo !== false}
        onChange={(ask_photo) => setD({ ask_photo })}
        label="Aceitar fotos/documentos"
        hint="Até 3 arquivos; o cliente digita “pronto” para enviar ou “0” para pular."
      />
      <CustomFieldsAsked entity="ticket" what="nº de série, endereço da instalação" />
      <TicketTexts type="open_ticket" data={data} setD={setD} />
      <Hint icon={IconBulb}>
        Depois de aberto, {'{{chamado.protocolo}}'}, {'{{chamado.categoria}}'}, {'{{chamado.prazo}}'} e {'{{chamado.status}}'} ficam
        disponíveis nos blocos seguintes. A descrição pede pelo menos 5 caracteres (até 2.000).
      </Hint>
      <TicketLinks />
    </Stack>
  );
}

function MyTicketsEditor({ data, setD }) {
  return (
    <Stack spacing={2}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Lista os chamados (até 5, mais recentes) do contato e dos clientes dele. O cliente também pode digitar o número do protocolo.
      </Typography>
      <TextField
        select
        size="small"
        fullWidth
        label="Quais chamados mostrar"
        value={data.show || 'active'}
        onChange={(e) => setD({ show: e.target.value })}
        helperText={TICKET_SHOW_MODES.find((m) => m.id === (data.show || 'active'))?.hint || ' '}
      >
        {TICKET_SHOW_MODES.map((m) => (
          <MenuItem key={m.id} value={m.id}>
            {m.label}
          </MenuItem>
        ))}
      </TextField>
      <ToggleRow
        checked={data.allow_add_info !== false}
        onChange={(allow_add_info) => setD({ allow_add_info })}
        label="Permitir enviar mais informações"
        hint="Texto, foto ou documento entra no histórico do chamado; se estava aguardando o cliente, volta para Aberto."
      />
      <TicketTexts type="my_tickets" data={data} setD={setD} />
      <CustomFieldsVisible entity="ticket" varName="chamado.campos" />
      <Hint icon={IconInfoCircle}>
        Segurança: só aparecem chamados deste contato ou de clientes vinculados ao número / conferidos pelo CPF/CNPJ. Protocolo de outra
        pessoa recebe “não encontrei”. Quem se identificou só pelo código pode consultar, mas não envia informações.
      </Hint>
      <TicketLinks />
    </Stack>
  );
}

// =============================================================================
// Pedidos (Fase 7)
// =============================================================================
const ORDER_TEXT_VARS = [
  ...ORDER_VARS,
  ...BASE_VARS,
  { key: 'cliente.primeiro_nome', label: 'Primeiro nome do cliente' },
  { key: 'comando_reiniciar', label: 'Palavra para recomeçar' }
];
const ORDER_TEXT_GROUPS = {
  order_cart: [
    {
      title: 'Catálogo e carrinho',
      keys: [
        ['choose_category', 'Escolher a categoria'],
        ['choose_product', 'Escolher o produto'],
        ['ask_qty', 'Perguntar a quantidade'],
        ['invalid_qty', 'Quantidade inválida'],
        ['added', 'Produto adicionado'],
        ['cart', 'Carrinho'],
        ['cart_empty', 'Carrinho vazio'],
        ['cart_cleared', 'Carrinho esvaziado'],
        ['max_items', 'Limite de produtos no carrinho'],
        ['min_order', 'Abaixo do pedido mínimo'],
        ['pix_min', 'PIX abaixo de R$ 1,00'],
        ['empty_catalog', 'Catálogo vazio'],
        ['disabled', 'Pedidos desligados']
      ]
    },
    {
      title: 'Entrega e pagamento',
      keys: [
        ['ask_delivery', 'Entrega ou retirada'],
        ['choose_address', 'Escolher endereço salvo'],
        ['ask_address', 'Digitar o endereço'],
        ['invalid_address', 'Endereço incompleto'],
        ['confirm_address', 'Confirmar o endereço digitado'],
        ['ask_notes', 'Pedir observação'],
        ['ask_payment', 'Forma de pagamento'],
        ['summary', 'Resumo do pedido']
      ]
    },
    {
      title: 'Resultado',
      keys: [
        ['created_pix', 'Pedido criado (PIX)'],
        ['created_on_delivery', 'Pedido criado (pagar na entrega)'],
        ['paid', 'PIX pago'],
        ['expired', 'PIX expirou'],
        ['waiting', 'Cliente escreveu esperando o PIX'],
        ['cancel', 'Cliente desistiu (só quando a saída "Desistiu" não está ligada)'],
        ['failed', 'Erro (só quando a saída "Deu erro" não está ligada)']
      ]
    },
    {
      title: 'Botões (opções numeradas)',
      keys: [
        ['opt_next_page', 'Mais produtos'],
        ['opt_prev_page', 'Página anterior'],
        ['opt_categories', 'Voltar às categorias'],
        ['opt_cart', 'Ver carrinho'],
        ['opt_more', 'Adicionar mais itens'],
        ['opt_finish', 'Finalizar pedido'],
        ['opt_clear', 'Esvaziar carrinho'],
        ['opt_delivery', 'Entrega'],
        ['opt_pickup', 'Retirar no local'],
        ['opt_other_address', 'Digitar outro endereço'],
        ['opt_pix', 'PIX'],
        ['opt_on_delivery', 'Pagar na entrega'],
        ['opt_on_pickup', 'Pagar na retirada'],
        ['opt_confirm', 'Confirmar pedido'],
        ['opt_edit', 'Alterar itens'],
        ['opt_cancel', 'Cancelar']
      ]
    }
  ],
  my_orders: [
    {
      title: 'Lista e detalhes',
      keys: [
        ['list', 'Escolher o pedido (2 ou mais)'],
        ['none', 'Sem pedidos'],
        ['details', 'Detalhes do pedido'],
        ['failed', 'Erro (só quando a saída "Deu erro" não está ligada)']
      ]
    }
  ]
};
const isShortOrderKey = (k) => k.startsWith('opt_');

/** Textos e botões de um bloco de pedido, em grupos que abrem/fecham (vazio = texto padrão do motor). */
function OrderTexts({ type, data, setD }) {
  const [open, setOpen] = useState(-1);
  const texts = data.texts || {};
  const setT = (k, v) => setD({ texts: { ...texts, [k]: v } });
  return (
    <Box>
      <SectionTitle title="Textos e botões" subtitle="Vazio = usa o texto padrão (mostrado em cinza)." sx={{ mb: 0.5 }} />
      <Stack spacing={0.75}>
        {(ORDER_TEXT_GROUPS[type] || []).map((g, gi) => (
          <Box key={g.title}>
            <Button size="small" onClick={() => setOpen(open === gi ? -1 : gi)} sx={{ ...smallBtnSx, px: 0.5 }}>
              {open === gi ? 'Ocultar' : 'Editar'}: {g.title} ({g.keys.length})
            </Button>
            {open === gi ? (
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                {g.keys.map(([k, label]) => (
                  <CrmText
                    key={k}
                    value={texts[k]}
                    onChange={(v) => setT(k, v)}
                    label={label}
                    def={orderDefault(type, k)}
                    vars={ORDER_TEXT_VARS}
                    minRows={isShortOrderKey(k) ? 1 : 2}
                    single={isShortOrderKey(k)}
                  />
                ))}
              </Stack>
            ) : null}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function OrderLinks() {
  return (
    <Stack direction="row" spacing={0.5}>
      <Button component={RouterLink} to="/whatsapp/products" size="small" color="inherit" sx={{ fontWeight: 700 }}>
        Produtos
      </Button>
      <Button component={RouterLink} to="/whatsapp/orders" size="small" color="inherit" sx={{ fontWeight: 700 }}>
        Pedidos
      </Button>
    </Stack>
  );
}

/** Categorias do catálogo: lista real (Autocomplete) ou, sem catálogo carregado, digitadas à mão. */
function OrderCategoriesField({ value, onChange }) {
  const { catalogCategories, orderCatalog } = useBot();
  const loaded = Array.isArray(catalogCategories);
  const keys = loaded ? new Set(catalogCategories.map(normText)) : null;
  const counts = new Map((orderCatalog?.catalog?.categories || []).map((c) => [normText(c.name), (c.products || []).length]));
  const list = Array.isArray(value) ? value : [];
  const missing = keys ? list.filter((c) => !keys.has(normText(c))) : [];
  return (
    <Autocomplete
      multiple
      freeSolo={!loaded}
      size="small"
      options={loaded ? catalogCategories : []}
      value={list}
      filterSelectedOptions
      onChange={(_, v) => onChange([...new Set((v || []).map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 40))}
      getOptionLabel={(o) => String(o)}
      renderOption={(props, o) => {
        const { key, ...rest } = props;
        const n = counts.get(normText(o));
        return (
          <li key={key} {...rest}>
            {o}
            {n != null ? (
              <Typography component="span" variant="caption" sx={{ ml: 'auto', pl: 1, color: 'text.secondary' }}>
                {n} {n === 1 ? 'produto' : 'produtos'}
              </Typography>
            ) : null}
          </li>
        );
      }}
      renderTags={(vals, getTagProps) =>
        vals.map((o, i) => {
          const { key, ...rest } = getTagProps({ index: i });
          const bad = keys && !keys.has(normText(o));
          return (
            <Chip key={key} size="small" label={o} color={bad ? 'error' : 'default'} variant={bad ? 'outlined' : 'filled'} {...rest} />
          );
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="Categorias"
          placeholder={list.length ? '' : loaded ? 'Escolha as categorias' : 'Digite o nome e tecle Enter'}
          error={!list.length || missing.length > 0}
          helperText={
            !list.length
              ? 'Escolha pelo menos uma categoria (ou marque “Todas”).'
              : missing.length
                ? `Não existe no catálogo: ${missing.join(', ')}.`
                : loaded
                  ? 'Só os produtos destas categorias aparecem para o cliente.'
                  : 'Catálogo não carregado: digite o nome exato da categoria (Produtos → Categoria).'
          }
        />
      )}
    />
  );
}

function OrderCartEditor({ data, setD }) {
  const { catalogCategories, orderCatalog } = useBot();
  const all = data.categories === 'all' || data.categories == null;
  const pay = ORDER_PAYMENT_OPTIONS.find((o) => o.id === (data.payment || 'ask')) || ORDER_PAYMENT_OPTIONS[0];
  const st = orderCatalog?.settings || null;
  const methods = Array.isArray(st?.payment_methods) ? st.payment_methods : null;
  const noRecv = data.allow_delivery === false && data.allow_pickup === false;
  const total = orderCatalog?.catalog
    ? orderCatalog.catalog.total || (orderCatalog.catalog.categories || []).reduce((a, c) => a + (c.products || []).length, 0)
    : null;
  return (
    <Stack spacing={2}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        O cliente escolhe a categoria e os produtos, monta o carrinho, diz se quer entrega ou retirada e paga. O pedido aparece em{' '}
        <b>WhatsApp → Pedidos</b>.
      </Typography>
      <Box>
        <SectionTitle
          title="Categorias do catálogo"
          subtitle={
            Array.isArray(catalogCategories)
              ? catalogCategories.length
                ? `${catalogCategories.length} ${catalogCategories.length === 1 ? 'categoria' : 'categorias'}${total != null ? ` · ${total} ${total === 1 ? 'produto ativo' : 'produtos ativos'}` : ''} (produtos avulsos ativos).`
                : 'Nenhum produto avulso ativo no catálogo — cadastre em WhatsApp → Produtos.'
              : 'Carregando o catálogo…'
          }
        />
        <Stack spacing={1.25}>
          <Segmented
            fullWidth
            size="sm"
            value={all ? 'all' : 'pick'}
            onChange={(v) => (v === 'all') !== all && setD({ categories: v === 'all' ? 'all' : [] })}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'pick', label: 'Escolher' }
            ]}
          />
          {!all ? <OrderCategoriesField value={data.categories} onChange={(categories) => setD({ categories })} /> : null}
        </Stack>
      </Box>
      <Box>
        <SectionTitle title="Como o cliente recebe" />
        <Stack spacing={1}>
          <ToggleRow
            checked={data.allow_delivery !== false}
            onChange={(allow_delivery) => setD({ allow_delivery })}
            label="Permitir entrega"
            hint={
              st?.delivery?.enabled === false
                ? 'Desligada em Pedidos → Configurações — não vai aparecer.'
                : 'Usa um endereço salvo do cliente ou pede para digitar.'
            }
          />
          <ToggleRow
            checked={data.allow_pickup !== false}
            onChange={(allow_pickup) => setD({ allow_pickup })}
            label="Permitir retirada"
            hint={st?.pickup?.enabled === false ? 'Desligada em Pedidos → Configurações — não vai aparecer.' : 'Retirar no local.'}
          />
          {noRecv ? (
            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
              Permita entrega, retirada ou as duas.
            </Typography>
          ) : null}
        </Stack>
      </Box>
      <TextField
        select
        size="small"
        fullWidth
        label="Pagamento"
        value={pay.id}
        onChange={(e) => setD({ payment: e.target.value })}
        helperText={`${pay.hint} Só aparecem as formas ativas em Pedidos → Configurações${methods ? ` (hoje: ${methods.map((m) => (m === 'pix' ? 'PIX' : m === 'on_delivery' ? 'na entrega' : m)).join(', ') || 'nenhuma'})` : ''}.`}
      >
        {ORDER_PAYMENT_OPTIONS.map((o) => (
          <MenuItem key={o.id} value={o.id}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
      <ToggleRow
        checked={data.ask_notes === true}
        onChange={(ask_notes) => setD({ ask_notes })}
        label="Pedir observação"
        hint="Ex.: “sem cebola”, “troco para R$ 50”. O cliente pode responder “pular”."
      />
      <CustomFieldsAsked entity="order" what="troco para, ponto de referência" />
      <Hint icon={IconBulb}>
        Produtos de 9 em 9, numerados; depois vêm ➡️ Mais produtos, ⬅️ Voltar e 🛒 Ver carrinho com os próximos números. <b>0</b> também
        abre o carrinho. “Cancelar” ou “desistir” em qualquer pergunta sai por <b>Desistiu</b>.
      </Hint>
      <OrderTexts type="order_cart" data={data} setD={setD} />
      <Hint icon={IconInfoCircle}>
        PIX: o pedido é criado, o bot manda o código e espera — pago sai por <b>Pago</b>, vencido por <b>PIX expirou</b>. Na
        entrega/retirada sai na hora por <b>Pedido feito</b>. Depois, {'{{pedido.numero}}'}, {'{{pedido.total}}'} e {'{{pedido.status}}'}{' '}
        ficam disponíveis.
      </Hint>
      <OrderLinks />
    </Stack>
  );
}

function MyOrdersEditor({ data, setD }) {
  return (
    <Stack spacing={2}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Lista os pedidos (até 5, mais recentes) do contato e dos clientes dele; com 1 só, mostra direto os detalhes.
      </Typography>
      <TextField
        select
        size="small"
        fullWidth
        label="Mostrar"
        value={data.show === 'all' ? 'all' : 'open'}
        onChange={(e) => setD({ show: e.target.value })}
        helperText={ORDER_SHOW_MODES.find((m) => m.id === (data.show === 'all' ? 'all' : 'open'))?.hint || ' '}
      >
        {ORDER_SHOW_MODES.map((m) => (
          <MenuItem key={m.id} value={m.id}>
            {m.label}
          </MenuItem>
        ))}
      </TextField>
      <OrderTexts type="my_orders" data={data} setD={setD} />
      <CustomFieldsVisible entity="order" varName="pedido.campos" />
      <OrderLinks />
    </Stack>
  );
}

const EDITORS = {
  message: MessageEditor,
  menu: MenuEditor,
  question: QuestionEditor,
  condition: ConditionEditor,
  tags: TagsEditor,
  wait: WaitEditor,
  pix: PixEditor,
  handoff: HandoffEditor,
  end: EndEditor,
  crm_identify: IdentifyEditor,
  crm_register: RegisterEditor,
  crm_subscribe: SubscribeEditor,
  crm_info: InfoEditor,
  crm_invoice: InvoiceEditor,
  crm_cancel: CancelEditor,
  crm_pause: PauseEditor,
  crm_change_plan: ChangePlanEditor,
  crm_update: UpdateEditor,
  book_service: BookServiceEditor,
  my_appointments: MyAppointmentsEditor,
  waitlist_join: WaitlistEditor,
  open_ticket: OpenTicketEditor,
  my_tickets: MyTicketsEditor,
  order_cart: OrderCartEditor,
  my_orders: MyOrdersEditor
};

// =============================================================================
// Painel
// =============================================================================
export default function BotInspector({ node, onChange, onDelete, onDuplicate, onClose, onOpenSettings }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [node?.id]);
  if (!node) return null;
  const meta = NODE_META[node.type] || NODE_META.message;
  const Icon = meta.icon;
  const Editor = EDITORS[node.type];
  const setD = (patch) => onChange(node.id, patch);
  const isStart = node.type === 'start';

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1.75, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            bgcolor: meta.color,
            backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(0,0,0,0.08))',
            flexShrink: 0
          }}
        >
          <Icon size={18} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: 'text.secondary', textTransform: 'uppercase' }}
            noWrap
          >
            {isStart ? 'Início do fluxo' : meta.label}
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.2 }} noWrap>
            {isStart ? 'Cliente mandou mensagem' : node.data?.title || meta.label}
          </Typography>
        </Box>
        {!isStart ? (
          <>
            <Tooltip title="Duplicar bloco">
              <IconButton size="small" onClick={() => onDuplicate(node.id)}>
                <IconCopy size={17} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Excluir bloco">
              <IconButton size="small" color="error" onClick={() => onDelete(node.id)}>
                <IconTrash size={17} />
              </IconButton>
            </Tooltip>
          </>
        ) : null}
        <Tooltip title="Fechar (Esc)">
          <IconButton size="small" onClick={onClose}>
            <IconX size={17} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box ref={scrollRef} sx={{ p: 2, overflowY: 'auto', overscrollBehavior: 'contain', flex: 1 }}>
        {isStart ? (
          <StartInfo onOpenSettings={onOpenSettings} />
        ) : (
          <>
            <TextField
              label="Nome do bloco (só você vê)"
              size="small"
              fullWidth
              value={node.data?.title || ''}
              onChange={(e) => setD({ title: e.target.value.slice(0, 60) })}
              sx={{ mb: 2.25 }}
            />
            {Editor ? <Editor data={node.data || {}} setD={setD} /> : null}
          </>
        )}
      </Box>
    </Box>
  );
}
