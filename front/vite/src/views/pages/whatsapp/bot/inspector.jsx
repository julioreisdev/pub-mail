// =============================================================================
// WhatsApp — Fluxo do Bot: inspetor (painel lateral) com o editor de cada bloco.
// =============================================================================
import { useEffect, useMemo, useRef } from 'react';
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
  BASE_VARS,
  CONDITION_SOURCES,
  MAX_MENU_OPTIONS,
  OP_LABEL,
  PIX_VARS,
  SAVE_TO_CONTACT,
  SOURCE_OPS,
  VALIDATE_OPTIONS,
  WAIT_UNITS,
  fmtMinutes,
  isReservedVar,
  newMessage,
  newOption,
  newRule,
  opNeedsValue,
  optionPrefix,
  renderMenuText,
  sanitizeVarName,
  validateMeta
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
  useBot,
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
  const { settings } = useBot();
  const opts = data.options || [];
  const numbering = data.numbering || settings?.numbering || 'emoji';
  const setOpts = (arr) => setD({ options: arr });
  const setOpt = (oid, patch) => setOpts(opts.map((o) => (o.id === oid ? { ...o, ...patch } : o)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= opts.length) return;
    const arr = [...opts];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setOpts(arr);
  };
  const preview = renderMenuText({ ...data, numbering }, settings);
  const tries = data.max_retries || settings?.max_retries || 3;

  return (
    <Stack spacing={2}>
      <VarTextField
        value={data.text}
        onChange={(text) => setD({ text })}
        label="Texto acima das opções"
        placeholder="Ex.: Como posso te ajudar? Responda com o número:"
        minRows={2}
      />

      <Box>
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

const EDITORS = {
  message: MessageEditor,
  menu: MenuEditor,
  question: QuestionEditor,
  condition: ConditionEditor,
  tags: TagsEditor,
  wait: WaitEditor,
  pix: PixEditor,
  handoff: HandoffEditor,
  end: EndEditor
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
