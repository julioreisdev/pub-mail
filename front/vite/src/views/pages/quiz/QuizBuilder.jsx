import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';

import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';

import { get, patch } from 'api/api';
import QuizView from './QuizView';
import { normalizeQuizConfig, buildPresetConfig, QUIZ_PRESETS, uid } from './quizConfig';

// ---- upload -> data URL otimizado (sem backend) ----
async function fileToDataUrl(file) {
  if (!String(file?.type || '').startsWith('image/')) throw new Error('Selecione uma imagem.');
  if (Number(file?.size || 0) > 10 * 1024 * 1024) throw new Error('Imagem muito grande (máx 10MB).');
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
  const max = 1280;
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  try {
    const webp = canvas.toDataURL('image/webp', 0.82);
    if (webp.startsWith('data:image/webp')) return webp;
  } catch {
    /* fallback */
  }
  return canvas.toDataURL('image/jpeg', 0.82);
}

// ---- pequenos campos ----
function ColorField({ label, value, onChange }) {
  const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || ''));
  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
        <Box
          component="input"
          type="color"
          value={isHex ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          sx={{ width: 38, height: 36, p: 0, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'transparent', cursor: 'pointer', flexShrink: 0 }}
        />
        <TextField size="small" value={value} onChange={(e) => onChange(e.target.value)} fullWidth />
      </Stack>
    </Box>
  );
}

function ImageField({ label, value, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      onChange(await fileToDataUrl(file));
    } catch (x) {
      setErr(x.message || 'Falha no upload.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
        <TextField size="small" placeholder="Cole a URL ou faça upload" value={value} onChange={(e) => onChange(e.target.value)} fullWidth />
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={onPick} />
        <Tooltip title="Upload">
          <span>
            <IconButton size="small" onClick={() => inputRef.current?.click()} disabled={busy} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
              {busy ? <CircularProgress size={16} /> : <ImageRoundedIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
        {value ? (
          <Tooltip title="Remover">
            <IconButton size="small" color="error" onClick={() => onChange('')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
              <DeleteRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Stack>
      {err ? (
        <Typography variant="caption" color="error">
          {err}
        </Typography>
      ) : null}
    </Box>
  );
}

function Section({ title, defaultExpanded, children }) {
  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters sx={{ '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 1, overflow: 'hidden' }}>
      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
        <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>{children}</Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export default function QuizBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null); // { name, slug, domain }
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [previewKey, setPreviewKey] = useState(0);
  const [toast, setToast] = useState('');
  const [presetToApply, setPresetToApply] = useState(null);
  const dirtyRef = useRef(false);
  const importRef = useRef(null);

  // load
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const q = await get(`/quizzes/${id}`);
        if (!alive) return;
        setMeta({ name: q.name, slug: q.slug, domain: q.domain });
        setConfig(normalizeQuizConfig(q.settings));
      } catch (e) {
        if (alive) setLoadError(e?.response?.data?.message || 'Falha ao carregar o quiz.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const persist = useCallback(
    async (cfg) => {
      setSaving(true);
      try {
        await patch(`/quizzes/${id}`, { settings: cfg });
        setSavedAt(Date.now());
        dirtyRef.current = false;
      } catch {
        setToast('Falha ao salvar.');
      } finally {
        setSaving(false);
      }
    },
    [id]
  );

  // autosave (debounce 2s após mudança)
  useEffect(() => {
    if (!config || !dirtyRef.current) return undefined;
    const t = setTimeout(() => persist(config), 2000);
    return () => clearTimeout(t);
  }, [config, persist]);

  // mutador genérico
  const mutate = useCallback((fn) => {
    dirtyRef.current = true;
    setConfig((prev) => {
      const next = fn(structuredClone(prev));
      return next;
    });
  }, []);

  const setTheme = (k, v) => mutate((c) => ((c.theme[k] = v), c));
  const setOnline = (k, v) => mutate((c) => ((c.onlineIndicator[k] = v), c));
  const setLead = (k, v) => mutate((c) => ((c.leadCapture[k] = v), c));

  const doApplyPreset = () => {
    if (!presetToApply) return;
    dirtyRef.current = true;
    setConfig(normalizeQuizConfig(buildPresetConfig(presetToApply)));
    setPreviewKey((k) => k + 1);
    setToast('Modelo aplicado.');
    setPresetToApply(null);
  };

  // perguntas
  const addQuestion = () =>
    mutate((c) => {
      c.questions.push({ id: uid('q'), text: 'Nova pergunta', options: [{ id: uid('o'), label: 'Opção 1' }] });
      return c;
    });
  const removeQuestion = (qid) => mutate((c) => ((c.questions = c.questions.filter((q) => q.id !== qid)), c));
  const moveQuestion = (idx, dir) =>
    mutate((c) => {
      const j = idx + dir;
      if (j < 0 || j >= c.questions.length) return c;
      const [it] = c.questions.splice(idx, 1);
      c.questions.splice(j, 0, it);
      return c;
    });
  const setQuestionText = (qid, text) => mutate((c) => ((c.questions.find((q) => q.id === qid).text = text), c));
  const addOption = (qid) => mutate((c) => (c.questions.find((q) => q.id === qid).options.push({ id: uid('o'), label: 'Nova opção' }), c));
  const removeOption = (qid, oid) =>
    mutate((c) => {
      const q = c.questions.find((x) => x.id === qid);
      q.options = q.options.filter((o) => o.id !== oid);
      return c;
    });
  const setOptionLabel = (qid, oid, label) =>
    mutate((c) => ((c.questions.find((q) => q.id === qid).options.find((o) => o.id === oid).label = label), c));
  const setOptionRedirect = (qid, oid, url) =>
    mutate((c) => ((c.questions.find((q) => q.id === qid).options.find((o) => o.id === oid).redirect = url), c));

  // páginas legais
  const addLegal = () => mutate((c) => (c.legal.pages.push({ id: uid('lp'), label: 'Nova página', href: '' }), c));
  const removeLegal = (lid) => mutate((c) => ((c.legal.pages = c.legal.pages.filter((p) => p.id !== lid)), c));
  const setLegal = (lid, k, v) => mutate((c) => ((c.legal.pages.find((p) => p.id === lid)[k] = v), c));

  // import/export
  const exportPreset = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-${meta?.slug || 'preset'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importPreset = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      dirtyRef.current = true;
      setConfig(normalizeQuizConfig(parsed));
      setPreviewKey((k) => k + 1);
      setToast('Preset importado.');
    } catch {
      setToast('Arquivo inválido.');
    }
  };

  const publicUrl = meta ? `https://${meta.domain}/quiz/${meta.slug}` : '';

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (loadError || !config) {
    return (
      <Box sx={{ p: 3 }}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/quizzes')}>
          Voltar
        </Button>
        <Alert severity="error" sx={{ mt: 2 }}>
          {loadError || 'Quiz não encontrado.'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100dvh - 88px)', display: 'flex', flexDirection: 'column' }}>
      {/* Topbar */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ pb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <IconButton onClick={() => navigate('/quizzes')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Typography variant="h4" noWrap>
            {meta?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {saving ? 'Salvando…' : savedAt ? 'Tudo salvo' : 'Editando'} · {meta?.domain}/quiz/{meta?.slug}
          </Typography>
        </Box>
        <input ref={importRef} type="file" accept="application/json" hidden onChange={importPreset} />
        <Button size="small" startIcon={<UploadRoundedIcon />} onClick={() => importRef.current?.click()} sx={{ borderRadius: 2 }}>
          Importar
        </Button>
        <Button size="small" startIcon={<DownloadRoundedIcon />} onClick={exportPreset} sx={{ borderRadius: 2 }}>
          Exportar
        </Button>
        <Tooltip title="Abrir página pública">
          <Button size="small" startIcon={<OpenInNewRoundedIcon />} onClick={() => window.open(publicUrl, '_blank', 'noopener')} sx={{ borderRadius: 2 }}>
            Abrir
          </Button>
        </Tooltip>
        <Button size="small" variant="contained" color="secondary" startIcon={<SaveRoundedIcon />} disabled={saving} onClick={() => persist(config)} sx={{ borderRadius: 2, fontWeight: 800 }}>
          Salvar
        </Button>
      </Stack>

      {toast ? (
        <Alert severity="info" onClose={() => setToast('')} sx={{ mb: 1 }}>
          {toast}
        </Alert>
      ) : null}

      {/* Conteúdo: controles + preview */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Controles */}
        <Box sx={{ width: { xs: '100%', md: 440 }, flexShrink: 0, overflowY: 'auto', pr: { md: 1 }, pb: 4 }}>
          <Section title="Modelos prontos" defaultExpanded>
            <Stack spacing={1}>
              {QUIZ_PRESETS.map((p) => (
                <Box key={p.id} sx={{ border: '1px solid', borderColor: config.preset === p.id ? 'secondary.main' : 'divider', borderRadius: 2, p: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {p.name}
                      {config.preset === p.id ? <Chip size="small" label="atual" sx={{ ml: 1, height: 18 }} /> : null}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {p.description}
                    </Typography>
                  </Box>
                  <Button size="small" variant="outlined" onClick={() => setPresetToApply(p.id)}>
                    Aplicar
                  </Button>
                </Box>
              ))}
            </Stack>
          </Section>

          <Section title="Tema & cores">
            <ColorField label="Fundo da página" value={config.theme.pageBackground} onChange={(v) => setTheme('pageBackground', v)} />
            <TextField size="small" label="Gradiente do fundo (opcional, sobrepõe a cor)" value={config.theme.pageGradient} onChange={(e) => setTheme('pageGradient', e.target.value)} placeholder="linear-gradient(135deg,#7c3aed,#db2777)" />
            <ColorField label="Fundo do card" value={config.theme.cardBackground} onChange={(v) => setTheme('cardBackground', v)} />
            <ColorField label="Borda do card" value={config.theme.cardBorder} onChange={(v) => setTheme('cardBorder', v)} />
            <ColorField label="Cor de destaque (título)" value={config.theme.accentColor} onChange={(v) => setTheme('accentColor', v)} />
            <ColorField label="Cor do texto das perguntas" value={config.theme.questionColor} onChange={(v) => setTheme('questionColor', v)} />
            <ColorField label="Cor de texto secundário" value={config.theme.mutedColor} onChange={(v) => setTheme('mutedColor', v)} />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Largura do card: {config.theme.cardWidth}px
              </Typography>
              <Slider size="small" min={300} max={560} value={config.theme.cardWidth} onChange={(_, v) => setTheme('cardWidth', v)} />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Arredondamento do card: {config.theme.cardRadius}px
              </Typography>
              <Slider size="small" min={0} max={40} value={config.theme.cardRadius} onChange={(_, v) => setTheme('cardRadius', v)} />
            </Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">Sombra do card</Typography>
              <Switch checked={config.theme.cardShadow} onChange={(e) => setTheme('cardShadow', e.target.checked)} />
            </Stack>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">Barra de destaque (lateral)</Typography>
              <Switch checked={config.theme.showAccentBar} onChange={(e) => setTheme('showAccentBar', e.target.checked)} />
            </Stack>
            {config.theme.showAccentBar ? <ColorField label="Cor da barra lateral" value={config.theme.accentBarColor} onChange={(v) => setTheme('accentBarColor', v)} /> : null}
            <TextField size="small" select label="Fonte" value={config.theme.font} onChange={(e) => setTheme('font', e.target.value)}>
              <MenuItem value="Inter, system-ui, sans-serif">Inter</MenuItem>
              <MenuItem value="Poppins, Inter, system-ui, sans-serif">Poppins</MenuItem>
              <MenuItem value="Montserrat, Inter, sans-serif">Montserrat</MenuItem>
              <MenuItem value="Roboto, Inter, sans-serif">Roboto</MenuItem>
              <MenuItem value="Georgia, serif">Georgia (serif)</MenuItem>
            </TextField>
          </Section>

          <Section title="Botões">
            <TextField size="small" select label="Estilo" value={config.theme.buttonStyle} onChange={(e) => setTheme('buttonStyle', e.target.value)}>
              <MenuItem value="solid">Sólido</MenuItem>
              <MenuItem value="soft">Suave</MenuItem>
              <MenuItem value="outline">Contorno</MenuItem>
            </TextField>
            <TextField size="small" label="Cor/gradiente de fundo do botão" value={config.theme.buttonBackground} onChange={(e) => setTheme('buttonBackground', e.target.value)} helperText="Aceita cor (#0b2942) ou gradiente." />
            <ColorField label="Cor do texto do botão" value={config.theme.buttonTextColor} onChange={(v) => setTheme('buttonTextColor', v)} />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Arredondamento: {config.theme.buttonRadius}px
              </Typography>
              <Slider size="small" min={0} max={999} value={config.theme.buttonRadius} onChange={(_, v) => setTheme('buttonRadius', v)} />
            </Box>
          </Section>

          <Section title="Logo & imagem">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">Mostrar logo</Typography>
              <Switch checked={config.logo.show} onChange={(e) => mutate((c) => ((c.logo.show = e.target.checked), c))} />
            </Stack>
            {config.logo.show ? (
              <>
                <ImageField label="Logo" value={config.logo.url} onChange={(v) => mutate((c) => ((c.logo.url = v), c))} />
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    Altura do logo: {config.logo.height}px
                  </Typography>
                  <Slider size="small" min={20} max={120} value={config.logo.height} onChange={(_, v) => mutate((c) => ((c.logo.height = v), c))} />
                </Box>
              </>
            ) : null}
            <Divider />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">Mostrar imagem</Typography>
              <Switch checked={config.image.show} onChange={(e) => mutate((c) => ((c.image.show = e.target.checked), c))} />
            </Stack>
            {config.image.show ? (
              <>
                <ImageField label="Imagem (hero)" value={config.image.url} onChange={(v) => mutate((c) => ((c.image.url = v), c))} />
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    Arredondamento da imagem: {config.image.radius}px
                  </Typography>
                  <Slider size="small" min={0} max={40} value={config.image.radius} onChange={(_, v) => mutate((c) => ((c.image.radius = v), c))} />
                </Box>
              </>
            ) : null}
          </Section>

          <Section title="Título">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">Mostrar título</Typography>
              <Switch checked={config.title.show} onChange={(e) => mutate((c) => ((c.title.show = e.target.checked), c))} />
            </Stack>
            <TextField size="small" label="Texto do título" value={config.title.text} onChange={(e) => mutate((c) => ((c.title.text = e.target.value), c))} multiline minRows={2} />
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Tamanho: {config.title.size}px
              </Typography>
              <Slider size="small" min={16} max={40} value={config.title.size} onChange={(_, v) => mutate((c) => ((c.title.size = v), c))} />
            </Box>
          </Section>

          <Section title={`Perguntas (${config.questions.length})`} defaultExpanded>
            <Stack spacing={1.5}>
              {config.questions.map((q, idx) => (
                <Box key={q.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                    <Chip size="small" label={`#${idx + 1}`} />
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title="Subir">
                      <span>
                        <IconButton size="small" disabled={idx === 0} onClick={() => moveQuestion(idx, -1)}>
                          <ArrowUpwardRoundedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Descer">
                      <span>
                        <IconButton size="small" disabled={idx === config.questions.length - 1} onClick={() => moveQuestion(idx, 1)}>
                          <ArrowDownwardRoundedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Remover pergunta">
                      <span>
                        <IconButton size="small" color="error" disabled={config.questions.length <= 1} onClick={() => removeQuestion(q.id)}>
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                  <TextField size="small" fullWidth label="Pergunta" value={q.text} onChange={(e) => setQuestionText(q.id, e.target.value)} sx={{ mb: 1 }} />
                  <Stack spacing={1}>
                    {q.options.map((o) => (
                      <Box key={o.id} sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1.5, p: 0.75 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <TextField size="small" fullWidth value={o.label} onChange={(e) => setOptionLabel(q.id, o.id, e.target.value)} placeholder="Texto do botão" />
                          <IconButton size="small" color="error" disabled={q.options.length <= 1} onClick={() => removeOption(q.id, o.id)}>
                            <DeleteRoundedIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                        <TextField
                          size="small"
                          fullWidth
                          value={o.redirect || ''}
                          onChange={(e) => setOptionRedirect(q.id, o.id, e.target.value)}
                          placeholder="↪ Redirecionar p/ esta resposta (opcional)"
                          sx={{ mt: 0.5, '& input': { fontSize: 12.5 } }}
                        />
                      </Box>
                    ))}
                  </Stack>
                  <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => addOption(q.id)} sx={{ mt: 0.75 }}>
                    Botão
                  </Button>
                </Box>
              ))}
            </Stack>
            <Button startIcon={<AddRoundedIcon />} variant="outlined" onClick={addQuestion} sx={{ borderRadius: 2 }}>
              Adicionar pergunta
            </Button>
          </Section>

          <Section title="Indicador de online">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">Exibir indicador</Typography>
              <Switch checked={config.onlineIndicator.enabled} onChange={(e) => setOnline('enabled', e.target.checked)} />
            </Stack>
            {config.onlineIndicator.enabled ? (
              <>
                <TextField size="small" type="number" label="Número" value={config.onlineIndicator.count} onChange={(e) => setOnline('count', Number(e.target.value) || 0)} />
                <TextField size="small" label="Texto após o número" value={config.onlineIndicator.label} onChange={(e) => setOnline('label', e.target.value)} />
                <ColorField label="Cor do ponto" value={config.onlineIndicator.dotColor} onChange={(v) => setOnline('dotColor', v)} />
              </>
            ) : null}
          </Section>

          <Section title="Captação de lead">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">Ativar captação no final</Typography>
              <Switch checked={config.leadCapture.enabled} onChange={(e) => setLead('enabled', e.target.checked)} />
            </Stack>
            {config.leadCapture.enabled ? (
              <>
                <TextField size="small" label="Texto introdutório" value={config.leadCapture.introText} onChange={(e) => setLead('introText', e.target.value)} multiline minRows={2} />
                <Divider textAlign="left">
                  <Typography variant="caption">Campos</Typography>
                </Divider>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2">Nome</Typography>
                  <Switch checked={config.leadCapture.captureName} onChange={(e) => setLead('captureName', e.target.checked)} />
                </Stack>
                {config.leadCapture.captureName ? (
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" label="Rótulo" value={config.leadCapture.nameLabel} onChange={(e) => setLead('nameLabel', e.target.value)} fullWidth />
                    <TextField size="small" label="Placeholder" value={config.leadCapture.namePlaceholder} onChange={(e) => setLead('namePlaceholder', e.target.value)} fullWidth />
                  </Stack>
                ) : null}
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2">E-mail (vai pro projeto de e-mail)</Typography>
                  <Switch checked={config.leadCapture.captureEmail} onChange={(e) => setLead('captureEmail', e.target.checked)} />
                </Stack>
                {config.leadCapture.captureEmail ? (
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" label="Rótulo" value={config.leadCapture.emailLabel} onChange={(e) => setLead('emailLabel', e.target.value)} fullWidth />
                    <TextField size="small" label="Placeholder" value={config.leadCapture.emailPlaceholder} onChange={(e) => setLead('emailPlaceholder', e.target.value)} fullWidth />
                  </Stack>
                ) : null}
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2">Telefone</Typography>
                  <Switch checked={config.leadCapture.capturePhone} onChange={(e) => setLead('capturePhone', e.target.checked)} />
                </Stack>
                {config.leadCapture.capturePhone ? (
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" label="Rótulo" value={config.leadCapture.phoneLabel} onChange={(e) => setLead('phoneLabel', e.target.value)} fullWidth />
                    <TextField size="small" label="Placeholder" value={config.leadCapture.phonePlaceholder} onChange={(e) => setLead('phonePlaceholder', e.target.value)} fullWidth />
                  </Stack>
                ) : null}
                <TextField size="small" label="Texto do botão final" value={config.leadCapture.buttonLabel} onChange={(e) => setLead('buttonLabel', e.target.value)} />
                <Alert severity="info" sx={{ py: 0 }}>
                  O e-mail roteia o lead pro projeto vinculado. Sem projeto/sem e-mail, o lead fica salvo em <b>Leads</b> com a origem deste quiz.
                </Alert>
              </>
            ) : null}
          </Section>

          <Section title="Redirecionamento">
            <TextField size="small" label="URL de redirecionamento (geral)" value={config.redirect.url} onChange={(e) => mutate((c) => ((c.redirect.url = e.target.value), c))} placeholder="https://destino.com/oferta" />
            <Typography variant="caption" color="text.secondary">
              Para onde o usuário vai após a última pergunta (sem captação) ou após enviar os dados (com captação).
            </Typography>
            <Alert severity="info" sx={{ py: 0 }}>
              <b>Por resposta:</b> cada botão de pergunta tem um campo opcional <i>“↪ Redirecionar”</i>. Se preenchido, ele tem prioridade sobre a URL geral (vale a última resposta escolhida com link).
            </Alert>
          </Section>

          <Section title="Páginas legais (rodapé)">
            {config.legal.pages.map((p) => (
              <Stack key={p.id} direction="row" spacing={0.5} alignItems="center">
                <TextField size="small" label="Rótulo" value={p.label} onChange={(e) => setLegal(p.id, 'label', e.target.value)} sx={{ flex: 1 }} />
                <TextField size="small" label="Link" value={p.href} onChange={(e) => setLegal(p.id, 'href', e.target.value)} sx={{ flex: 1 }} />
                <IconButton size="small" color="error" onClick={() => removeLegal(p.id)}>
                  <DeleteRoundedIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <TextField size="small" label="Texto antes dos links" value={config.legal.text} onChange={(e) => mutate((c) => ((c.legal.text = e.target.value), c))} />
            <Button size="small" startIcon={<AddRoundedIcon />} onClick={addLegal}>
              Adicionar página
            </Button>
          </Section>

          <Section title="Animação">
            <TextField size="small" select label="Transição entre perguntas" value={config.animation.type} onChange={(e) => mutate((c) => ((c.animation.type = e.target.value), c))}>
              <MenuItem value="slide">Deslizar</MenuItem>
              <MenuItem value="fade">Esmaecer</MenuItem>
              <MenuItem value="zoom">Zoom</MenuItem>
              <MenuItem value="none">Nenhuma</MenuItem>
            </TextField>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Duração: {config.animation.duration}ms
              </Typography>
              <Slider size="small" min={120} max={800} step={20} value={config.animation.duration} onChange={(_, v) => mutate((c) => ((c.animation.duration = v), c))} />
            </Box>
          </Section>
        </Box>

        {/* Preview ao vivo */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary' }}>
              Pré-visualização
            </Typography>
            <Button size="small" startIcon={<RestartAltRoundedIcon />} onClick={() => setPreviewKey((k) => k + 1)}>
              Reiniciar
            </Button>
          </Stack>
          <Box sx={{ flex: 1, minHeight: 360, borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden', position: 'relative' }}>
            <Box sx={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
              <QuizView key={previewKey} config={config} mode="preview" resetKey={previewKey} />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Confirmar aplicação de modelo */}
      <Dialog open={Boolean(presetToApply)} onClose={() => setPresetToApply(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Aplicar modelo “{QUIZ_PRESETS.find((p) => p.id === presetToApply)?.name || ''}”?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Isto substitui <b>todo o conteúdo atual</b> do quiz (cores, perguntas, textos e configurações) pelo modelo escolhido. Esta ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPresetToApply(null)}>Cancelar</Button>
          <Button variant="contained" color="secondary" onClick={doApplyPreset}>
            Aplicar modelo
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
