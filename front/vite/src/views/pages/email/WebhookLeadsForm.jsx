// src/views/email-marketing/components/WebhookLeadsForm.jsx
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
    Chip
} from '@mui/material';

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import PreviewRoundedIcon from '@mui/icons-material/PreviewRounded';
import DataObjectRoundedIcon from '@mui/icons-material/DataObjectRounded';
import ApiRoundedIcon from '@mui/icons-material/ApiRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';

const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

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

const defaultConfig = (orgId, projectId) => ({
    apiBase: import.meta.env.VITE_API_URL,
    mountId: `pubmail-leads-form-${String(projectId || '').slice(0, 8) || 'project'}`,

    themeColor: '#6D28D9',

    title: 'Cadastre-se para receber novidades',
    buttonText: 'Enviar',

    labels: {
        name: 'Nome',
        email: 'E-mail',
        phone: 'Telefone'
    },

    extraAttributes: {
        origin: 'website',
        country: 'BR'
    },

    // ✅ novo
    redirectUrl: '',

    organizationId: orgId || '',
    projectId: projectId || ''
});

function buildEmbedDiv({ mountId }) {
    return `<div id="${mountId}"></div>`;
}

// ✅ helper: endpoint completo do webhook
const buildWebhookUrl = (apiBase, orgId, projectId) => {
    const base = (apiBase || '').replace(/\/$/, '');
    return `${base}/email/leads/subscribe/${orgId}/${projectId}`;
};

function buildEmbedScript(config) {
    const cfg = {
        apiBase: config.apiBase,
        mountId: config.mountId,
        organizationId: config.organizationId,
        projectId: config.projectId,

        themeColor: config.themeColor,
        title: config.title,
        labels: config.labels,
        buttonText: config.buttonText,

        extraAttributes: config.extraAttributes,

        // ✅ novo
        redirectUrl: (config.redirectUrl || '').trim()
    };

    const jsonCfg = JSON.stringify(cfg);

    return `<script>
(function () {
  var cfg = ${jsonCfg};

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'style') {
          Object.assign(node.style, attrs.style);
        } else if (k === 'className') {
          node.className = attrs.className;
        } else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          node.addEventListener(k.substring(2).toLowerCase(), attrs[k]);
        } else {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function setText(node, text) {
    while (node.firstChild) node.removeChild(node.firstChild);
    node.appendChild(document.createTextNode(text));
  }

  function mount() {
    var root = document.getElementById(cfg.mountId);
    if (!root) return;

    var wrapper = el('div', {
      style: {
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '10px',
        boxSizing: 'border-box'
      }
    });

    var card = el('div', {
      style: {
        width: '100%',
        maxWidth: '520px',
        boxSizing: 'border-box',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: '4px',
        padding: '32px 24px',
        boxShadow: '0 10px 34px rgba(0,0,0,0.10)',
        background: '#fff'
      }
    });

    var title = el('div', {
      style: { 
        fontSize: 'clamp(20px, 5vw, 24px)', 
        fontWeight: 800, 
        marginBottom: '20px', 
        color: '#111827',
        textAlign: 'center',
        lineHeight: '1.2'
      }
    }, [cfg.title || 'Cadastre-se']);

    var msg = el('div', {
      style: { fontSize: '13px', marginBottom: '12px', color: '#6B7280', minHeight: '18px', textAlign: 'center' }
    }, ['']);

    function applyResponsiveStyles() {
      var width = window.innerWidth;
      if (width < 480) {
        card.style.padding = '20px 16px';
        title.style.marginBottom = '15px';
      } else {
        card.style.padding = '32px 24px';
        title.style.marginBottom = '20px';
      }
    }

    window.addEventListener('resize', applyResponsiveStyles);
    applyResponsiveStyles();

    function input(labelText, name, type) {
      var wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' } });
      var lab = el('div', { style: { fontSize: '12px', fontWeight: 800, color: '#374151' } }, [labelText]);
      var inp = el('input', {
        name: name,
        type: type || 'text',
        placeholder: labelText,
        style: {
          width: '100%',
          boxSizing: 'border-box',
          padding: '14px 16px',
          borderRadius: '4px',
          border: '1px solid rgba(0,0,0,0.16)',
          outline: 'none',
          fontSize: '16px',
          appearance: 'none'
        }
      });
      
      inp.addEventListener('focus', function () {
        inp.style.borderColor = cfg.themeColor || '#6D28D9';
        inp.style.boxShadow = '0 0 0 3px rgba(109,40,217,0.12)';
      });
      inp.addEventListener('blur', function () {
        inp.style.borderColor = 'rgba(0,0,0,0.16)';
        inp.style.boxShadow = 'none';
      });
      
      wrap.appendChild(lab);
      wrap.appendChild(inp);
      return { wrap: wrap, input: inp };
    }

    var labels = cfg.labels || {};
    var n = input(labels.name || 'Nome', 'name', 'text');
    var e = input(labels.email || 'E-mail', 'email', 'email');
    var p = input(labels.phone || 'Telefone', 'phone', 'tel');

    var btn = el('button', {
      type: 'submit',
      style: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '16px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        background: cfg.themeColor || '#6D28D9',
        color: '#fff',
        fontWeight: 900,
        fontSize: '16px',
        marginTop: '8px',
        transition: 'filter 0.2s'
      }
    }, [cfg.buttonText || 'Enviar']);

    var form = el('form', null, [n.wrap, e.wrap, p.wrap, btn]);

    var loading = false;
    function setLoading(v) {
      loading = v;
      btn.disabled = v;
      btn.style.opacity = v ? '0.7' : '1';
      btn.textContent = v ? 'Enviando...' : (cfg.buttonText || 'Enviar');
    }

    function isValidRedirect(url) {
      if (!url) return false;
      try {
        var u = new URL(url, window.location.href);
        return Boolean(u && u.href);
      } catch {
        return false;
      }
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (loading) return;

      var nameVal = (n.input.value || '').trim();
      var emailVal = (e.input.value || '').trim();
      var phoneVal = (p.input.value || '').trim();

      if (!nameVal || !emailVal) {
        setText(msg, 'Preencha nome e e-mail.');
        msg.style.color = '#B91C1C';
        return;
      }

      setLoading(true);
      var url = (cfg.apiBase || '').replace(/\\/$/, '') + '/email/leads/subscribe/' + cfg.organizationId + '/' + cfg.projectId;

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailVal,
          name: nameVal,
          attributes: Object.assign({}, (cfg.extraAttributes || {}), { phone: phoneVal })
        })
      })
      .then(function (r) {
        if (!r.ok) throw new Error();
        setText(msg, 'Success!');
        msg.style.color = '#047857';
        form.reset();

        // ✅ redireciona se definido
        var redirectUrl = (cfg.redirectUrl || '').trim();
        if (isValidRedirect(redirectUrl)) {
          window.location.href = new URL(redirectUrl, window.location.href).href;
        }
      })
      .catch(function () {
        setText(msg, 'Failed!');
        msg.style.color = '#B91C1C';
      })
      .finally(function () {
        setLoading(false);
      });
    });

    card.appendChild(title);
    card.appendChild(msg);
    card.appendChild(form);
    wrapper.appendChild(card);

    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(wrapper);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
</script>`;
}

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

// Atualizado para refletir o novo design (mais quadrado, fontes maiores)
function PreviewCard({ config }) {
    const theme = config.themeColor || '#6D28D9';
    const labels = config.labels || { name: 'Nome', email: 'E-mail', phone: 'Telefone' };

    return (
        <Box
            sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                p: 2
            }}
        >
            <Box
                sx={{
                    width: '100%',
                    maxWidth: 520,
                    borderRadius: 1, // aprox 4px para combinar com o script
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    p: { xs: 3, sm: 4 }, // Mais padding (32px)
                    boxShadow: (t) => t.shadows[3]
                }}
            >
                <Typography variant="h2" sx={{ fontWeight: 800, mb: 2.5, textAlign: 'center' }}>
                    {config.title || 'Cadastre-se'}
                </Typography>

                <Stack spacing={2}>
                    <TextField fullWidth label={labels.name} placeholder={labels.name} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }} />
                    <TextField fullWidth label={labels.email} placeholder={labels.email} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }} />
                    <TextField fullWidth label={labels.phone} placeholder={labels.phone} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }} />

                    <Button
                        variant="contained"
                        sx={{
                            borderRadius: 1, // 4px
                            fontWeight: 900,
                            backgroundColor: theme,
                            fontSize: '16px',
                            py: 1.8, // Mais altura no botão
                            mt: 1,
                            textTransform: 'none'
                        }}
                    >
                        {config.buttonText || 'Enviar'}
                    </Button>

                    {config.redirectUrl ? (
                        <Alert severity="info" sx={{ mt: 1 }}>
                            Após o envio, o formulário redirecionará para: <strong>{config.redirectUrl}</strong>
                        </Alert>
                    ) : null}
                </Stack>
            </Box>
        </Box>
    );
}

export default function WebhookLeadsForm({ open, onClose, projectSelected }) {
    const localUser = useMemo(() => readLocalUser(), []);
    const orgId = localUser?.organization?.id || localUser?.user?.organization_id || '';
    const projectId = projectSelected?.id || '';

    const [tab, setTab] = useState(0);

    const [apiBase, setApiBase] = useState('');
    const [mountId, setMountId] = useState('');
    const [themeColor, setThemeColor] = useState('#6D28D9');

    const [title, setTitle] = useState('');
    const [buttonText, setButtonText] = useState('');

    const [labelName, setLabelName] = useState('Nome');
    const [labelEmail, setLabelEmail] = useState('E-mail');
    const [labelPhone, setLabelPhone] = useState('Telefone');

    // ✅ novo
    const [redirectUrl, setRedirectUrl] = useState('');

    const [extraAttributesText, setExtraAttributesText] = useState('{}');
    const [extraAttributesError, setExtraAttributesError] = useState('');

    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

    useEffect(() => {
        if (!open) return;

        setTab(0);

        const base = defaultConfig(orgId, projectId);

        setApiBase(base.apiBase);
        setMountId(base.mountId);

        setThemeColor(base.themeColor);
        setTitle(base.title);
        setButtonText(base.buttonText);

        setLabelName(base.labels.name);
        setLabelEmail(base.labels.email);
        setLabelPhone(base.labels.phone);

        setRedirectUrl(base.redirectUrl || '');

        setExtraAttributesText(JSON.stringify(base.extraAttributes, null, 2));
        setExtraAttributesError('');
    }, [open, orgId, projectId]);

    const config = useMemo(() => {
        const parsedAttrs = safeJsonParse(extraAttributesText, null);

        return {
            apiBase: apiBase || defaultConfig(orgId, projectId).apiBase,
            mountId: mountId || defaultConfig(orgId, projectId).mountId,
            themeColor: themeColor || '#6D28D9',
            title,
            buttonText,
            labels: {
                name: labelName || 'Nome',
                email: labelEmail || 'E-mail',
                phone: labelPhone || 'Telefone'
            },
            extraAttributes: parsedAttrs && typeof parsedAttrs === 'object' && !Array.isArray(parsedAttrs) ? parsedAttrs : {},
            redirectUrl: (redirectUrl || '').trim(),
            organizationId: orgId,
            projectId
        };
    }, [
        apiBase,
        mountId,
        themeColor,
        title,
        buttonText,
        labelName,
        labelEmail,
        labelPhone,
        extraAttributesText,
        redirectUrl,
        orgId,
        projectId
    ]);

    // ✅ URL completa do webhook
    const webhookUrl = useMemo(() => buildWebhookUrl(config.apiBase, orgId, projectId), [config.apiBase, orgId, projectId]);

    const embedDiv = useMemo(() => buildEmbedDiv({ mountId: config.mountId }), [config.mountId]);
    const embedScript = useMemo(() => buildEmbedScript(config), [config]);

    const validateExtraAttributes = (text) => {
        if (!text.trim()) {
            setExtraAttributesError('');
            return true;
        }
        try {
            const parsed = JSON.parse(text);
            const ok = parsed && typeof parsed === 'object' && !Array.isArray(parsed);
            setExtraAttributesError(ok ? '' : 'O JSON deve ser um objeto (ex: {"origin":"site"})');
            return ok;
        } catch {
            setExtraAttributesError('JSON inválido');
            return false;
        }
    };

    const handleAttrsChange = (val) => {
        setExtraAttributesText(val);
        validateExtraAttributes(val);
    };

    const handleCopy = async (text, label) => {
        const ok = await copyToClipboard(text);
        setSnack({
            open: true,
            msg: ok ? `${label} copiado!` : `Não foi possível copiar ${label}.`,
            severity: ok ? 'success' : 'error'
        });
    };

    const disableCopy = Boolean(extraAttributesError) || !orgId || !projectId;

    // Aba "Usar API"
    const apiExamplePayload = useMemo(() => {
        const attrs = safeJsonParse(extraAttributesText, {});
        const safeAttrs = attrs && typeof attrs === 'object' && !Array.isArray(attrs) ? attrs : {};

        return JSON.stringify(
            {
                email: 'cliente@exemplo.com',
                name: 'Nome do Cliente',
                attributes: {
                    phone: '551199999999',
                    ...safeAttrs
                }
            },
            null,
            2
        );
    }, [extraAttributesText]);

    const curlExample = useMemo(() => {
        const payloadForSingleQuotes = apiExamplePayload.replace(/'/g, "\\'");
        return `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${payloadForSingleQuotes}'`;
    }, [webhookUrl, apiExamplePayload]);

    const jsFetchExample = useMemo(() => {
        return `fetch("${webhookUrl}", {
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
});`;
    }, [webhookUrl, apiExamplePayload]);

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
                        </Stack>
                    </Stack>

                    <IconButton onClick={onClose} size="small">
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
                            sx={{
                                minHeight: 44,
                                '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 800 }
                            }}
                        >
                            <Tab label="Configuração" icon={<TextFieldsRoundedIcon />} iconPosition="start" />
                            <Tab label="Preview" icon={<PreviewRoundedIcon />} iconPosition="start" />
                            <Tab label="Usar API" icon={<ApiRoundedIcon />} iconPosition="start" />
                        </Tabs>
                    </Box>

                    {tab === 0 ? (
                        <Stack spacing={2}>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                {/* ✅ Agora mostra URL COMPLETA do webhook */}
                                <TextField label="API Base URL" value={webhookUrl} fullWidth InputProps={{ readOnly: true }} />
                                <TextField label="ID da DIV (mount)" value={mountId} onChange={(e) => setMountId(e.target.value)} fullWidth />
                            </Stack>

                            {/* ✅ Redirecionamento opcional */}
                            <TextField
                                label="Redirecionar após cadastro (opcional)"
                                value={redirectUrl}
                                onChange={(e) => setRedirectUrl(e.target.value)}
                                fullWidth
                                placeholder="https://seusite.com/obrigado"
                                helperText="Se vazio, não redireciona."
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LinkRoundedIcon fontSize="small" />
                                        </InputAdornment>
                                    )
                                }}
                            />

                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                <TextField
                                    label="Cor tema"
                                    value={themeColor}
                                    onChange={(e) => setThemeColor(e.target.value)}
                                    fullWidth
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <PaletteRoundedIcon fontSize="small" />
                                            </InputAdornment>
                                        )
                                    }}
                                    placeholder="#6D28D9"
                                />

                                <TextField label="Título do formulário" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />

                                <TextField label="Texto do botão" value={buttonText} onChange={(e) => setButtonText(e.target.value)} fullWidth />
                            </Stack>

                            <Divider />

                            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                Campos do formulário
                            </Typography>

                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                <TextField label="Nome" value={labelName} onChange={(e) => setLabelName(e.target.value)} fullWidth />
                                <TextField label="E-mail" value={labelEmail} onChange={(e) => setLabelEmail(e.target.value)} fullWidth />
                                <TextField label="Telefone" value={labelPhone} onChange={(e) => setLabelPhone(e.target.value)} fullWidth />
                            </Stack>

                            <Divider />

                            <Stack direction="row" spacing={1} alignItems="center">
                                <DataObjectRoundedIcon fontSize="small" />
                                <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                    Attributes extras (JSON)
                                </Typography>
                            </Stack>

                            <TextField
                                label="attributes"
                                value={extraAttributesText}
                                onChange={(e) => handleAttrsChange(e.target.value)}
                                fullWidth
                                multiline
                                minRows={8}
                                maxRows={14}
                                error={Boolean(extraAttributesError)}
                                helperText={extraAttributesError || ' '}
                                inputProps={{ spellCheck: false, style: { fontFamily: monoFont } }}
                            />

                            <Divider />

                            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                Código 1: DIV (coloque onde o formulário deve aparecer)
                            </Typography>

                            <Box
                                sx={{
                                    borderRadius: 2.5,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                    p: 1.5
                                }}
                            >
                                <Typography component="pre" sx={{ m: 0, fontFamily: monoFont, fontSize: 12.5, whiteSpace: 'pre-wrap' }}>
                                    {embedDiv}
                                </Typography>
                            </Box>

                            <Stack direction="row" justifyContent="flex-end">
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    startIcon={<ContentCopyRoundedIcon />}
                                    onClick={() => handleCopy(embedDiv, 'DIV')}
                                    disabled={disableCopy}
                                    sx={{ borderRadius: 2 }}
                                >
                                    Copiar DIV
                                </Button>
                            </Stack>

                            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                Código 2: SCRIPT (cole no final do &lt;body&gt;)
                            </Typography>

                            <Box
                                sx={{
                                    borderRadius: 2.5,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                    p: 1.5,
                                    maxHeight: 320,
                                    overflow: 'auto'
                                }}
                            >
                                <Typography component="pre" sx={{ m: 0, fontFamily: monoFont, fontSize: 12.5, whiteSpace: 'pre-wrap' }}>
                                    {embedScript}
                                </Typography>
                            </Box>

                            <Stack direction="row" justifyContent="flex-end">
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    startIcon={<ContentCopyRoundedIcon />}
                                    onClick={() => handleCopy(embedScript, 'SCRIPT')}
                                    disabled={disableCopy}
                                    sx={{ borderRadius: 2 }}
                                >
                                    Copiar SCRIPT
                                </Button>
                            </Stack>
                        </Stack>
                    ) : tab === 1 ? (
                        <Box
                            sx={{
                                width: '100%',
                                minHeight: { xs: 360, md: 420 },
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                px: { xs: 1, sm: 2 }
                            }}
                        >
                            <PreviewCard config={config} />
                        </Box>
                    ) : (
                        <Stack spacing={2}>
                            <Alert severity="info">
                                Use a API para captar leads com seu próprio formulário. Envie uma requisição POST para o endpoint abaixo.
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

                            <Box
                                sx={{
                                    borderRadius: 2.5,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                    p: 1.5
                                }}
                            >
                                <Typography component="pre" sx={{ m: 0, fontFamily: monoFont, fontSize: 12.5, whiteSpace: 'pre-wrap' }}>
                                    {apiExamplePayload}
                                </Typography>
                            </Box>

                            <Stack direction="row" justifyContent="flex-end">
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={<ContentCopyRoundedIcon />}
                                    onClick={() => handleCopy(apiExamplePayload, 'Payload')}
                                    sx={{ borderRadius: 2, fontWeight: 900 }}
                                >
                                    Copiar payload
                                </Button>
                            </Stack>

                            <Divider />

                            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                Exemplo com cURL
                            </Typography>

                            <Box
                                sx={{
                                    borderRadius: 2.5,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                    p: 1.5,
                                    overflow: 'auto'
                                }}
                            >
                                <Typography component="pre" sx={{ m: 0, fontFamily: monoFont, fontSize: 12.5, whiteSpace: 'pre' }}>
                                    {curlExample}
                                </Typography>
                            </Box>

                            <Stack direction="row" justifyContent="flex-end">
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={<ContentCopyRoundedIcon />}
                                    onClick={() => handleCopy(curlExample, 'cURL')}
                                    sx={{ borderRadius: 2, fontWeight: 900 }}
                                >
                                    Copiar cURL
                                </Button>
                            </Stack>

                            <Divider />

                            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                Exemplo com fetch (JavaScript)
                            </Typography>

                            <Box
                                sx={{
                                    borderRadius: 2.5,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                    p: 1.5,
                                    maxHeight: 320,
                                    overflow: 'auto'
                                }}
                            >
                                <Typography component="pre" sx={{ m: 0, fontFamily: monoFont, fontSize: 12.5, whiteSpace: 'pre' }}>
                                    {jsFetchExample}
                                </Typography>
                            </Box>

                            <Stack direction="row" justifyContent="flex-end">
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={<ContentCopyRoundedIcon />}
                                    onClick={() => handleCopy(jsFetchExample, 'fetch')}
                                    sx={{ borderRadius: 2, fontWeight: 900 }}
                                >
                                    Copiar exemplo
                                </Button>
                            </Stack>
                        </Stack>
                    )}
                </DialogContent>

                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={onClose} variant="contained" color="secondary" sx={{ borderRadius: 2 }}>
                        Fechar
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snack.open} autoHideDuration={2200} onClose={() => setSnack((s) => ({ ...s, open: false }))} message={snack.msg} />
        </>
    );
}
