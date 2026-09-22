// WebhookLeadsForm.jsx — "Copiar formulário de captação" (projeto de e-mail).
// Gera UM código único (estilo WordPress, colável no editor de código e editável no visual),
// preview REAL num iframe (mesmo código, com flag de simulação) e persiste a configuração por
// projeto em settings.capture_form (merge seguro — nunca apaga sender/cold_block).
// O gerador é puro e testável: ./captureFormSnippet.js
import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Stack,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Button,
    Tabs,
    Tab,
    TextField,
    InputAdornment,
    Alert,
    Snackbar,
    Divider,
    Chip,
    Switch,
    FormControlLabel,
    CircularProgress,
    Tooltip
} from '@mui/material';

import {
    CloseRoundedIcon,
    ContentCopyRoundedIcon,
    TextFieldsRoundedIcon,
    PreviewRoundedIcon,
    DataObjectRoundedIcon,
    ApiRoundedIcon,
    LinkRoundedIcon,
    SaveRoundedIcon,
    RestartAltRoundedIcon,
    SmartButtonRoundedIcon,
    NotesRoundedIcon,
    TouchAppRoundedIcon,
    TuneRoundedIcon,
    CodeRoundedIcon
} from 'ui-component/icons';

import { get, patch } from '../../../api/api';
import {
    defaultCaptureConfig,
    normalizeCaptureConfig,
    buildCaptureSnippet,
    buildPreviewDoc,
    buildEndpoint,
    normalizeHex,
    isValidUrl
} from './captureFormSnippet';

const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const safeJsonParse = (text, fallback) => {
    try {
        return JSON.parse(text);
    } catch {
        return fallback;
    }
};

const readLocalUser = () => {
    try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const errMsg = (e, fb) => {
    const m = e?.response?.data?.message ?? e?.message;
    return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            return true;
        } catch {
            return false;
        }
    }
}

// clone raso-profundo de um JSON puro (a config é JSON)
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- átomos de UI ----------
function Section({ icon: Icon, title, subtitle, children }) {
    return (
        <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
                {Icon ? <Icon fontSize="small" /> : null}
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                        {title}
                    </Typography>
                    {subtitle ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {subtitle}
                        </Typography>
                    ) : null}
                </Box>
            </Stack>
            {children}
        </Stack>
    );
}

function ColorField({ label, value, onChange, helper }) {
    const valid = HEX_RE.test(String(value || '').trim());
    const swatch = valid ? normalizeHex(value, '#000000') : '#000000';
    return (
        <TextField
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => valid && onChange(normalizeHex(value, value))}
            fullWidth
            size="small"
            error={!valid}
            helperText={valid ? helper || ' ' : 'Use hexadecimal, ex.: #1a4de8'}
            inputProps={{ spellCheck: false, style: { fontFamily: monoFont } }}
            InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                        <Box
                            component="input"
                            type="color"
                            value={swatch}
                            onChange={(e) => onChange(e.target.value)}
                            aria-label={`Escolher ${label}`}
                            sx={{
                                width: 28,
                                height: 28,
                                p: 0,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                bgcolor: 'transparent',
                                cursor: 'pointer'
                            }}
                        />
                    </InputAdornment>
                )
            }}
        />
    );
}

function CodeBox({ children, maxHeight = 320, wrap = true }) {
    return (
        <Box
            sx={{
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                p: 1.5,
                maxHeight,
                overflow: 'auto'
            }}
        >
            <Typography component="pre" sx={{ m: 0, fontFamily: monoFont, fontSize: 12.5, whiteSpace: wrap ? 'pre-wrap' : 'pre' }}>
                {children}
            </Typography>
        </Box>
    );
}

// ---------- modal ----------
export default function WebhookLeadsForm({ open, onClose, projectSelected, onSaved }) {
    const localUser = useMemo(() => readLocalUser(), []);
    const orgId = localUser?.organization?.id || localUser?.user?.organization_id || '';
    const projectId = projectSelected?.id || '';
    const apiBase = import.meta.env.VITE_API_URL;

    const [tab, setTab] = useState(0);
    const [cfg, setCfg] = useState(() => defaultCaptureConfig());
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [attrsText, setAttrsText] = useState('{}');
    const [attrsError, setAttrsError] = useState('');
    const [snack, setSnack] = useState({ open: false, msg: '' });

    const notify = (msg) => setSnack({ open: true, msg });

    // carrega a config salva no projeto (settings.capture_form) ou os defaults
    useEffect(() => {
        if (!open) return;
        setTab(0);
        const n = normalizeCaptureConfig(projectSelected?.settings?.capture_form);
        setCfg(n);
        setAttrsText(JSON.stringify(n.extraAttributes, null, 2));
        setAttrsError('');
        setDirty(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, projectId]);

    // edição imutável por caminho: up((c) => { c.button.text = '...' })
    const up = (mutator) => {
        setCfg((prev) => {
            const next = clone(prev);
            mutator(next);
            return next;
        });
        setDirty(true);
    };

    const handleAttrsChange = (val) => {
        setAttrsText(val);
        if (!val.trim()) {
            setAttrsError('');
            up((c) => {
                c.extraAttributes = {};
            });
            return;
        }
        const parsed = safeJsonParse(val, undefined);
        const ok = parsed && typeof parsed === 'object' && !Array.isArray(parsed);
        setAttrsError(parsed === undefined ? 'JSON inválido' : ok ? '' : 'O JSON deve ser um objeto (ex: {"origin":"site"})');
        if (ok) {
            up((c) => {
                c.extraAttributes = parsed;
            });
        } else {
            setDirty(true);
        }
    };

    const restoreDefaults = () => {
        const d = defaultCaptureConfig();
        setCfg(d);
        setAttrsText(JSON.stringify(d.extraAttributes, null, 2));
        setAttrsError('');
        setDirty(true);
    };

    const ctx = useMemo(() => ({ apiBase, organizationId: orgId, projectId }), [apiBase, orgId, projectId]);
    const snippet = useMemo(() => buildCaptureSnippet(cfg, ctx), [cfg, ctx]);
    const previewDoc = useMemo(() => buildPreviewDoc(snippet), [snippet]);
    const webhookUrl = useMemo(() => buildEndpoint(apiBase, orgId, projectId), [apiBase, orgId, projectId]);

    const urlOk = isValidUrl(cfg.button.url);
    const colorsOk = Object.values(cfg.colors).every((v) => HEX_RE.test(String(v || '').trim()));
    const canGenerate = Boolean(orgId && projectId) && !attrsError && urlOk && colorsOk;

    // salva settings.capture_form com merge do projeto FRESCO (o PATCH substitui settings inteiro)
    const saveConfig = async ({ silent } = {}) => {
        if (!projectId || saving) return false;
        setSaving(true);
        try {
            const fresh = await get(`/email/projects/${projectId}`);
            const current = fresh?.settings && typeof fresh.settings === 'object' && !Array.isArray(fresh.settings) ? fresh.settings : {};
            await patch(`/email/projects/${projectId}`, { settings: { ...current, capture_form: cfg } });
            setDirty(false);
            onSaved?.();
            if (!silent) notify('Configuração do formulário salva no projeto.');
            return true;
        } catch (e) {
            if (!silent) notify(errMsg(e, 'Falha ao salvar a configuração.'));
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleCopyCode = async () => {
        const ok = await copyToClipboard(snippet);
        if (!ok) {
            notify('Não foi possível copiar. Selecione o código e copie manualmente.');
            return;
        }
        if (dirty && projectId) {
            const saved = await saveConfig({ silent: true });
            notify(saved ? 'Código copiado e configuração salva no projeto.' : 'Código copiado (não foi possível salvar a configuração).');
        } else {
            notify('Código copiado!');
        }
    };

    const handleCopy = async (text, label) => {
        const ok = await copyToClipboard(text);
        notify(ok ? `${label} copiado!` : `Não foi possível copiar ${label}.`);
    };

    // ----- aba "Usar API" (inalterada em essência) -----
    const apiExamplePayload = useMemo(
        () =>
            JSON.stringify(
                {
                    email: 'cliente@exemplo.com',
                    name: 'Nome do Cliente',
                    attributes: { phone: '551199999999', ...(cfg.extraAttributes || {}) }
                },
                null,
                2
            ),
        [cfg.extraAttributes]
    );
    const curlExample = useMemo(
        () => `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${apiExamplePayload.replace(/'/g, "\\'")}'`,
        [webhookUrl, apiExamplePayload]
    );
    const jsFetchExample = useMemo(
        () => `fetch("${webhookUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${apiExamplePayload})
})
.then(async (r) => {
  if (!r.ok) throw new Error("Request failed");
  return r.json().catch(() => null);
})
.then(() => {
  // sucesso
})
.catch(() => {
  // erro
});`,
        [webhookUrl, apiExamplePayload]
    );

    const f = cfg.fields;

    return (
        <>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography variant="h5" sx={{ fontWeight: 900 }}>
                            Copiar formulário de captação
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                            <Chip size="small" color="secondary" variant="outlined" label={projectSelected?.name || 'Projeto'} />
                            {projectId ? <Chip size="small" variant="outlined" label={`Project ID: ${String(projectId).slice(0, 8)}…`} /> : null}
                            {dirty ? <Chip size="small" color="warning" variant="outlined" label="Alterações não salvas" /> : null}
                        </Stack>
                    </Stack>
                    <IconButton onClick={onClose} size="small" aria-label="Fechar">
                        <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ pt: 0.5 }}>
                    {!orgId || !projectId ? (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            Não foi possível obter organizationId/projectId para gerar o formulário.
                        </Alert>
                    ) : null}

                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                        <Tabs
                            value={tab}
                            onChange={(_, v) => setTab(v)}
                            textColor="secondary"
                            indicatorColor="secondary"
                            sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 800 } }}
                        >
                            <Tab label="Configuração" icon={<TextFieldsRoundedIcon />} iconPosition="start" />
                            <Tab label="Preview" icon={<PreviewRoundedIcon />} iconPosition="start" />
                            <Tab label="Usar API" icon={<ApiRoundedIcon />} iconPosition="start" />
                        </Tabs>
                    </Box>

                    {tab === 0 ? (
                        <Stack spacing={3}>
                            <Alert severity="info">
                                <strong>Um único código.</strong> Cole no <strong>editor de código</strong> do WordPress (ou em qualquer HTML) exatamente
                                onde o formulário deve aparecer. Depois dá pra ajustar textos, cores e o link do botão também pelo{' '}
                                <strong>editor visual</strong>. Só o e-mail é obrigatório para captar: sem e-mail, o botão funciona como um link
                                normal.
                            </Alert>

                            {/* ---------- CAMPOS ---------- */}
                            <Section icon={TextFieldsRoundedIcon} title="Campos" subtitle="Rótulo e placeholder de cada campo. O e-mail é sempre exibido.">
                                <Stack spacing={1.5}>
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                                        <FormControlLabel
                                            sx={{ minWidth: 150, m: 0 }}
                                            control={
                                                <Switch
                                                    checked={f.name.enabled}
                                                    onChange={(e) =>
                                                        up((c) => {
                                                            c.fields.name.enabled = e.target.checked;
                                                        })
                                                    }
                                                />
                                            }
                                            label="Nome"
                                        />
                                        <TextField
                                            label="Rótulo"
                                            size="small"
                                            fullWidth
                                            disabled={!f.name.enabled}
                                            value={f.name.label}
                                            onChange={(e) =>
                                                up((c) => {
                                                    c.fields.name.label = e.target.value;
                                                })
                                            }
                                        />
                                        <TextField
                                            label="Placeholder"
                                            size="small"
                                            fullWidth
                                            disabled={!f.name.enabled}
                                            value={f.name.placeholder}
                                            onChange={(e) =>
                                                up((c) => {
                                                    c.fields.name.placeholder = e.target.value;
                                                })
                                            }
                                        />
                                    </Stack>

                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                                        <FormControlLabel sx={{ minWidth: 150, m: 0 }} control={<Switch checked disabled />} label="E-mail" />
                                        <TextField
                                            label="Rótulo"
                                            size="small"
                                            fullWidth
                                            value={f.email.label}
                                            onChange={(e) =>
                                                up((c) => {
                                                    c.fields.email.label = e.target.value;
                                                })
                                            }
                                        />
                                        <TextField
                                            label="Placeholder"
                                            size="small"
                                            fullWidth
                                            value={f.email.placeholder}
                                            onChange={(e) =>
                                                up((c) => {
                                                    c.fields.email.placeholder = e.target.value;
                                                })
                                            }
                                        />
                                    </Stack>

                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                                        <FormControlLabel
                                            sx={{ minWidth: 150, m: 0 }}
                                            control={
                                                <Switch
                                                    checked={f.phone.enabled}
                                                    onChange={(e) =>
                                                        up((c) => {
                                                            c.fields.phone.enabled = e.target.checked;
                                                        })
                                                    }
                                                />
                                            }
                                            label="Telefone"
                                        />
                                        <TextField
                                            label="Rótulo"
                                            size="small"
                                            fullWidth
                                            disabled={!f.phone.enabled}
                                            value={f.phone.label}
                                            onChange={(e) =>
                                                up((c) => {
                                                    c.fields.phone.label = e.target.value;
                                                })
                                            }
                                        />
                                        <TextField
                                            label="Placeholder"
                                            size="small"
                                            fullWidth
                                            disabled={!f.phone.enabled}
                                            value={f.phone.placeholder}
                                            onChange={(e) =>
                                                up((c) => {
                                                    c.fields.phone.placeholder = e.target.value;
                                                })
                                            }
                                        />
                                    </Stack>
                                </Stack>
                            </Section>

                            <Divider />

                            {/* ---------- BOTÃO ---------- */}
                            <Section icon={SmartButtonRoundedIcon} title="Botão" subtitle="O botão é um link real: com e-mail preenchido ele capta o lead e depois redireciona.">
                                <Stack spacing={2}>
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                        <TextField
                                            label="Texto do botão"
                                            size="small"
                                            fullWidth
                                            value={cfg.button.text}
                                            onChange={(e) =>
                                                up((c) => {
                                                    c.button.text = e.target.value;
                                                })
                                            }
                                        />
                                        <TextField
                                            label="URL de destino do botão"
                                            size="small"
                                            fullWidth
                                            placeholder="https://seusite.com/oferta"
                                            value={cfg.button.url}
                                            error={!urlOk}
                                            helperText={
                                                !urlOk
                                                    ? 'URL inválida.'
                                                    : cfg.button.url.trim()
                                                      ? 'Sem e-mail → vai direto pra URL. Com e-mail → salva o lead e depois redireciona.'
                                                      : 'Vazio: o botão só cadastra o lead (não redireciona).'
                                            }
                                            onChange={(e) =>
                                                up((c) => {
                                                    c.button.url = e.target.value;
                                                })
                                            }
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <LinkRoundedIcon fontSize="small" />
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                    </Stack>
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                        <ColorField
                                            label="Cor de fundo do botão"
                                            value={cfg.colors.buttonBg}
                                            onChange={(v) =>
                                                up((c) => {
                                                    c.colors.buttonBg = v;
                                                })
                                            }
                                        />
                                        <ColorField
                                            label="Cor do texto do botão"
                                            value={cfg.colors.buttonText}
                                            onChange={(v) =>
                                                up((c) => {
                                                    c.colors.buttonText = v;
                                                })
                                            }
                                        />
                                        <ColorField
                                            label="Cor do brilho (sombra pulsante)"
                                            value={cfg.colors.glow}
                                            onChange={(v) =>
                                                up((c) => {
                                                    c.colors.glow = v;
                                                })
                                            }
                                        />
                                    </Stack>
                                </Stack>
                            </Section>

                            <Divider />

                            {/* ---------- TEXTOS ---------- */}
                            <Section icon={NotesRoundedIcon} title="Textos" subtitle="Deixe vazio para não exibir.">
                                <Stack spacing={2}>
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                        <TextField
                                            label="Texto de destaque (acima do botão)"
                                            size="small"
                                            fullWidth
                                            placeholder="Ex.: LIMITE ENTRE R$1.000 A R$15.000"
                                            value={cfg.prompt.text}
                                            onChange={(e) =>
                                                up((c) => {
                                                    c.prompt.text = e.target.value;
                                                })
                                            }
                                        />
                                        <ColorField
                                            label="Cor do destaque (e do foco dos campos)"
                                            value={cfg.colors.accent}
                                            onChange={(v) =>
                                                up((c) => {
                                                    c.colors.accent = v;
                                                })
                                            }
                                        />
                                    </Stack>
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                        <TextField
                                            label="Texto abaixo do botão (nota com cadeado)"
                                            size="small"
                                            fullWidth
                                            placeholder="Ex.: Você permanecerá no mesmo site"
                                            value={cfg.note.text}
                                            onChange={(e) =>
                                                up((c) => {
                                                    c.note.text = e.target.value;
                                                })
                                            }
                                        />
                                        <ColorField
                                            label="Cor da nota"
                                            value={cfg.colors.note}
                                            onChange={(v) =>
                                                up((c) => {
                                                    c.colors.note = v;
                                                })
                                            }
                                        />
                                    </Stack>
                                </Stack>
                            </Section>

                            <Divider />

                            {/* ---------- FEEDBACK ---------- */}
                            <Section
                                icon={TouchAppRoundedIcon}
                                title="Feedback visual após o clique"
                                subtitle="Desligado por padrão. Ligado: mostra a mensagem por ~1s e então redireciona."
                            >
                                <Stack spacing={1.5}>
                                    <FormControlLabel
                                        sx={{ m: 0 }}
                                        control={
                                            <Switch
                                                checked={cfg.feedback.enabled}
                                                onChange={(e) =>
                                                    up((c) => {
                                                        c.feedback.enabled = e.target.checked;
                                                    })
                                                }
                                            />
                                        }
                                        label="Mostrar mensagem de sucesso/erro no formulário"
                                    />
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                        <TextField
                                            label="Mensagem se deu certo"
                                            size="small"
                                            fullWidth
                                            disabled={!cfg.feedback.enabled}
                                            placeholder="(vazio = não mostra nada)"
                                            value={cfg.feedback.successText}
                                            onChange={(e) =>
                                                up((c) => {
                                                    c.feedback.successText = e.target.value;
                                                })
                                            }
                                        />
                                        <TextField
                                            label="Mensagem se deu erro"
                                            size="small"
                                            fullWidth
                                            disabled={!cfg.feedback.enabled}
                                            placeholder="(vazio = não mostra nada)"
                                            value={cfg.feedback.errorText}
                                            onChange={(e) =>
                                                up((c) => {
                                                    c.feedback.errorText = e.target.value;
                                                })
                                            }
                                        />
                                    </Stack>
                                </Stack>
                            </Section>

                            <Divider />

                            {/* ---------- AVANÇADO ---------- */}
                            <Section icon={TuneRoundedIcon} title="Avançado">
                                <Stack spacing={2}>
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                        <TextField
                                            label="Largura máxima (px)"
                                            size="small"
                                            type="number"
                                            fullWidth
                                            inputProps={{ min: 240, max: 1200, step: 1 }}
                                            value={cfg.maxWidth}
                                            onChange={(e) =>
                                                up((c) => {
                                                    c.maxWidth = e.target.value === '' ? '' : Number(e.target.value);
                                                })
                                            }
                                            helperText="Largura do formulário (padrão 412)."
                                        />
                                        <TextField
                                            label="Evento do Facebook Pixel no clique (opcional)"
                                            size="small"
                                            fullWidth
                                            value={cfg.pixelEvent}
                                            onChange={(e) =>
                                                up((c) => {
                                                    c.pixelEvent = e.target.value;
                                                })
                                            }
                                            helperText="Dispara fbq('trackCustom', evento) se o Pixel existir na página. Vazio = não dispara."
                                        />
                                    </Stack>

                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <DataObjectRoundedIcon fontSize="small" />
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                            Attributes extras (JSON) — vão junto com cada lead
                                        </Typography>
                                    </Stack>
                                    <TextField
                                        label="attributes"
                                        value={attrsText}
                                        onChange={(e) => handleAttrsChange(e.target.value)}
                                        fullWidth
                                        multiline
                                        minRows={4}
                                        maxRows={10}
                                        error={Boolean(attrsError)}
                                        helperText={attrsError || 'O telefone (se ativado e preenchido) entra automaticamente como attributes.phone.'}
                                        inputProps={{ spellCheck: false, style: { fontFamily: monoFont } }}
                                    />
                                </Stack>
                            </Section>

                            <Divider />

                            {/* ---------- CÓDIGO ---------- */}
                            <Section
                                icon={CodeRoundedIcon}
                                title="Código (cole onde o formulário deve aparecer)"
                                subtitle="WordPress: bloco HTML personalizado ou editor de código do post. Outros sites: qualquer lugar do HTML."
                            >
                                <CodeBox maxHeight={360}>{snippet}</CodeBox>
                                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                                    <Button
                                        variant="contained"
                                        color="secondary"
                                        startIcon={<ContentCopyRoundedIcon />}
                                        onClick={handleCopyCode}
                                        disabled={!canGenerate || saving}
                                        sx={{ borderRadius: 2, fontWeight: 900 }}
                                    >
                                        Copiar código
                                    </Button>
                                </Stack>
                                {!canGenerate && orgId && projectId ? (
                                    <Alert severity="warning">Corrija os campos marcados em vermelho para gerar o código.</Alert>
                                ) : null}
                            </Section>
                        </Stack>
                    ) : tab === 1 ? (
                        <Box sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'divider', overflow: 'hidden', bgcolor: '#fff' }}>
                            <Box
                                component="iframe"
                                title="Preview do formulário de captação"
                                sandbox="allow-scripts"
                                srcDoc={previewDoc}
                                sx={{ display: 'block', width: '100%', height: { xs: 620, md: 680 }, border: 0, bgcolor: '#fff' }}
                            />
                        </Box>
                    ) : (
                        <Stack spacing={2}>
                            <Alert severity="info">
                                Use a API para captar leads com seu próprio formulário. Envie uma requisição POST para o endpoint abaixo. Só o{' '}
                                <strong>email</strong> é obrigatório.
                            </Alert>

                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
                                <TextField label="Endpoint (Webhook)" value={webhookUrl} fullWidth InputProps={{ readOnly: true }} />
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    startIcon={<ContentCopyRoundedIcon />}
                                    onClick={() => handleCopy(webhookUrl, 'Endpoint')}
                                    sx={{ borderRadius: 2, fontWeight: 900, px: 3, whiteSpace: 'nowrap' }}
                                    disabled={!webhookUrl}
                                >
                                    Copiar
                                </Button>
                            </Stack>

                            <Divider />
                            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                Payload (JSON)
                            </Typography>
                            <CodeBox>{apiExamplePayload}</CodeBox>
                            <Stack direction="row" justifyContent="flex-end">
                                <Button variant="outlined" color="secondary" startIcon={<ContentCopyRoundedIcon />} onClick={() => handleCopy(apiExamplePayload, 'Payload')} sx={{ borderRadius: 2, fontWeight: 900 }}>
                                    Copiar payload
                                </Button>
                            </Stack>

                            <Divider />
                            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                Exemplo com cURL
                            </Typography>
                            <CodeBox wrap={false}>{curlExample}</CodeBox>
                            <Stack direction="row" justifyContent="flex-end">
                                <Button variant="outlined" color="secondary" startIcon={<ContentCopyRoundedIcon />} onClick={() => handleCopy(curlExample, 'cURL')} sx={{ borderRadius: 2, fontWeight: 900 }}>
                                    Copiar cURL
                                </Button>
                            </Stack>

                            <Divider />
                            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                Exemplo com fetch (JavaScript)
                            </Typography>
                            <CodeBox wrap={false}>{jsFetchExample}</CodeBox>
                            <Stack direction="row" justifyContent="flex-end">
                                <Button variant="outlined" color="secondary" startIcon={<ContentCopyRoundedIcon />} onClick={() => handleCopy(jsFetchExample, 'fetch')} sx={{ borderRadius: 2, fontWeight: 900 }}>
                                    Copiar exemplo
                                </Button>
                            </Stack>
                        </Stack>
                    )}
                </DialogContent>

                <DialogActions sx={{ p: 2, gap: 1, flexWrap: 'wrap' }}>
                    <Tooltip title="Volta todos os campos para o padrão (não salva até você clicar em Salvar)">
                        <span>
                            <Button onClick={restoreDefaults} variant="text" color="inherit" startIcon={<RestartAltRoundedIcon />} sx={{ borderRadius: 2 }} disabled={saving}>
                                Restaurar padrão
                            </Button>
                        </span>
                    </Tooltip>
                    <Box sx={{ flex: 1 }} />
                    <Button
                        onClick={() => saveConfig()}
                        variant="outlined"
                        color="secondary"
                        startIcon={saving ? <CircularProgress size={14} /> : <SaveRoundedIcon />}
                        disabled={!dirty || saving || !projectId || Boolean(attrsError)}
                        sx={{ borderRadius: 2, fontWeight: 800 }}
                    >
                        Salvar configuração
                    </Button>
                    <Button onClick={onClose} variant="contained" color="secondary" sx={{ borderRadius: 2 }} disabled={saving}>
                        Fechar
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snack.open} autoHideDuration={2600} onClose={() => setSnack((s) => ({ ...s, open: false }))} message={snack.msg} />
        </>
    );
}
