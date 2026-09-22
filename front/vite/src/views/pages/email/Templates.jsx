// src/views/email-marketing/components/Templates.jsx
import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Stack,
    Typography,
    TextField,
    InputAdornment,
    IconButton,
    Button,
    Divider,
    Alert,
    Skeleton,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Tabs,
    Tab
} from '@mui/material';

import { SearchRoundedIcon as SearchRoundedIcon } from 'ui-component/icons';
import { AddRoundedIcon as AddRoundedIcon } from 'ui-component/icons';
import { RefreshRoundedIcon as RefreshRoundedIcon } from 'ui-component/icons';
import { ExpandMoreRoundedIcon as ExpandMoreRoundedIcon } from 'ui-component/icons';
import { DeleteRoundedIcon as DeleteRoundedIcon } from 'ui-component/icons';
import { SaveRoundedIcon as SaveRoundedIcon } from 'ui-component/icons';
import { CloseRoundedIcon as CloseRoundedIcon } from 'ui-component/icons';
import { SubjectRoundedIcon as SubjectRoundedIcon } from 'ui-component/icons';
import { DataObjectRoundedIcon as DataObjectRoundedIcon } from 'ui-component/icons';
import { HelpOutlineRoundedIcon as HelpOutlineRoundedIcon } from 'ui-component/icons';
import { ContentCopyRoundedIcon as ContentCopyRoundedIcon } from 'ui-component/icons';
import { CodeIcon as CodeIcon } from 'ui-component/icons';
import { AutoAwesomeIcon as AutoAwesomeIcon } from 'ui-component/icons';
import { RemoveRedEyeIcon as RemoveRedEyeIcon } from 'ui-component/icons';
import { HelpOutlineIcon as HelpOutlineIcon } from 'ui-component/icons';

import { DashboardCustomizeRoundedIcon as DashboardCustomizeRoundedIcon } from 'ui-component/icons';
import { EditRoundedIcon as EditRoundedIcon } from 'ui-component/icons';
import useTemplatesPerProject from '../../../hooks/useTemplatesPerProject';
import EmailBuilder from './EmailBuilder';
import ImportTemplatesButton from './ImportTemplatesButton';
import { post, patch, remove } from '../../../api/api';

const safeLower = (v) => (v ?? '').toString().toLowerCase();

const getErrorMessage = (err, fallback = 'Ocorreu um erro') => {
    return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
};

const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const variableExamples = [
    { key: '{{name}}', desc: 'Nome do lead' },
    { key: '{{email}}', desc: 'E-mail do lead' },
    { key: '{{unsubscribe_link}}', desc: 'Link para cancelar inscrição, esse aqui a Pub Mail gera pra você!' },
    {
        key: '{{open_email_pixel}}',
        desc: 'Coloque isso no final do body do seu template HTML se quiser saber quantas aberturas cada envio teve.'
    }
];

const htmlFullExample = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>Email</title>
  </head>

  <body style="margin:0; padding:0; background:#f5f7fb;">
    <!-- Wrapper -->
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      style="background:#f5f7fb; padding:24px 0;"
    >
      <tr>
        <td align="center" style="padding:0 16px;">
          <!-- Container -->
          <table
            role="presentation"
            width="600"
            cellspacing="0"
            cellpadding="0"
            style="width:100%; max-width:600px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.08);"
          >
            <!-- Header -->
            <tr>
              <td style="padding:28px 28px 16px 28px; background:#111827;">
                <div
                  style="font-family:Arial, Helvetica, sans-serif; color:#ffffff; font-size:18px; font-weight:700;"
                >
                  Pub Mail
                </div>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding:28px;">
                <div
                  style="font-family:Arial, Helvetica, sans-serif; color:#111827; font-size:22px; font-weight:700; line-height:1.25;"
                >
                  Teste de envio de e-mail
                </div>

                <div
                  style="font-family:Arial, Helvetica, sans-serif; color:#374151; font-size:16px; line-height:1.6; margin-top:14px;"
                >
                  Oi, <strong>{{name}}</strong> 👋<br /><br />
                  Esse é e-mail teste da Pub Mail, para verificar se o sistema
                  de envio de e-mails está funcionando corretamente. Se você recebeu
                  este e-mail, significa que tudo está configurado corretamente! 🎉<br /><br />
                </div>

                <!-- Button -->
                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  style="margin-top:18px;"
                >
                  <tr>
                    <td bgcolor="#2563eb" style="border-radius:12px;">
                      <a
                        href="{{base_webhook_cta_click}}?redirectUrl=SEU_LINK_AQUI"
                        style="display:inline-block; padding:12px 18px; font-family:Arial, Helvetica, sans-serif; color:#ffffff; font-size:16px; text-decoration:none; font-weight:700;"
                      >
                        Clique aqui para assistir
                      </a>
                    </td>
                  </tr>
                </table>

                <div
                  style="font-family:Arial, Helvetica, sans-serif; color:#6b7280; font-size:13px; line-height:1.5; margin-top:18px;"
                >
                  Se o botão não funcionar, copie e cole este link no navegador:<br />
                  <a
                    href="{{base_webhook_cta_click}}?redirectUrl=SEU_LINK_AQUI"
                    style="color:#2563eb; text-decoration:underline;"
                    >https://www.youtube.com/watch?v=wvDN6R7VBJU&list=RDwvDN6R7VBJU&start_radio=1</a
                  >
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:18px 28px; background:#f9fafb;">
                <div
                  style="font-family:Arial, Helvetica, sans-serif; color:#6b7280; font-size:12px; line-height:1.5;"
                >
                  © 2026 Pub Mail<br />
                  <a
                    href="{{unsubscribe_link}}"
                    style="color:#6b7280; text-decoration:underline;"
                    >Descadastrar</a
                  >
                </div>
              </td>
            </tr>
          </table>
          <!-- /Container -->
        </td>
      </tr>
    </table>
    <!-- /Wrapper -->
    {{open_email_pixel}}
  </body>
</html>`;

function TemplatesSkeleton({ rows = 6 }) {
    return (
        <Stack spacing={1}>
            {Array.from({ length: rows }).map((_, i) => (
                <Box
                    key={i}
                    sx={{
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        p: 1.5
                    }}
                >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Skeleton variant="rounded" width={44} height={28} />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton variant="text" width="45%" height={22} />
                            <Skeleton variant="text" width="30%" height={18} />
                        </Box>
                        <Skeleton variant="rounded" width={86} height={28} />
                    </Stack>
                </Box>
            ))}
        </Stack>
    );
}

function ConfirmDialog({ open, title, description, confirmText = 'Confirmar', loading, onClose, onConfirm }) {
    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary">
                    {description}
                </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} disabled={loading} variant="outlined">
                    Cancelar
                </Button>
                <Button
                    onClick={onConfirm}
                    disabled={loading}
                    variant="contained"
                    color="error"
                    startIcon={loading ? <CircularProgress size={16} /> : null}
                >
                    {confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

function CopyButton({ value, size = 'small' }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value ?? '');
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
        } catch {
            // Se falhar (sem permissão), não quebra a UI
            setCopied(false);
        }
    };

    return (
        <Tooltip title={copied ? 'Copiado!' : 'Copiar'}>
            <IconButton onClick={handleCopy} size={size}>
                <ContentCopyRoundedIcon fontSize="small" />
            </IconButton>
        </Tooltip>
    );
}

function CodeExampleBlock({ title, value }) {
    return (
        <Box
            sx={{
                p: 2,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
            }}
        >
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                    {title}
                </Typography>
                <CopyButton value={value} />
            </Stack>

            <Box
                sx={{
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.default',
                    p: 1.5,
                    overflow: 'auto',
                    textAlign: 'left !important'
                }}
            >
                <Typography component="pre" sx={{ m: 0, fontSize: 12.5, lineHeight: 1.6, fontFamily: monoFont }}>
                    {value}
                </Typography>
            </Box>
        </Box>
    );
}

function HtmlPreview({ html }) {
    const srcDoc = useMemo(() => {
        const content = (html ?? '').trim();
        if (!content) return '';
        const hasHtmlTag = /<html[\s>]/i.test(content);
        const hasBodyTag = /<body[\s>]/i.test(content);

        // Se já vier um doc inteiro, usa direto.
        if (hasHtmlTag || hasBodyTag) return content;

        // Se vier só fragmento, embrulha num HTML básico pra renderizar.
        return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>Preview</title>
</head>
<body style="margin:0; padding:16px; background:#f5f7fb;">
${content}
</body>
</html>`;
    }, [html]);

    return (
        <Box
            sx={{
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                bgcolor: 'background.default'
            }}
        >
            {!srcDoc ? (
                <Box sx={{ p: 2 }}>
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                        Escreva seu HTML na aba <b>HTML</b> para ver o preview aqui.
                    </Alert>
                </Box>
            ) : (
                <Box
                    component="iframe"
                    title="preview"
                    sx={{
                        width: '100%',
                        height: { xs: 520, md: 560 },
                        border: 0,
                        display: 'block',
                        bgcolor: '#fff'
                    }}
                    sandbox="allow-same-origin"
                    srcDoc={srcDoc}
                />
            )}
        </Box>
    );
}

function HelpTabContent() {
    return (
        <Stack spacing={2} sx={{ pt: 1 }}>
            <Box
                sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper'
                }}
            >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <HelpOutlineRoundedIcon fontSize="small" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                        Variáveis
                    </Typography>
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Você pode usar variáveis no <b>Assunto</b> e no <b>HTML</b>. Elas serão substituídas pelos valores do lead no momento do disparo.
                </Typography>

                <Box
                    sx={{
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                        p: 1.5,
                        overflow: 'auto'
                    }}
                >
                    <Stack spacing={1}>
                        {variableExamples.map((v) => (
                            <Stack key={v.key} direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                                <Chip size="small" label={v.key} color="secondary" variant="outlined" sx={{ borderRadius: 2, fontFamily: monoFont }} />
                                <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {v.desc}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </Box>
            </Box>

            <Box
                sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper'
                }}
            >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <HelpOutlineRoundedIcon fontSize="small" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                        Marcação de clique em CTAs
                    </Typography>
                </Stack>

                <Typography sx={{ textAlign: 'left' }} variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Na sua tag âncora (<code>&lt;a&gt;</code>), adicione a variável <code>{'{{base_webhook_cta_click}}'}</code> para que possamos
                    rastrear os cliques nesse link. O link do CTA ficará na frente de outra variável chamada <code>{'?redirectUrl='}</code>.
                </Typography>

                <Box
                    sx={{
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                        p: 1.5,
                        overflow: 'auto'
                    }}
                >
                    <Stack spacing={1}>
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                            <Chip
                                size="small"
                                label={'<a href="{{base_webhook_cta_click}}?redirectUrl=SEU_LINK_AQUI">CTA</a>'}
                                color="secondary"
                                variant="outlined"
                                sx={{ borderRadius: 2, fontFamily: monoFont }}
                            />
                        </Stack>
                    </Stack>
                </Box>
            </Box>

            <CodeExampleBlock title="Exemplo no Assunto" value={`Olá {{name}}, boas-vindas ao Pub Mail!`} />

            <CodeExampleBlock
                title="Exemplo no HTML (simples)"
                value={`<h1>Oi {{name}} 👋</h1>
<p>Enviamos esta mensagem para {{email}}.</p>
{{open_email_pixel}}
<a href="{{unsubscribe_link}}">Clique aqui para cancelar a inscrição</a>`}
            />

            <CodeExampleBlock title="Exemplo de HTML (template completo)" value={htmlFullExample} />
        </Stack>
    );
}

function CreateTemplateDialog({ open, loading, error, onClose, onSubmit }) {
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [bodyHtml, setBodyHtml] = useState('');
    const [prompt, setPrompt] = useState('');
    const [tab, setTab] = useState(0);
    const [generateLoading, setGenerateLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setName('');
            setSubject('');
            setBodyHtml('');
            setTab(0);
        }
    }, [open]);

    const generateTemplate = async () => {
        if (!prompt?.trim() || generateLoading) return;

        setGenerateLoading(true);
        try {
            const { data } = await post('/ia/email-template/generate', { prompt });

            // conforme pedido:
            setBodyHtml(data?.html?.html ?? '');
            setSubject(data?.html?.subject ?? '');

            // ir para a aba 2
            setTab(2);

            toast.success('Template gerado com sucesso!');
        } catch (e) {
            toast.error(getErrorMessage(e, 'Falha ao gerar template'));
        } finally {
            setGenerateLoading(false);
        }
    };

    const canSubmit = name.trim().length >= 2 && subject.trim().length >= 2;

    const handleSubmit = (e) => {
        e?.preventDefault?.();
        if (!canSubmit || loading) return;
        onSubmit({
            name: name.trim(),
            subject: subject.trim(),
            body_html: bodyHtml ?? ''
        });
    };

    const onKeyDownSubmit = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="lg">
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="h5">Novo template</Typography>
                <IconButton onClick={onClose} disabled={loading} size="small">
                    <CloseRoundedIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <Box component="form" onSubmit={handleSubmit}>
                <DialogContent sx={{ pt: 1.5 }}>
                    {error ? (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    ) : null}

                    <Stack spacing={2}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <TextField
                                label="Nome do template"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={onKeyDownSubmit}
                                autoFocus
                                fullWidth
                            />
                            <TextField
                                label="Assunto do E-mail"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                onKeyDown={onKeyDownSubmit}
                                fullWidth
                            />
                        </Stack>

                        <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Tabs
                                value={tab}
                                onChange={(_, v) => setTab(v)}
                                textColor="secondary"
                                indicatorColor="secondary"
                                sx={{
                                    minHeight: 44,
                                    '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 700 }
                                }}
                            >
                                <Tab icon={<CodeIcon fontSize="small" />} label="HTML" />
                                <Tab icon={<AutoAwesomeIcon fontSize="small" />} label="GERAR COM IA" />
                                <Tab icon={<RemoveRedEyeIcon fontSize="small" />} label="PREVIEW" />
                                <Tab icon={<HelpOutlineIcon fontSize="small" />} label="AJUDA" />
                            </Tabs>
                            {tab === 1 ? (
                                <Button
                                    onClick={() => generateTemplate()}
                                    disabled={!prompt || generateLoading}
                                    variant="contained"
                                    color="secondary"
                                    startIcon={generateLoading ? <CircularProgress size={16} /> : <AutoAwesomeIcon fontSize="small" />}
                                    sx={{ borderRadius: 2 }}
                                >
                                    Gerar template com IA
                                </Button>
                            ) : null}
                        </Box>

                        {tab === 0 ? (
                            <TextField
                                label="HTML"
                                value={bodyHtml}
                                onChange={(e) => setBodyHtml(e.target.value)}
                                fullWidth
                                multiline
                                minRows={12}
                                maxRows={20}
                                inputProps={{ spellCheck: false, style: { fontFamily: monoFont } }}
                            />
                        ) : tab === 1 ? (
                            <TextField
                                label="PROMPT"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                fullWidth
                                multiline
                                minRows={12}
                                maxRows={20}
                                inputProps={{ spellCheck: false, style: { fontFamily: monoFont } }}
                            />
                        ) : tab === 2 ? (
                            <Stack spacing={1}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle2" color="text.secondary">
                                        Preview do HTML
                                    </Typography>
                                    <CopyButton value={bodyHtml ?? ''} />
                                </Stack>
                                <HtmlPreview html={bodyHtml} />
                            </Stack>
                        ) : (
                            <HelpTabContent />
                        )}
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={onClose} disabled={loading} variant="outlined">
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        disabled={!canSubmit || loading}
                        variant="contained"
                        color="secondary"
                        startIcon={loading ? <CircularProgress size={16} /> : <SaveRoundedIcon fontSize="small" />}
                        sx={{ borderRadius: 2 }}
                    >
                        Criar
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
}

function TemplateAccordion({ template, expanded, onToggle, onSave, onAskDelete, saving, disableActions }) {
    const [name, setName] = useState(template?.name || '');
    const [subject, setSubject] = useState(template?.subject || '');
    const [bodyHtml, setBodyHtml] = useState(template?.body_html || '');
    const [tab, setTab] = useState(0);

    useEffect(() => {
        setName(template?.name || '');
        setSubject(template?.subject || '');
        setBodyHtml(template?.body_html || '');
        setTab(0);
    }, [template?.id]);

    const dirty = name !== (template?.name || '') || subject !== (template?.subject || '') || bodyHtml !== (template?.body_html || '');

    const canSave = name.trim().length >= 2 && subject.trim().length >= 2;

    const handleSave = () => {
        if (!dirty || !canSave || saving || disableActions) return;
        onSave(template.id, {
            name: name.trim(),
            subject: subject.trim(),
            body_html: bodyHtml ?? ''
        });
    };

    const onKeyDownSubmit = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        }
    };

    return (
        <Accordion
            expanded={expanded}
            onChange={onToggle}
            disableGutters
            elevation={0}
            sx={{
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                overflow: 'hidden',
                '&:before': { display: 'none' }
            }}
        >
            <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 2, py: 1.25 }}>
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: '100%', minWidth: 0 }}>
                    <Chip
                        size="small"
                        icon={<SubjectRoundedIcon sx={{ fontSize: 16 }} />}
                        label="Template"
                        variant="outlined"
                        color="secondary"
                        sx={{ borderRadius: 2 }}
                    />

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 900,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {template?.name || '-'}
                        </Typography>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                            title={template?.subject || ''}
                        >
                            {template?.subject || '—'}
                        </Typography>
                    </Box>

                    {dirty ? <Chip size="small" label="Não salvo" variant="outlined" sx={{ borderRadius: 2 }} /> : null}
                </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ px: 2, pb: 2 }}>
                <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        <TextField
                            label="Nome"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={onKeyDownSubmit}
                            fullWidth
                            disabled={disableActions}
                        />
                        <TextField
                            label="Assunto"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            onKeyDown={onKeyDownSubmit}
                            fullWidth
                            disabled={disableActions}
                        />
                    </Stack>

                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs
                            value={tab}
                            onChange={(_, v) => setTab(v)}
                            textColor="secondary"
                            indicatorColor="secondary"
                            sx={{
                                minHeight: 44,
                                '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 700 }
                            }}
                        >
                            <Tab label="HTML" />
                            <Tab label="Preview" />
                            <Tab label="Ajuda" />
                        </Tabs>
                    </Box>

                    {tab === 0 ? (
                        <TextField
                            label="HTML"
                            value={bodyHtml}
                            onChange={(e) => setBodyHtml(e.target.value)}
                            fullWidth
                            multiline
                            minRows={10}
                            maxRows={18}
                            disabled={disableActions}
                            inputProps={{ spellCheck: false, style: { fontFamily: monoFont } }}
                        />
                    ) : tab === 1 ? (
                        <Stack spacing={1}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography variant="subtitle2" color="text.secondary">
                                    Preview do HTML
                                </Typography>
                                <CopyButton value={bodyHtml ?? ''} />
                            </Stack>
                            <HtmlPreview html={bodyHtml} />
                        </Stack>
                    ) : (
                        <HelpTabContent />
                    )}

                    <Divider />

                    <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                        <Tooltip title="Excluir template">
                            <span>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    startIcon={<DeleteRoundedIcon />}
                                    onClick={() => onAskDelete(template)}
                                    disabled={disableActions || saving}
                                    sx={{ borderRadius: 2 }}
                                >
                                    Apagar
                                </Button>
                            </span>
                        </Tooltip>

                        <Tooltip title={dirty ? 'Salvar alterações' : 'Sem alterações'}>
                            <span>
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    startIcon={saving ? <CircularProgress size={16} /> : <SaveRoundedIcon fontSize="small" />}
                                    onClick={handleSave}
                                    disabled={!dirty || !canSave || disableActions || saving}
                                    sx={{ borderRadius: 2 }}
                                >
                                    Salvar
                                </Button>
                            </span>
                        </Tooltip>
                    </Stack>
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}

// Linha para templates criados no CONSTRUTOR: em vez do accordion de HTML,
// mostra um botão "Editar" que reabre o construtor.
function TemplateBuilderRow({ template, onEdit, onAskDelete, disableActions }) {
    return (
        <Box
            sx={{
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'secondary.200',
                bgcolor: 'background.paper',
                px: 2,
                py: 1.25,
                display: 'flex',
                alignItems: 'center',
                gap: 1.25
            }}
        >
            <Chip size="small" icon={<DashboardCustomizeRoundedIcon sx={{ fontSize: 16 }} />} label="Construtor" color="secondary" sx={{ borderRadius: 2, fontWeight: 800 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {template?.name || '-'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={template?.subject || ''}>
                    {template?.subject || '—'}
                </Typography>
            </Box>
            <Button
                size="small"
                variant="contained"
                color="secondary"
                startIcon={<EditRoundedIcon fontSize="small" />}
                onClick={() => onEdit(template)}
                disabled={disableActions}
                sx={{ borderRadius: 2, fontWeight: 800 }}
            >
                Editar
            </Button>
            <Tooltip title="Apagar">
                <span>
                    <IconButton size="small" color="error" onClick={() => onAskDelete(template)} disabled={disableActions} sx={{ borderRadius: 2 }}>
                        <DeleteRoundedIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
        </Box>
    );
}

/**
 * Props:
 * - projectSelected: objeto do projeto (precisa ter id)
 *
 * Uso:
 * <Templates projectSelected={selectedProject} />
 */
export default function Templates({ projectSelected }) {
    const projectId = projectSelected?.id || null;

    // Templates de reciclagem têm sua própria área (Automações → Reciclagem).
    const { templates, isLoading, error, refresh, mutate } = useTemplatesPerProject(projectId, { recycle: false });

    const list = useMemo(() => {
        if (!templates) return [];
        if (Array.isArray(templates)) return templates;
        if (Array.isArray(templates?.items)) return templates.items;
        return [];
    }, [templates]);

    const [filter, setFilter] = useState('');
    const [expandedId, setExpandedId] = useState(false);

    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState('');

    const [createOpen, setCreateOpen] = useState(false);
    const [builderOpen, setBuilderOpen] = useState(false);
    const [builderTarget, setBuilderTarget] = useState(null); // null=criar, template=editar

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);

    useEffect(() => {
        setFilter('');
        setExpandedId(false);
        setActionError('');
        setCreateOpen(false);
        setBuilderOpen(false);
        setConfirmOpen(false);
        setPendingDelete(null);
    }, [projectId]);

    const handleBuilderSave = async ({ name, subject, html, model }) => {
        if (!basePath) return;
        setActionLoading(true);
        setActionError('');
        try {
            const payload = { name, subject, body_html: html, builder_model: model };
            if (builderTarget?.id) {
                await patch(`/email/templates/${builderTarget.id}`, payload);
            } else {
                await post(basePath, payload);
            }
            await mutate();
            setBuilderOpen(false);
            setBuilderTarget(null);
        } catch (e) {
            setActionError(getErrorMessage(e, 'Falha ao salvar template'));
        } finally {
            setActionLoading(false);
        }
    };

    const filtered = useMemo(() => {
        const q = safeLower(filter).trim();
        if (!q) return list;
        return list.filter((t) => safeLower(t?.name).includes(q));
    }, [list, filter]);

    const basePath = useMemo(() => {
        return projectId ? `/email/projects/${projectId}/templates` : null;
    }, [projectId]);

    const handleCreate = async (payload) => {
        if (!basePath) return;
        setActionLoading(true);
        setActionError('');
        try {
            await post(basePath, payload);
            await mutate();
            setCreateOpen(false);
        } catch (e) {
            setActionError(getErrorMessage(e, 'Falha ao criar template'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleSave = async (templateId, payload) => {
        if (!basePath || !templateId) return;
        setActionLoading(true);
        setActionError('');
        try {
            await patch(`/email/templates/${templateId}`, payload);
            await mutate();
        } catch (e) {
            setActionError(getErrorMessage(e, 'Falha ao salvar template'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleAskDelete = (template) => {
        setPendingDelete(template);
        setConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (!basePath || !pendingDelete?.id) return;
        setActionLoading(true);
        setActionError('');
        try {
            await remove(`/email/templates/${pendingDelete.id}`);
            await mutate();
            setConfirmOpen(false);
            setPendingDelete(null);
            if (expandedId === pendingDelete.id) setExpandedId(false);
        } catch (e) {
            setActionError(getErrorMessage(e, 'Falha ao apagar template'));
        } finally {
            setActionLoading(false);
        }
    };

    if (!projectId) {
        return (
            <Box
                sx={{
                    p: 3,
                    borderRadius: 3,
                    border: '1px dashed',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    textAlign: 'center'
                }}
            >
                <Typography variant="h6" sx={{ mb: 0.5 }}>
                    Templates
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Selecione um projeto para visualizar os templates.
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
                sx={{ mb: 2 }}
            >
                <Stack direction="row" spacing={1} alignItems="center">
                    <DataObjectRoundedIcon fontSize="small" />
                    <Box>
                        <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
                            Templates
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {filtered.length} exibidos
                        </Typography>
                    </Box>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                    <Tooltip title="Atualizar">
                        <span>
                            <IconButton
                                onClick={refresh}
                                disabled={isLoading || actionLoading}
                                size="small"
                                sx={{
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper'
                                }}
                            >
                                <RefreshRoundedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>

                    <Button
                        onClick={() => setCreateOpen(true)}
                        variant="outlined"
                        color="secondary"
                        startIcon={<AddRoundedIcon />}
                        sx={{ borderRadius: 2, fontWeight: 800 }}
                        disabled={actionLoading}
                    >
                        Template
                    </Button>

                    <Button
                        onClick={() => { setActionError(''); setBuilderTarget(null); setBuilderOpen(true); }}
                        variant="contained"
                        color="secondary"
                        startIcon={<AddRoundedIcon />}
                        endIcon={<DashboardCustomizeRoundedIcon fontSize="small" />}
                        sx={{ borderRadius: 2, fontWeight: 800 }}
                        disabled={actionLoading}
                    >
                        Construtor
                    </Button>

                    <ImportTemplatesButton projectId={projectId} recycle={false} onImported={() => mutate()} />
                </Stack>
            </Stack>

            {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {getErrorMessage(error, 'Falha ao carregar templates')}
                </Alert>
            ) : null}

            {actionError ? (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>
                    {actionError}
                </Alert>
            ) : null}

            <TextField
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrar por nome..."
                fullWidth
                sx={{ mb: 2 }}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchRoundedIcon fontSize="small" />
                        </InputAdornment>
                    )
                }}
            />

            {isLoading ? (
                <TemplatesSkeleton rows={6} />
            ) : filtered.length === 0 ? (
                <Box
                    sx={{
                        p: 3,
                        borderRadius: 3,
                        border: '1px dashed',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        textAlign: 'center'
                    }}
                >
                    <Typography variant="h6" sx={{ mb: 0.5 }}>
                        Nenhum template encontrado
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {filter.trim() ? 'Nenhum template corresponde ao filtro.' : 'Crie seu primeiro template para este projeto.'}
                    </Typography>
                    <Button
                        onClick={() => setCreateOpen(true)}
                        variant="contained"
                        color="secondary"
                        startIcon={<AddRoundedIcon />}
                        sx={{ borderRadius: 2 }}
                        disabled={actionLoading}
                    >
                        Criar template
                    </Button>
                </Box>
            ) : (
                <Stack spacing={1}>
                    {filtered.map((t) =>
                        t.builder_model ? (
                            <TemplateBuilderRow
                                key={t.id}
                                template={t}
                                onEdit={(tpl) => { setActionError(''); setBuilderTarget(tpl); setBuilderOpen(true); }}
                                onAskDelete={handleAskDelete}
                                disableActions={actionLoading}
                            />
                        ) : (
                            <TemplateAccordion
                                key={t.id}
                                template={t}
                                expanded={expandedId === t.id}
                                onToggle={() => setExpandedId((prev) => (prev === t.id ? false : t.id))}
                                onSave={handleSave}
                                onAskDelete={handleAskDelete}
                                saving={actionLoading && expandedId === t.id}
                                disableActions={actionLoading}
                            />
                        )
                    )}
                </Stack>
            )}

            <CreateTemplateDialog
                open={createOpen}
                loading={actionLoading}
                error={actionError}
                onClose={() => (actionLoading ? null : setCreateOpen(false))}
                onSubmit={handleCreate}
            />

            <EmailBuilder
                open={builderOpen}
                mode="template"
                initialModel={builderTarget?.builder_model || null}
                initialName={builderTarget?.name || ''}
                initialSubject={builderTarget?.subject || ''}
                saving={actionLoading}
                error={builderOpen ? actionError : ''}
                onClose={() => { if (!actionLoading) { setBuilderOpen(false); setBuilderTarget(null); } }}
                onSave={handleBuilderSave}
            />

            <ConfirmDialog
                open={confirmOpen}
                title="Apagar template?"
                description={`Tem certeza que deseja apagar o template "${pendingDelete?.name || ''}"? Essa ação não pode ser desfeita.`}
                confirmText="Apagar"
                loading={actionLoading}
                onClose={() => (actionLoading ? null : setConfirmOpen(false))}
                onConfirm={handleDelete}
            />
        </Box>
    );
}
