import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconArrowDown, IconArrowUp, IconCheck, IconChevronDown, IconPlus, IconTrash } from '@tabler/icons-react';

import { put } from 'api/api';
import { errMsg, tint } from '../waShared';
import { CrmModal, waPrimaryBtn } from './crmKit';
import {
  CF_BOT_ENTITIES,
  CF_ENTITIES,
  CF_MAX_PER_ENTITY,
  CF_RESERVED,
  CF_TYPES,
  cfKey,
  cfTypeLabel,
  loadCrmSettings,
  setCrmSettingsCache
} from './customFields';
import { CustomFieldInput } from './CustomFieldsInputs';

// ============================================================================
// Editor dos campos personalizados POR ENTIDADE (Fase 7, contrato §11.1) + identificação
// do cliente no bot. Abas: Clientes · Produtos · Assinaturas · Cobranças · Chamados ·
// Agendamentos · Pedidos · Identificação. Salva tudo junto em PUT /whatsapp/crm-settings
// {custom_fields: {<entidade>: [...]}, identity}. A chave só é editável enquanto o campo é novo
// (os valores já gravados nos registros usam a chave).
// ============================================================================

const VAR_PREFIX = { customer: 'cliente', product: 'produto', subscription: 'assinatura', ticket: 'chamado', order: 'pedido' };
let uid = 0;
const nextId = () => `f${Date.now().toString(36)}${(uid += 1)}`;

const toRow = (d, isNew = false) => ({
  _id: nextId(),
  _new: isNew,
  _open: isNew,
  key: d.key || '',
  keyTouched: false,
  label: d.label || '',
  type: d.type || 'text',
  required: Boolean(d.required),
  visible_to_customer: Boolean(d.visible_to_customer),
  ask_in_bot: Boolean(d.ask_in_bot),
  help: d.help || '',
  optionsText: (d.options || []).join('\n')
});

const optionsOf = (r) => [
  ...new Set(
    String(r.optionsText || '')
      .split(/[\n,;]/)
      .map((s) => s.trim().slice(0, 60))
      .filter(Boolean)
  )
];

/** Confere uma entidade; devolve {rowId: {campo: mensagem}}. */
function checkRows(rows) {
  const errs = {};
  const seen = new Map();
  for (const r of rows) {
    const e = {};
    const key = cfKey(r.key || r.label);
    if (!r.label.trim()) e.label = 'Dê um nome ao campo';
    if (!key) e.key = 'Use letras e números';
    else if (CF_RESERVED.includes(key)) e.key = 'Chave reservada pelo sistema';
    else if (seen.has(key)) e.key = 'Já existe um campo com esta chave';
    if (r.type === 'select' && !optionsOf(r).length) e.options = 'Informe pelo menos uma opção';
    if (key) seen.set(key, r._id);
    if (Object.keys(e).length) errs[r._id] = e;
  }
  return errs;
}

const defsOf = (rows) =>
  rows.map((r) => {
    const out = {
      key: cfKey(r.key || r.label),
      label: r.label.trim().slice(0, 60),
      type: r.type,
      required: r.required,
      visible_to_customer: r.visible_to_customer,
      ask_in_bot: r.ask_in_bot
    };
    if (r.type === 'select') out.options = optionsOf(r);
    if (r.help.trim()) out.help = r.help.trim().slice(0, 160);
    return out;
  });

function FlagChip({ label, token = 'primary' }) {
  return (
    <Chip
      size="small"
      label={label}
      sx={{
        height: 20,
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 1.5,
        color: `${token}.main`,
        bgcolor: (t) => tint(t, token, 0.12)
      }}
    />
  );
}

function FieldRow({ row, index, count, entity, errors, onPatch, onMove, onRemove }) {
  const botOk = CF_BOT_ENTITIES.includes(entity);
  const prefix = VAR_PREFIX[entity];
  const key = cfKey(row.key || row.label);
  const preview = {
    key: key || 'campo',
    label: row.label || 'Campo sem nome',
    type: row.type,
    required: row.required,
    options: optionsOf(row),
    help: row.help
  };
  const hasErr = Boolean(errors && Object.keys(errors).length);
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: hasErr ? 'error.main' : 'divider',
        borderRadius: 2.5,
        overflow: 'hidden',
        bgcolor: 'background.paper'
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{ pl: 0.5, pr: 1, py: 0.5, bgcolor: row._open ? 'action.hover' : 'transparent' }}
      >
        <Stack sx={{ flexShrink: 0 }}>
          <IconButton size="small" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Subir" sx={{ p: 0.25 }}>
            <IconArrowUp size={14} />
          </IconButton>
          <IconButton size="small" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Descer" sx={{ p: 0.25 }}>
            <IconArrowDown size={14} />
          </IconButton>
        </Stack>
        <ButtonBase
          onClick={() => onPatch({ _open: !row._open })}
          sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', py: 0.75, px: 0.75, borderRadius: 1.5 }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: row.label ? 'text.primary' : 'text.secondary' }} noWrap>
              {row.label || 'Campo sem nome'}
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
              <FlagChip label={cfTypeLabel(row.type)} token="info" />
              {row.required ? <FlagChip label="Obrigatório" token="warning" /> : null}
              {row.ask_in_bot && botOk ? <FlagChip label="Pedido no bot" token="success" /> : null}
              {row.visible_to_customer ? <FlagChip label="Visível ao cliente" token="primary" /> : null}
              {row._new ? <FlagChip label="Novo" token="secondary" /> : null}
            </Stack>
          </Box>
          <IconChevronDown
            size={16}
            style={{ flexShrink: 0, marginLeft: 6, transform: row._open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
          />
        </ButtonBase>
        <Tooltip title="Remover campo">
          <IconButton size="small" color="error" onClick={onRemove} aria-label="Remover campo">
            <IconTrash size={16} />
          </IconButton>
        </Tooltip>
      </Stack>
      <Collapse in={row._open} unmountOnExit>
        <Stack spacing={1.5} sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            <TextField
              size="small"
              label="Nome do campo"
              value={row.label}
              autoFocus={row._new && !row.label}
              onChange={(e) => {
                const label = e.target.value.slice(0, 60);
                onPatch(row._new && !row.keyTouched ? { label, key: cfKey(label) } : { label });
              }}
              error={Boolean(errors?.label)}
              helperText={errors?.label || 'Como aparece no cadastro e no bot.'}
              fullWidth
            />
            <TextField
              size="small"
              label="Chave"
              value={row._new ? row.key : key}
              onChange={(e) => onPatch({ key: cfKey(e.target.value), keyTouched: true })}
              disabled={!row._new}
              error={Boolean(errors?.key)}
              helperText={
                errors?.key ||
                (row._new
                  ? 'Letras minúsculas, números e _. Não muda depois de salvar.'
                  : prefix
                    ? `Variável: {{${prefix}.custom.${key}}}`
                    : 'Não muda depois de salvar (os valores usam a chave).')
              }
              fullWidth
              inputProps={{ style: { fontFamily: 'monospace' } }}
            />
            <TextField select size="small" label="Tipo" value={row.type} onChange={(e) => onPatch({ type: e.target.value })} fullWidth>
              {CF_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Ajuda (opcional)"
              value={row.help}
              onChange={(e) => onPatch({ help: e.target.value.slice(0, 160) })}
              helperText="Texto curto embaixo do campo."
              fullWidth
            />
          </Box>
          {row.type === 'select' ? (
            <TextField
              size="small"
              label="Opções"
              value={row.optionsText}
              onChange={(e) => onPatch({ optionsText: e.target.value })}
              multiline
              minRows={3}
              maxRows={8}
              error={Boolean(errors?.options)}
              helperText={errors?.options || `Uma por linha (ou separadas por vírgula). ${optionsOf(row).length} opção(ões).`}
              fullWidth
            />
          ) : null}
          <Stack spacing={0.25}>
            <FormControlLabel
              control={<Switch size="small" checked={row.required} onChange={(e) => onPatch({ required: e.target.checked })} />}
              label={<Typography variant="body2">Obrigatório (no painel, na API e quando o bot cria o registro)</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={row.visible_to_customer}
                  onChange={(e) => onPatch({ visible_to_customer: e.target.checked })}
                />
              }
              label={<Typography variant="body2">Mostrar ao cliente no bot (nas consultas "Meus dados", "Meus chamados"…)</Typography>}
            />
            <Tooltip
              title={
                botOk ? '' : 'O bot só pede campos de Clientes (Cadastrar cliente), Chamados (Abrir chamado) e Pedidos (Fazer pedido).'
              }
              placement="top-start"
            >
              <FormControlLabel
                disabled={!botOk}
                control={
                  <Switch size="small" checked={row.ask_in_bot && botOk} onChange={(e) => onPatch({ ask_in_bot: e.target.checked })} />
                }
                label={
                  <Typography variant="body2">
                    Pedir no bot{' '}
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      {botOk
                        ? entity === 'customer'
                          ? '(bloco "Cadastrar cliente")'
                          : entity === 'ticket'
                            ? '(bloco "Abrir chamado")'
                            : '(bloco "Fazer pedido")'
                        : '(só Clientes, Chamados e Pedidos)'}
                    </Box>
                  </Typography>
                }
              />
            </Tooltip>
          </Stack>
          <Box sx={{ p: 1.25, borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.75 }}>
              Como aparece no formulário
            </Typography>
            <CustomFieldInput def={preview} value={undefined} onChange={() => undefined} />
          </Box>
        </Stack>
      </Collapse>
    </Box>
  );
}

export default function CustomFieldsEditor({ open, onClose, initialEntity = 'customer', onSaved }) {
  const [tab, setTab] = useState(initialEntity);
  const [rows, setRows] = useState(() => Object.fromEntries(CF_ENTITIES.map((e) => [e.key, []])));
  const [idn, setIdn] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({}); // {rowId: {campo: msg}}
  const [dirty, setDirty] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    const opening = open && !wasOpen.current;
    wasOpen.current = open;
    if (!opening) return;
    setTab(initialEntity || 'customer');
    setErrors({});
    setDirty(false);
    setLoading(true);
    loadCrmSettings(true)
      .then((s) => {
        const map = s?.custom_fields || {};
        setRows(Object.fromEntries(CF_ENTITIES.map((e) => [e.key, (map[e.key] || []).map((d) => toRow(d))])));
        setIdn(s?.identity || {});
      })
      .catch((e) => toast.error(errMsg(e, 'Não foi possível carregar os campos.')))
      .finally(() => setLoading(false));
  }, [open, initialEntity]);

  const entity = CF_ENTITIES.find((e) => e.key === tab) || null;
  const list = entity ? rows[entity.key] || [] : [];

  const patchRow = (id, p) => {
    setDirty(true);
    setRows((m) => ({ ...m, [tab]: m[tab].map((r) => (r._id === id ? { ...r, ...p } : r)) }));
    if (errors[id]) setErrors((x) => ({ ...x, [id]: undefined }));
  };
  const move = (i, dir) => {
    setDirty(true);
    setRows((m) => {
      const xs = [...m[tab]];
      const j = i + dir;
      if (j < 0 || j >= xs.length) return m;
      [xs[i], xs[j]] = [xs[j], xs[i]];
      return { ...m, [tab]: xs };
    });
  };
  const removeRow = (id) => {
    setDirty(true);
    setRows((m) => ({ ...m, [tab]: m[tab].filter((r) => r._id !== id) }));
  };
  const addRow = () => {
    setDirty(true);
    setRows((m) => ({ ...m, [tab]: [...m[tab].map((r) => ({ ...r, _open: false })), toRow({}, true)] }));
  };
  const setI = (k, v) => {
    setDirty(true);
    setIdn((x) => ({ ...x, [k]: v }));
  };

  const counts = useMemo(() => Object.fromEntries(CF_ENTITIES.map((e) => [e.key, (rows[e.key] || []).length])), [rows]);

  const save = async () => {
    // confere todas as entidades; a 1ª com erro vira a aba ativa
    const allErr = {};
    let firstBad = null;
    for (const e of CF_ENTITIES) {
      const errs = checkRows(rows[e.key] || []);
      if (Object.keys(errs).length) {
        Object.assign(allErr, errs);
        if (!firstBad) firstBad = e.key;
      }
    }
    if (firstBad) {
      setErrors(allErr);
      setTab(firstBad);
      setRows((m) => ({ ...m, [firstBad]: m[firstBad].map((r) => (allErr[r._id] ? { ...r, _open: true } : r)) }));
      return toast.error(`Confira os campos de ${CF_ENTITIES.find((e) => e.key === firstBad)?.label}.`);
    }
    setBusy(true);
    try {
      const r = await put('/whatsapp/crm-settings', {
        custom_fields: Object.fromEntries(CF_ENTITIES.map((e) => [e.key, defsOf(rows[e.key] || [])])),
        identity: {
          require_doc: Boolean(idn.require_doc),
          use_code: Boolean(idn.use_code),
          code_label: idn.code_label || undefined,
          ask_doc_text: idn.ask_doc_text || undefined,
          doc_not_found_text: idn.doc_not_found_text || undefined,
          doc_invalid_text: idn.doc_invalid_text || undefined
        }
      });
      setCrmSettingsCache(r);
      onSaved?.(r);
      setDirty(false);
      toast.success('Campos salvos.');
      onClose?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose?.()}
      title="Campos personalizados"
      subtitle="Campos próprios do seu negócio em cada cadastro — e como o bot reconhece o cliente."
      maxWidth="md"
      disableClose={busy}
      tabs={
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ minHeight: 40, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40, px: 1.5 } }}
        >
          {CF_ENTITIES.map((e) => (
            <Tab key={e.key} value={e.key} label={`${e.label}${counts[e.key] ? ` (${counts[e.key]})` : ''}`} />
          ))}
          <Tab value="identity" label="Identificação" />
        </Tabs>
      }
      footer={
        <>
          {dirty ? (
            <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 700, mr: 'auto', display: { xs: 'none', sm: 'block' } }}>
              Alterações não salvas
            </Typography>
          ) : null}
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={save}
            disabled={busy || loading}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCheck size={16} />}
            sx={waPrimaryBtn}
          >
            Salvar
          </Button>
        </>
      }
    >
      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={26} />
        </Stack>
      ) : entity ? (
        <Stack spacing={1.25}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {entity.hint}
            {entity.bot ? ' Campos marcados com "Pedir no bot" são perguntados pelo bot ao criar o registro.' : ''}
          </Typography>
          {list.map((r, i) => (
            <FieldRow
              key={r._id}
              row={r}
              index={i}
              count={list.length}
              entity={entity.key}
              errors={errors[r._id]}
              onPatch={(p) => patchRow(r._id, p)}
              onMove={(dir) => move(i, dir)}
              onRemove={() => removeRow(r._id)}
            />
          ))}
          {!list.length ? (
            <Box sx={{ p: 2.5, borderRadius: 2.5, border: '1px dashed', borderColor: 'divider', textAlign: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Nenhum campo em {entity.label.toLowerCase()}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Exemplos: "Número do contrato", "Placa do veículo", "Convênio", "Data da última visita".
              </Typography>
            </Box>
          ) : null}
          {list.length < CF_MAX_PER_ENTITY ? (
            <Button
              startIcon={<IconPlus size={16} />}
              onClick={addRow}
              sx={{ alignSelf: 'flex-start', fontWeight: 700, textTransform: 'none' }}
            >
              Adicionar campo
            </Button>
          ) : (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Limite de {CF_MAX_PER_ENTITY} campos por cadastro.
            </Typography>
          )}
          {list.some((r) => !r._new) ? (
            <Alert severity="info" sx={{ borderRadius: 2, py: 0.25 }}>
              Remover um campo não apaga os valores já guardados nos registros — eles só deixam de aparecer no formulário.
            </Alert>
          ) : null}
        </Stack>
      ) : (
        <Stack spacing={1.25}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Por padrão o <strong>número do WhatsApp</strong> identifica o cliente: quem fala de um número vinculado ao cadastro é
            reconhecido na hora. Ligue a opção abaixo se quiser que o bot peça o CPF/CNPJ antes de mostrar ou mexer nos dados.
          </Typography>
          <FormControlLabel
            control={<Switch checked={Boolean(idn.require_doc)} onChange={(e) => setI('require_doc', e.target.checked)} />}
            label="Exigir CPF/CNPJ para identificar o cliente no bot"
          />
          {idn.require_doc ? (
            <Stack spacing={1.25} sx={{ pl: { sm: 1 } }}>
              <TextField
                size="small"
                label="Pergunta do documento"
                value={idn.ask_doc_text || ''}
                onChange={(e) => setI('ask_doc_text', e.target.value.slice(0, 500))}
                fullWidth
                multiline
                minRows={2}
              />
              <TextField
                size="small"
                label="Quando não encontra"
                value={idn.doc_not_found_text || ''}
                onChange={(e) => setI('doc_not_found_text', e.target.value.slice(0, 500))}
                fullWidth
                multiline
                minRows={2}
              />
              <TextField
                size="small"
                label="Quando o documento é inválido"
                value={idn.doc_invalid_text || ''}
                onChange={(e) => setI('doc_invalid_text', e.target.value.slice(0, 500))}
                fullWidth
              />
            </Stack>
          ) : null}
          <Divider />
          <FormControlLabel
            control={<Switch checked={Boolean(idn.use_code)} onChange={(e) => setI('use_code', e.target.checked)} />}
            label="Usar código do cliente (matrícula, contrato…)"
          />
          {idn.use_code ? (
            <TextField
              size="small"
              label="Nome do código"
              value={idn.code_label || ''}
              onChange={(e) => setI('code_label', e.target.value.slice(0, 40))}
              placeholder="Código do cliente"
              sx={{ maxWidth: 320 }}
            />
          ) : null}
        </Stack>
      )}
    </CrmModal>
  );
}
