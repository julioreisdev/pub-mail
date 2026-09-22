import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import Slider from '@mui/material/Slider';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import { CloseRoundedIcon as CloseRoundedIcon } from 'ui-component/icons';
import { SaveRoundedIcon as SaveRoundedIcon } from 'ui-component/icons';
import { TextFieldsRoundedIcon as TextFieldsRoundedIcon } from 'ui-component/icons';
import { TitleRoundedIcon as TitleRoundedIcon } from 'ui-component/icons';
import { ImageRoundedIcon as ImageRoundedIcon } from 'ui-component/icons';
import { SmartButtonRoundedIcon as SmartButtonRoundedIcon } from 'ui-component/icons';
import { HorizontalRuleRoundedIcon as HorizontalRuleRoundedIcon } from 'ui-component/icons';
import { HeightRoundedIcon as HeightRoundedIcon } from 'ui-component/icons';
import { ArrowUpwardRoundedIcon as ArrowUpwardRoundedIcon } from 'ui-component/icons';
import { ArrowDownwardRoundedIcon as ArrowDownwardRoundedIcon } from 'ui-component/icons';
import { ContentCopyRoundedIcon as ContentCopyRoundedIcon } from 'ui-component/icons';
import { DeleteRoundedIcon as DeleteRoundedIcon } from 'ui-component/icons';
import { FormatBoldRoundedIcon as FormatBoldRoundedIcon } from 'ui-component/icons';
import { FormatItalicRoundedIcon as FormatItalicRoundedIcon } from 'ui-component/icons';
import { FormatUnderlinedRoundedIcon as FormatUnderlinedRoundedIcon } from 'ui-component/icons';
import { LinkRoundedIcon as LinkRoundedIcon } from 'ui-component/icons';
import { DataObjectRoundedIcon as DataObjectRoundedIcon } from 'ui-component/icons';
import { FormatAlignLeftRoundedIcon as FormatAlignLeftRoundedIcon } from 'ui-component/icons';
import { FormatAlignCenterRoundedIcon as FormatAlignCenterRoundedIcon } from 'ui-component/icons';
import { FormatAlignRightRoundedIcon as FormatAlignRightRoundedIcon } from 'ui-component/icons';

import { post } from '../../../api/api';
import {
  EMAIL_VARIABLES,
  FONT_OPTIONS,
  createBlock,
  createDefaultModel,
  modelToHtml,
  normalizeModel,
  renderBlockHtml,
  uid
} from './emailBuilderCore';

import { ViewColumnRoundedIcon as ViewColumnRoundedIcon } from 'ui-component/icons';
import { CreditCardRoundedIcon as CreditCardRoundedIcon } from 'ui-component/icons';

// Tema escuro só para o painel de estilo (deixa placeholders/textos legíveis).
const darkPanelTheme = createTheme({
  palette: { mode: 'dark', background: { paper: '#0b1220', default: '#0b1220' } }
});

// ---- upload: arquivo -> data URL comprimido -> back (/email/assets) -> URL ----
async function fileToDataUrl(file) {
  if (!String(file?.type || '').startsWith('image/')) throw new Error('Selecione uma imagem.');
  if (Number(file?.size || 0) > 8 * 1024 * 1024) throw new Error('Imagem muito grande (máx 8MB).');
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Falha ao ler a imagem.'));
    r.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Imagem inválida.'));
    i.src = dataUrl;
  });
  const max = 1000;
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  // JPEG (universal em e-mail; o servidor reotimiza e escolhe PNG se tiver
  // transparência). Evita WebP, que vários clientes de e-mail renderizam mal.
  return canvas.toDataURL('image/jpeg', 0.82);
}

// ---- pequenos campos ----
function Field({ label, children }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ minHeight: 34 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Stack>
  );
}

function ColorInput({ value, onChange, allowEmpty = false }) {
  const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || ''));
  const empty = allowEmpty && !String(value || '').trim();
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Box
        component="input"
        type="color"
        value={isHex ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        sx={{ width: 30, height: 30, p: 0, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'transparent', cursor: 'pointer' }}
      />
      <TextField size="small" value={value || ''} placeholder={allowEmpty ? 'nenhuma' : ''} onChange={(e) => onChange(e.target.value)} sx={{ width: allowEmpty ? 78 : 96, '& input': { fontSize: 12, py: 0.5 } }} />
      {allowEmpty && !empty ? (
        <Tooltip title="Remover"><IconButton size="small" onClick={() => onChange('')} sx={{ color: '#cbd5e1' }}><CloseRoundedIcon fontSize="small" /></IconButton></Tooltip>
      ) : null}
    </Stack>
  );
}

function Num({ value, onChange, min = 0, max = 999, suffix }) {
  return (
    <TextField
      size="small"
      type="number"
      value={value}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
      InputProps={{ endAdornment: suffix ? <Typography variant="caption" color="text.secondary">{suffix}</Typography> : null }}
      sx={{ width: 96, '& input': { fontSize: 12, py: 0.5, textAlign: 'right' } }}
    />
  );
}

function AlignToggle({ value, onChange }) {
  return (
    <ToggleButtonGroup size="small" exclusive value={value} onChange={(_, v) => v && onChange(v)}>
      <ToggleButton value="left" sx={{ px: 1, py: 0.25 }}><FormatAlignLeftRoundedIcon fontSize="small" /></ToggleButton>
      <ToggleButton value="center" sx={{ px: 1, py: 0.25 }}><FormatAlignCenterRoundedIcon fontSize="small" /></ToggleButton>
      <ToggleButton value="right" sx={{ px: 1, py: 0.25 }}><FormatAlignRightRoundedIcon fontSize="small" /></ToggleButton>
    </ToggleButtonGroup>
  );
}

// ---- editor de texto (contentEditable) ----
function RichText({ value, style, onInput, onFocusEditor }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) ref.current.innerHTML = value || '';
    // set só no mount (keyed por block.id no pai)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Box
      ref={ref}
      component="div"
      contentEditable
      suppressContentEditableWarning
      onInput={() => onInput(ref.current.innerHTML)}
      onFocus={() => onFocusEditor(ref.current)}
      sx={{ outline: 'none', cursor: 'text', '& a': { color: '#4f46e5' }, ...style }}
    />
  );
}

const RAIL = [
  { type: 'heading', icon: <TitleRoundedIcon />, label: 'Título' },
  { type: 'text', icon: <TextFieldsRoundedIcon />, label: 'Texto' },
  { type: 'image', icon: <ImageRoundedIcon />, label: 'Imagem' },
  { type: 'button', icon: <SmartButtonRoundedIcon />, label: 'Botão' },
  { type: 'card', icon: <CreditCardRoundedIcon />, label: 'Card' },
  { type: 'columns', icon: <ViewColumnRoundedIcon />, label: 'Colunas' },
  { type: 'divider', icon: <HorizontalRuleRoundedIcon />, label: 'Divisor' },
  { type: 'spacer', icon: <HeightRoundedIcon />, label: 'Espaço' }
];

export default function EmailBuilder({ open, mode = 'template', initialModel = null, initialName = '', initialSubject = '', saving = false, error = '', onClose, onSave }) {
  const [model, setModel] = useState(() => createDefaultModel());
  const [selectedId, setSelectedId] = useState(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [varAnchor, setVarAnchor] = useState(null);
  const [linkDialog, setLinkDialog] = useState({ open: false, url: '' });
  const activeEditorRef = useRef(null);
  const savedRangeRef = useRef(null);

  // (re)hidrata ao abrir — do modelo salvo (banco), não do HTML
  useEffect(() => {
    if (!open) return;
    setModel(initialModel ? normalizeModel(initialModel) : createDefaultModel());
    setName(initialName || '');
    setSubject(initialSubject || '');
    setSelectedId(null);
    activeEditorRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const blocks = model.blocks;
  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) || null, [blocks, selectedId]);

  const updateBody = (k, v) => setModel((m) => ({ ...m, body: { ...m.body, [k]: v } }));
  const updateBlock = useCallback((id, patch) => {
    setModel((m) => ({ ...m, blocks: m.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  }, []);

  const addBlock = (type) => {
    const block = createBlock(type);
    setModel((m) => {
      const idx = m.blocks.findIndex((b) => b.id === selectedId);
      const at = idx >= 0 ? idx + 1 : m.blocks.length;
      const next = [...m.blocks];
      next.splice(at, 0, block);
      return { ...m, blocks: next };
    });
    setSelectedId(block.id);
  };
  const moveBlock = (id, dir) =>
    setModel((m) => {
      const i = m.blocks.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= m.blocks.length) return m;
      const next = [...m.blocks];
      const [it] = next.splice(i, 1);
      next.splice(j, 0, it);
      return { ...m, blocks: next };
    });
  const duplicateBlock = (id) =>
    setModel((m) => {
      const i = m.blocks.findIndex((b) => b.id === id);
      if (i < 0) return m;
      const copy = { ...m.blocks[i], id: uid() };
      const next = [...m.blocks];
      next.splice(i + 1, 0, copy);
      return { ...m, blocks: next };
    });
  const removeBlock = (id) => {
    setModel((m) => ({ ...m, blocks: m.blocks.filter((b) => b.id !== id) }));
    setSelectedId((s) => (s === id ? null : s));
  };

  // ---- rich text: comandos ----
  const syncActive = () => {
    if (activeEditorRef.current && selectedId) {
      updateBlock(selectedId, { html: activeEditorRef.current.innerHTML });
    }
  };
  const exec = (cmd, val) => {
    document.execCommand(cmd, false, val);
    syncActive();
  };
  const insertVariable = (key) => {
    if (activeEditorRef.current) {
      activeEditorRef.current.focus();
      document.execCommand('insertText', false, key);
      syncActive();
    } else if (selected && selected.type === 'button') {
      updateBlock(selected.id, { href: key });
    }
    setVarAnchor(null);
  };
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  };
  const applyLink = () => {
    const url = String(linkDialog.url || '').trim();
    if (url && savedRangeRef.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
      document.execCommand('createLink', false, url);
      syncActive();
    }
    setLinkDialog({ open: false, url: '' });
  };

  const handleSave = () => {
    const html = modelToHtml(model);
    onSave({ name: name.trim(), subject: subject.trim(), html, model });
  };

  const showName = mode === 'template';
  const showSubject = mode === 'template' || mode === 'step';
  const body = model.body;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullScreen>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <IconButton onClick={onClose} disabled={saving}><CloseRoundedIcon /></IconButton>
        <Typography variant="h4" sx={{ fontWeight: 900, flexShrink: 0 }}>Construtor de e-mail</Typography>
        <Stack direction="row" spacing={1} sx={{ flex: 1, ml: 2, flexWrap: 'wrap', gap: 1 }}>
          {showName ? (
            <TextField size="small" label="Nome do template" value={name} onChange={(e) => setName(e.target.value)} sx={{ width: 220 }} />
          ) : null}
          {showSubject ? (
            <TextField size="small" label="Assunto do e-mail" value={subject} onChange={(e) => setSubject(e.target.value)} sx={{ flex: 1, minWidth: 240, maxWidth: 420 }} placeholder="Ex.: Oferta especial pra você 🎁" />
          ) : null}
          <TextField
            size="small"
            label="Prévia (preheader)"
            value={model.preheader || ''}
            onChange={(e) => setModel((m) => ({ ...m, preheader: e.target.value.slice(0, 200) }))}
            sx={{ flex: 1, minWidth: 240, maxWidth: 420 }}
            placeholder="Texto que aparece ao lado do assunto na caixa de entrada"
            helperText="Opcional, mas aumenta muito a taxa de abertura. Some no corpo do e-mail."
            FormHelperTextProps={{ sx: { fontSize: 10, mx: 0.5, mt: 0.25, lineHeight: 1.2 } }}
          />
          <TextField
            size="small"
            label="Nome do remetente (opcional)"
            value={model.from_name || ''}
            onChange={(e) => setModel((m) => ({ ...m, from_name: e.target.value.slice(0, 120) }))}
            sx={{ flex: 1, minWidth: 200, maxWidth: 300 }}
            placeholder="Ex.: Equipe SuperSim"
            helperText="Vazio = usa o remetente do projeto."
            FormHelperTextProps={{ sx: { fontSize: 10, mx: 0.5, mt: 0.25, lineHeight: 1.2 } }}
          />
        </Stack>
        <Button onClick={onClose} disabled={saving} sx={{ borderRadius: 2 }}>Cancelar</Button>
        <Button
          variant="contained"
          color="secondary"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRoundedIcon />}
          onClick={handleSave}
          disabled={saving || (showName && !name.trim()) || (showSubject && !subject.trim())}
          sx={{ borderRadius: 2, fontWeight: 800 }}
        >
          Salvar
        </Button>
      </Stack>

      {error ? <Alert severity="error" sx={{ borderRadius: 0 }}>{error}</Alert> : null}

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', bgcolor: '#0f172a' }}>
        {/* Rail de blocos */}
        <Stack spacing={0.5} sx={{ p: 1, bgcolor: '#111827', alignItems: 'center' }}>
          {RAIL.map((r) => (
            <Tooltip key={r.type} title={r.label} placement="right">
              <IconButton onClick={() => addBlock(r.type)} sx={{ color: '#cbd5e1', border: '1px solid transparent', borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,.08)', color: '#fff' } }}>
                {r.icon}
              </IconButton>
            </Tooltip>
          ))}
        </Stack>

        {/* Canvas */}
        <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', justifyContent: 'center', p: 3, background: body.background }} onClick={() => setSelectedId(null)}>
          <Box sx={{ width: body.width, maxWidth: '100%', alignSelf: 'flex-start' }}>
            <Box sx={{ background: body.contentBg, borderRadius: `${body.radius}px`, overflow: 'hidden', boxShadow: '0 10px 40px rgba(2,6,23,.25)' }}>
              {blocks.length === 0 ? (
                <Box sx={{ p: 5, textAlign: 'center', color: 'text.secondary' }}>Use a barra à esquerda para adicionar blocos.</Box>
              ) : (
                blocks.map((b, idx) => (
                  <Box
                    key={b.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(b.id); }}
                    sx={{
                      position: 'relative',
                      px: `${body.paddingX}px`,
                      py: `${b.space}px`,
                      cursor: 'pointer',
                      outline: selectedId === b.id ? '2px solid #4f46e5' : '2px solid transparent',
                      outlineOffset: '-2px',
                      '&:hover': { outline: selectedId === b.id ? '2px solid #4f46e5' : '2px dashed #c7d2fe' }
                    }}
                  >
                    {selectedId === b.id ? (
                      <Stack direction="row" spacing={0.25} sx={{ position: 'absolute', top: -1, right: -1, bgcolor: '#4f46e5', borderRadius: '0 0 0 6px', zIndex: 2 }}>
                        <IconButton size="small" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); moveBlock(b.id, -1); }} sx={{ color: '#fff', p: 0.25 }}><ArrowUpwardRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
                        <IconButton size="small" disabled={idx === blocks.length - 1} onClick={(e) => { e.stopPropagation(); moveBlock(b.id, 1); }} sx={{ color: '#fff', p: 0.25 }}><ArrowDownwardRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); duplicateBlock(b.id); }} sx={{ color: '#fff', p: 0.25 }}><ContentCopyRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }} sx={{ color: '#fff', p: 0.25 }}><DeleteRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
                      </Stack>
                    ) : null}
                    <CanvasBlock block={b} body={body} onInput={(html) => updateBlock(b.id, { html })} onFocusEditor={(el) => { activeEditorRef.current = el; setSelectedId(b.id); }} />
                  </Box>
                ))
              )}
            </Box>
          </Box>
        </Box>

        {/* Painel de estilo */}
        <Box sx={{ width: 300, flexShrink: 0, bgcolor: '#0b1220', color: '#e5e7eb', overflowY: 'auto', borderLeft: '1px solid rgba(255,255,255,.06)' }}>
          <ThemeProvider theme={darkPanelTheme}>
          <Box sx={{ p: 2 }}>
            {selected ? (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1, color: '#fff' }}>
                  {selected.type === 'image' ? 'Imagem' : selected.type === 'button' ? 'Botão' : selected.type === 'divider' ? 'Divisor' : selected.type === 'spacer' ? 'Espaço' : selected.type === 'card' ? 'Card' : selected.type === 'columns' ? 'Colunas' : 'Texto'}
                </Typography>
                <BlockControls
                  block={selected}
                  onChange={(patch) => updateBlock(selected.id, patch)}
                  onExec={exec}
                  onOpenVars={(e) => setVarAnchor(e.currentTarget)}
                  onLink={() => { saveSelection(); setLinkDialog({ open: true, url: '' }); }}
                />
                <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,.08)' }} />
              </>
            ) : null}

            <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1, color: '#fff' }}>Corpo do e-mail</Typography>
            <Stack spacing={1}>
              <Field label="Fundo da página"><ColorInput value={body.background} onChange={(v) => updateBody('background', v)} /></Field>
              <Field label="Fundo do card"><ColorInput value={body.contentBg} onChange={(v) => updateBody('contentBg', v)} /></Field>
              <Field label="Barra no topo"><ColorInput value={body.barColor || ''} onChange={(v) => updateBody('barColor', v)} allowEmpty /></Field>
              <Field label="Largura"><Num value={body.width} onChange={(v) => updateBody('width', v)} min={320} max={800} suffix="px" /></Field>
              <Field label="Cantos"><Num value={body.radius} onChange={(v) => updateBody('radius', v)} min={0} max={40} suffix="px" /></Field>
              <Field label="Padding lateral"><Num value={body.paddingX} onChange={(v) => updateBody('paddingX', v)} min={0} max={80} suffix="px" /></Field>
              <Field label="Fonte">
                <TextField select size="small" value={body.fontFamily} onChange={(e) => updateBody('fontFamily', e.target.value)} sx={{ width: 150, '& .MuiInputBase-input': { fontSize: 12, py: 0.5 } }}>
                  {FONT_OPTIONS.map((f) => <MenuItem key={f.value} value={f.value} sx={{ fontFamily: f.value }}>{f.label}</MenuItem>)}
                </TextField>
              </Field>
            </Stack>
          </Box>
          </ThemeProvider>
        </Box>
      </Box>

      {/* Menu de variáveis */}
      <Menu anchorEl={varAnchor} open={Boolean(varAnchor)} onClose={() => setVarAnchor(null)}>
        {EMAIL_VARIABLES.map((v) => (
          <MenuItem key={v.key} onClick={() => insertVariable(v.key)}>
            <Stack>
              <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>{v.key}</Typography>
              <Typography variant="caption" color="text.secondary">{v.desc}</Typography>
            </Stack>
          </MenuItem>
        ))}
      </Menu>

      {/* Dialog de link */}
      <Dialog open={linkDialog.open} onClose={() => setLinkDialog({ open: false, url: '' })} maxWidth="xs" fullWidth>
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>Inserir link</Typography>
          <TextField autoFocus fullWidth size="small" label="URL" placeholder="https://..." value={linkDialog.url} onChange={(e) => setLinkDialog((p) => ({ ...p, url: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') applyLink(); }} />
          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
            <Button onClick={() => setLinkDialog({ open: false, url: '' })}>Cancelar</Button>
            <Button variant="contained" onClick={applyLink}>Aplicar</Button>
          </Stack>
        </Box>
      </Dialog>
    </Dialog>
  );
}

// ============ render de bloco no canvas (espelha o HTML final) ============
function CanvasBlock({ block: b, body, onInput, onFocusEditor }) {
  if (b.type === 'text') {
    return (
      <RichText
        key={b.id}
        value={b.html}
        onInput={onInput}
        onFocusEditor={onFocusEditor}
        style={{ fontFamily: body.fontFamily, fontSize: `${b.fontSize}px`, color: b.color, textAlign: b.align, lineHeight: b.lineHeight, fontWeight: b.weight }}
      />
    );
  }
  if (b.type === 'image') {
    if (!b.src) {
      return (
        <Box sx={{ textAlign: b.align }}>
          <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5, width: `${b.widthPct}%`, minHeight: 120, border: '2px dashed #cbd5e1', borderRadius: `${b.radius}px`, color: '#94a3b8', bgcolor: '#f8fafc' }}>
            <ImageRoundedIcon />
            <Typography variant="caption">Selecione e adicione a imagem →</Typography>
          </Box>
        </Box>
      );
    }
    return (
      <Box sx={{ textAlign: b.align, lineHeight: 0 }}>
        <Box component="img" src={b.src} alt={b.alt} sx={{ width: `${b.widthPct}%`, maxWidth: '100%', height: 'auto', borderRadius: `${b.radius}px`, display: 'inline-block' }} />
      </Box>
    );
  }
  if (b.type === 'button') {
    const justify = b.align === 'center' ? 'center' : b.align === 'right' ? 'flex-end' : 'flex-start';
    return (
      <Box sx={{ display: 'flex', justifyContent: b.fullWidth ? 'stretch' : justify }}>
        <Box sx={{ display: b.fullWidth ? 'block' : 'inline-block', width: b.fullWidth ? '100%' : 'auto', textAlign: 'center', bgcolor: b.bg, color: b.color, borderRadius: `${b.radius}px`, px: `${b.px}px`, py: `${b.py}px`, fontFamily: body.fontFamily, fontSize: `${b.fontSize}px`, fontWeight: b.weight }}>
          {b.text}
        </Box>
      </Box>
    );
  }
  if (b.type === 'divider') {
    return <Box sx={{ borderTop: `${b.thickness}px solid ${b.color}` }} />;
  }
  if (b.type === 'spacer') {
    return <Box sx={{ height: `${b.height}px`, border: '1px dashed #e2e8f0', borderRadius: 1 }} />;
  }
  // card / colunas: renderiza o MESMO HTML final (preview = real)
  if (b.type === 'card' || b.type === 'columns') {
    return <Box sx={{ '& img': { maxWidth: '100%' }, '& *': { boxSizing: 'border-box' } }} dangerouslySetInnerHTML={{ __html: renderBlockHtml(b) }} />;
  }
  return null;
}

// ============ controles do bloco selecionado (painel direito) ============
function BlockControls({ block: b, onChange, onExec, onOpenVars, onLink }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState('');

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUpErr('');
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { url } = await post('/email/assets', { dataUrl });
      onChange({ src: url });
    } catch (x) {
      setUpErr(x?.response?.data?.message || x.message || 'Falha no upload.');
    } finally {
      setUploading(false);
    }
  };

  // upload para uma célula de "colunas" (left/right)
  const [cellUp, setCellUp] = useState('');
  const updateCell = (side, patch) => onChange({ [side]: { ...b[side], ...patch } });
  const onPickCell = (side) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUpErr('');
    setCellUp(side);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { url } = await post('/email/assets', { dataUrl });
      updateCell(side, { src: url });
    } catch (x) {
      setUpErr(x?.response?.data?.message || x.message || 'Falha no upload.');
    } finally {
      setCellUp('');
    }
  };

  if (b.type === 'text') {
    return (
      <Stack spacing={1}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Negrito"><IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => onExec('bold')} sx={{ color: '#cbd5e1' }}><FormatBoldRoundedIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Itálico"><IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => onExec('italic')} sx={{ color: '#cbd5e1' }}><FormatItalicRoundedIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Sublinhado"><IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => onExec('underline')} sx={{ color: '#cbd5e1' }}><FormatUnderlinedRoundedIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Link"><IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={onLink} sx={{ color: '#cbd5e1' }}><LinkRoundedIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Variável"><IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={onOpenVars} sx={{ color: '#cbd5e1' }}><DataObjectRoundedIcon fontSize="small" /></IconButton></Tooltip>
        </Stack>
        <Field label="Alinhar"><AlignToggle value={b.align} onChange={(v) => onChange({ align: v })} /></Field>
        <Field label="Tamanho"><Num value={b.fontSize} onChange={(v) => onChange({ fontSize: v })} min={9} max={60} suffix="px" /></Field>
        <Field label="Cor"><ColorInput value={b.color} onChange={(v) => onChange({ color: v })} /></Field>
        <Field label="Peso">
          <TextField select size="small" value={b.weight} onChange={(e) => onChange({ weight: Number(e.target.value) })} sx={{ width: 96, '& .MuiInputBase-input': { fontSize: 12, py: 0.5 } }}>
            <MenuItem value={400}>Normal</MenuItem>
            <MenuItem value={600}>Semi</MenuItem>
            <MenuItem value={700}>Negrito</MenuItem>
          </TextField>
        </Field>
        <Field label="Entrelinha"><Num value={b.lineHeight} onChange={(v) => onChange({ lineHeight: v })} min={1} max={3} /></Field>
        <Field label="Espaço"><Num value={b.space} onChange={(v) => onChange({ space: v })} min={0} max={60} suffix="px" /></Field>
      </Stack>
    );
  }

  if (b.type === 'image') {
    return (
      <Stack spacing={1}>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
        <Button size="small" variant="outlined" startIcon={uploading ? <CircularProgress size={14} /> : <ImageRoundedIcon />} onClick={() => fileRef.current?.click()} disabled={uploading} sx={{ borderColor: 'rgba(255,255,255,.2)', color: '#e5e7eb' }}>
          {uploading ? 'Enviando…' : 'Upload de imagem'}
        </Button>
        {upErr ? <Typography variant="caption" color="error">{upErr}</Typography> : null}
        <TextField size="small" label="URL da imagem" value={b.src} onChange={(e) => onChange({ src: e.target.value })} placeholder="https://..." sx={{ '& .MuiInputBase-input': { fontSize: 12 } }} />
        <TextField size="small" label="Texto alternativo" value={b.alt} onChange={(e) => onChange({ alt: e.target.value })} sx={{ '& .MuiInputBase-input': { fontSize: 12 } }} />
        <TextField size="small" label="Link ao clicar (opcional)" value={b.href} onChange={(e) => onChange({ href: e.target.value })} placeholder="https://..." sx={{ '& .MuiInputBase-input': { fontSize: 12 } }} />
        <Field label="Alinhar"><AlignToggle value={b.align} onChange={(v) => onChange({ align: v })} /></Field>
        <Field label="Largura"><Num value={b.widthPct} onChange={(v) => onChange({ widthPct: v })} min={10} max={100} suffix="%" /></Field>
        <Field label="Cantos"><Num value={b.radius} onChange={(v) => onChange({ radius: v })} min={0} max={40} suffix="px" /></Field>
        <Field label="Espaço"><Num value={b.space} onChange={(v) => onChange({ space: v })} min={0} max={60} suffix="px" /></Field>
      </Stack>
    );
  }

  if (b.type === 'button') {
    return (
      <Stack spacing={1}>
        <TextField size="small" label="Texto do botão" value={b.text} onChange={(e) => onChange({ text: e.target.value })} sx={{ '& .MuiInputBase-input': { fontSize: 12 } }} />
        <Stack direction="row" spacing={0.5} alignItems="flex-end">
          <TextField size="small" label="Link" value={b.href} onChange={(e) => onChange({ href: e.target.value })} placeholder="https://..." fullWidth sx={{ '& .MuiInputBase-input': { fontSize: 12 } }} />
          <Tooltip title="Usar variável"><IconButton size="small" onClick={onOpenVars} sx={{ color: '#cbd5e1' }}><DataObjectRoundedIcon fontSize="small" /></IconButton></Tooltip>
        </Stack>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>Rastrear cliques</Typography>
          <ToggleButtonGroup size="small" exclusive value={b.tracked ? 'on' : 'off'} onChange={(_, v) => v && onChange({ tracked: v === 'on' })}>
            <ToggleButton value="on" sx={{ px: 1, py: 0.25, fontSize: 11 }}>Sim</ToggleButton>
            <ToggleButton value="off" sx={{ px: 1, py: 0.25, fontSize: 11 }}>Não</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>Largura total</Typography>
          <ToggleButtonGroup size="small" exclusive value={b.fullWidth ? 'on' : 'off'} onChange={(_, v) => v && onChange({ fullWidth: v === 'on' })}>
            <ToggleButton value="on" sx={{ px: 1, py: 0.25, fontSize: 11 }}>Sim</ToggleButton>
            <ToggleButton value="off" sx={{ px: 1, py: 0.25, fontSize: 11 }}>Não</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Field label="Alinhar"><AlignToggle value={b.align} onChange={(v) => onChange({ align: v })} /></Field>
        <Field label="Fundo"><ColorInput value={b.bg} onChange={(v) => onChange({ bg: v })} /></Field>
        <Field label="Texto"><ColorInput value={b.color} onChange={(v) => onChange({ color: v })} /></Field>
        <Field label="Cantos"><Num value={b.radius} onChange={(v) => onChange({ radius: v })} min={0} max={40} suffix="px" /></Field>
        <Field label="Tamanho"><Num value={b.fontSize} onChange={(v) => onChange({ fontSize: v })} min={10} max={30} suffix="px" /></Field>
        <Field label="Pad. horiz."><Num value={b.px} onChange={(v) => onChange({ px: v })} min={4} max={80} suffix="px" /></Field>
        <Field label="Pad. vert."><Num value={b.py} onChange={(v) => onChange({ py: v })} min={4} max={40} suffix="px" /></Field>
        <Field label="Espaço"><Num value={b.space} onChange={(v) => onChange({ space: v })} min={0} max={60} suffix="px" /></Field>
      </Stack>
    );
  }

  if (b.type === 'divider') {
    return (
      <Stack spacing={1}>
        <Field label="Cor"><ColorInput value={b.color} onChange={(v) => onChange({ color: v })} /></Field>
        <Field label="Espessura"><Num value={b.thickness} onChange={(v) => onChange({ thickness: v })} min={1} max={10} suffix="px" /></Field>
        <Field label="Espaço"><Num value={b.space} onChange={(v) => onChange({ space: v })} min={0} max={60} suffix="px" /></Field>
      </Stack>
    );
  }

  if (b.type === 'spacer') {
    return (
      <Stack spacing={1}>
        <Field label="Altura"><Num value={b.height} onChange={(v) => onChange({ height: v })} min={4} max={120} suffix="px" /></Field>
      </Stack>
    );
  }

  if (b.type === 'card') {
    return (
      <Stack spacing={1}>
        <TextField size="small" label="Ícone / emoji (opcional)" value={b.icon} onChange={(e) => onChange({ icon: e.target.value })} placeholder="✅  ⚠️  💡  ⭐" sx={{ '& .MuiInputBase-input': { fontSize: 14 } }} />
        <TextField size="small" label="Título" value={b.title} onChange={(e) => onChange({ title: e.target.value })} sx={{ '& .MuiInputBase-input': { fontSize: 12 } }} />
        <TextField size="small" label="Descrição" value={b.text} onChange={(e) => onChange({ text: e.target.value })} multiline minRows={2} sx={{ '& .MuiInputBase-input': { fontSize: 12 } }} />
        <Divider sx={{ my: 0.5, borderColor: 'rgba(255,255,255,.08)' }} />
        <Field label="Fundo"><ColorInput value={b.bg} onChange={(v) => onChange({ bg: v })} /></Field>
        <Field label="Cor da borda"><ColorInput value={b.borderColor} onChange={(v) => onChange({ borderColor: v })} /></Field>
        <Field label="Borda"><Num value={b.borderWidth} onChange={(v) => onChange({ borderWidth: v })} min={0} max={6} suffix="px" /></Field>
        <Field label="Cantos"><Num value={b.radius} onChange={(v) => onChange({ radius: v })} min={0} max={40} suffix="px" /></Field>
        <Field label="Espaçamento interno"><Num value={b.padding} onChange={(v) => onChange({ padding: v })} min={4} max={40} suffix="px" /></Field>
        <Field label="Cor do título"><ColorInput value={b.titleColor} onChange={(v) => onChange({ titleColor: v })} /></Field>
        <Field label="Título (tam.)"><Num value={b.titleSize} onChange={(v) => onChange({ titleSize: v })} min={11} max={30} suffix="px" /></Field>
        <Field label="Cor do texto"><ColorInput value={b.textColor} onChange={(v) => onChange({ textColor: v })} /></Field>
        <Field label="Texto (tam.)"><Num value={b.textSize} onChange={(v) => onChange({ textSize: v })} min={10} max={22} suffix="px" /></Field>
        <Field label="Alinhar"><AlignToggle value={b.align} onChange={(v) => onChange({ align: v })} /></Field>
        <Field label="Espaço"><Num value={b.space} onChange={(v) => onChange({ space: v })} min={0} max={60} suffix="px" /></Field>
      </Stack>
    );
  }

  if (b.type === 'columns') {
    const cellEditor = (side, label) => {
      const c = b[side] || {};
      const kind = c.kind || 'image';
      return (
        <Box sx={{ p: 1, border: '1px solid rgba(255,255,255,.1)', borderRadius: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: '#fff', display: 'block', mb: 0.75 }}>{label}</Typography>
          <Stack spacing={0.75}>
            <ToggleButtonGroup size="small" exclusive fullWidth value={kind} onChange={(_, v) => v && updateCell(side, { kind: v })}>
              <ToggleButton value="image" sx={{ py: 0.25, fontSize: 11 }}>Imagem</ToggleButton>
              <ToggleButton value="text" sx={{ py: 0.25, fontSize: 11 }}>Texto</ToggleButton>
            </ToggleButtonGroup>
            {kind === 'image' ? (
              <>
                <input id={`cellfile-${b.id}-${side}`} type="file" accept="image/*" hidden onChange={onPickCell(side)} />
                <Button size="small" variant="outlined" startIcon={cellUp === side ? <CircularProgress size={12} /> : <ImageRoundedIcon />} onClick={() => document.getElementById(`cellfile-${b.id}-${side}`)?.click()} disabled={cellUp === side} sx={{ borderColor: 'rgba(255,255,255,.2)', color: '#e5e7eb', fontSize: 11 }}>
                  {cellUp === side ? 'Enviando…' : 'Upload'}
                </Button>
                <TextField size="small" label="URL da imagem" value={c.src || ''} onChange={(e) => updateCell(side, { src: e.target.value })} placeholder="https://..." sx={{ '& .MuiInputBase-input': { fontSize: 12 } }} />
                <TextField size="small" label="Alt" value={c.alt || ''} onChange={(e) => updateCell(side, { alt: e.target.value })} sx={{ '& .MuiInputBase-input': { fontSize: 12 } }} />
                <Field label="Largura"><Num value={c.widthPct || 100} onChange={(v) => updateCell(side, { widthPct: v })} min={10} max={100} suffix="%" /></Field>
              </>
            ) : (
              <TextField size="small" label="Texto" value={c.text || ''} onChange={(e) => updateCell(side, { text: e.target.value })} multiline minRows={2} sx={{ '& .MuiInputBase-input': { fontSize: 12 } }} />
            )}
            <Field label="Alinhar"><AlignToggle value={c.align || (side === 'right' ? 'right' : 'left')} onChange={(v) => updateCell(side, { align: v })} /></Field>
          </Stack>
        </Box>
      );
    };
    return (
      <Stack spacing={1}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Duas colunas lado a lado (ótimo p/ logo + selo, ou imagem + texto). No celular elas continuam lado a lado — use conteúdo curto.</Typography>
        {cellEditor('left', 'Coluna esquerda')}
        {cellEditor('right', 'Coluna direita')}
        <Field label="Alinh. vertical">
          <ToggleButtonGroup size="small" exclusive value={b.valign} onChange={(_, v) => v && onChange({ valign: v })}>
            <ToggleButton value="top" sx={{ px: 1, py: 0.25, fontSize: 11 }}>Topo</ToggleButton>
            <ToggleButton value="middle" sx={{ px: 1, py: 0.25, fontSize: 11 }}>Meio</ToggleButton>
            <ToggleButton value="bottom" sx={{ px: 1, py: 0.25, fontSize: 11 }}>Base</ToggleButton>
          </ToggleButtonGroup>
        </Field>
        <Field label="Espaço"><Num value={b.space} onChange={(v) => onChange({ space: v })} min={0} max={60} suffix="px" /></Field>
      </Stack>
    );
  }

  return null;
}
