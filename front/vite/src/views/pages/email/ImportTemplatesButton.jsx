import { useRef, useState } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';

import Tooltip from '@mui/material/Tooltip';

import { CloseRoundedIcon as CloseRoundedIcon } from 'ui-component/icons';
import { ContentCopyRoundedIcon as ContentCopyRoundedIcon } from 'ui-component/icons';
import { CheckRoundedIcon as CheckRoundedIcon } from 'ui-component/icons';
import { UploadFileRoundedIcon as UploadFileRoundedIcon } from 'ui-component/icons';
import { DownloadRoundedIcon as DownloadRoundedIcon } from 'ui-component/icons';
import { ArticleRoundedIcon as ArticleRoundedIcon } from 'ui-component/icons';
import { VisibilityRoundedIcon as VisibilityRoundedIcon } from 'ui-component/icons';

import toast from 'react-hot-toast';
import { post } from '../../../api/api';
import { modelToHtml } from './emailBuilderCore';
import { buildClaudePrompt, parseTemplatesFile, exampleCsv, previewHtml, TEMPLATE_COLUMNS } from './emailImportCore';

// Logo "faísca" do Claude (aprox.), na cor da marca.
function ClaudeMark({ size = 20 }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {rays.map((deg, i) => (
        <rect
          key={i}
          x="46.5" y="8" width="7" height="34" rx="3.5"
          fill="#D97757"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
    </svg>
  );
}

export default function ImportTemplatesButton({ projectId, recycle = false, onImported, size = 'medium' }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [templates, setTemplates] = useState(null); // array | null
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [previewIdx, setPreviewIdx] = useState(null);
  const fileRef = useRef(null);

  const reset = () => {
    setTemplates(null); setError(''); setResult(null);
    setProgress({ done: 0, total: 0, ok: 0, fail: 0 });
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleOpen = () => { reset(); setOpen(true); };
  const handleClose = () => { if (!importing) setOpen(false); };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildClaudePrompt());
      setCopied(true);
      toast.success('Prompt copiado! Cole no Claude.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente.');
    }
  };

  const downloadExample = () => {
    const blob = new Blob([exampleCsv()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'exemplo-templates.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true); setError(''); setResult(null); setTemplates(null);
    try {
      const parsed = await parseTemplatesFile(file);
      const valid = parsed.filter((t) => t.valid);
      if (valid.length === 0) {
        setError('Nenhum template válido encontrado. Confira as colunas do arquivo (name, subject, heading/intro/body…).');
      } else {
        setTemplates(valid);
      }
    } catch (err) {
      setError('Falha ao ler o arquivo. Use .xlsx ou .csv gerado pelo Claude.');
    } finally {
      setParsing(false);
    }
  };

  const doImport = async () => {
    if (!templates?.length || !projectId) return;
    setImporting(true); setError(''); setResult(null);
    let ok = 0, fail = 0;
    setProgress({ done: 0, total: templates.length, ok: 0, fail: 0 });
    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      try {
        const html = modelToHtml(t.model);
        await post(`/email/projects/${projectId}/templates`, {
          name: t.name,
          subject: t.subject,
          body_html: html,
          builder_model: t.model,
          ...(recycle ? { recycle: true } : {})
        });
        ok += 1;
      } catch {
        fail += 1;
      }
      setProgress({ done: i + 1, total: templates.length, ok, fail });
    }
    setImporting(false);
    setResult({ ok, fail });
    if (ok > 0) { toast.success(`${ok} template${ok === 1 ? '' : 's'} importado${ok === 1 ? '' : 's'}!`); onImported && onImported(); }
    if (ok > 0 && fail === 0) setTemplates(null);
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        disabled={!projectId}
        variant="outlined"
        size={size}
        startIcon={<ClaudeMark size={18} />}
        sx={{ borderRadius: 2, fontWeight: 800, borderColor: '#D97757', color: '#B85C3C', '&:hover': { borderColor: '#B85C3C', bgcolor: 'rgba(217,119,87,0.06)' } }}
      >
        Importar templates do Claude
      </Button>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ClaudeMark size={22} />
          <Typography variant="h5" sx={{ fontWeight: 900, flex: 1 }}>Importar templates do Claude</Typography>
          <IconButton onClick={handleClose} disabled={importing} size="small"><CloseRoundedIcon fontSize="small" /></IconButton>
        </DialogTitle>

        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Crie vários e-mails de uma vez com a ajuda do Claude e importe por planilha. Todos ficam <b>editáveis no construtor</b> depois.
          </Typography>

          {/* Passo 1 */}
          <Box sx={{ p: 1.75, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 0.5 }}>1 · Copie o prompt e converse com o Claude</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
              O Claude vai te perguntar nicho, oferta, links dos botões e quantos templates — e gerar o arquivo.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                onClick={copyPrompt}
                variant="contained"
                startIcon={copied ? <CheckRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
                sx={{ borderRadius: 2, fontWeight: 800, bgcolor: '#D97757', '&:hover': { bgcolor: '#C4623F' } }}
              >
                {copied ? 'Copiado!' : 'Copiar prompt para o Claude'}
              </Button>
              <Button onClick={downloadExample} variant="text" startIcon={<DownloadRoundedIcon fontSize="small" />} sx={{ borderRadius: 2, fontWeight: 700 }}>
                Baixar exemplo (.csv)
              </Button>
            </Stack>
          </Box>

          {/* Passo 2 */}
          <Box sx={{ p: 1.75, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 0.5 }}>2 · Envie o arquivo gerado (.xlsx ou .csv)</Typography>
            <input ref={fileRef} type="file" accept=".xlsx,.csv,text/csv" style={{ display: 'none' }} onChange={onFile} />
            <Button
              onClick={() => fileRef.current?.click()}
              variant="outlined"
              startIcon={<UploadFileRoundedIcon fontSize="small" />}
              disabled={parsing || importing}
              sx={{ borderRadius: 2, fontWeight: 800, mt: 0.5 }}
            >
              {parsing ? 'Lendo…' : 'Escolher arquivo'}
            </Button>

            {error ? <Alert severity="warning" sx={{ mt: 1.5, borderRadius: 2 }}>{error}</Alert> : null}

            {templates?.length ? (
              <Box sx={{ mt: 1.5 }}>
                <Chip color="secondary" label={`${templates.length} template${templates.length === 1 ? '' : 's'} pronto${templates.length === 1 ? '' : 's'} para importar`} sx={{ borderRadius: 1.5, fontWeight: 800, mb: 1 }} />
                <Box sx={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {templates.map((t, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.75, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                      <ArticleRoundedIcon fontSize="small" color="secondary" />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{t.name}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{t.subject}</Typography>
                      </Box>
                      <Tooltip title="Pré-visualizar">
                        <IconButton size="small" onClick={() => setPreviewIdx(i)}><VisibilityRoundedIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </Box>
                  ))}
                </Box>
              </Box>
            ) : null}

            {importing ? (
              <Box sx={{ mt: 1.5 }}>
                <LinearProgress variant="determinate" value={progress.total ? (progress.done / progress.total) * 100 : 0} sx={{ borderRadius: 1, height: 8 }} />
                <Typography variant="caption" color="text.secondary">Importando {progress.done}/{progress.total}…</Typography>
              </Box>
            ) : null}

            {result ? (
              <Alert severity={result.fail ? 'warning' : 'success'} sx={{ mt: 1.5, borderRadius: 2 }}>
                {result.ok} importado{result.ok === 1 ? '' : 's'} com sucesso{result.fail ? ` · ${result.fail} falharam` : ''}.
              </Alert>
            ) : null}
          </Box>

          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" color="text.secondary">
            Colunas do arquivo: {TEMPLATE_COLUMNS.join(', ')}. As variáveis ({'{{name}}'}, {'{{email}}'}…), o rastreamento de clique e o descadastro são aplicados automaticamente.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose} disabled={importing} variant="outlined" sx={{ borderRadius: 2 }}>Fechar</Button>
          <Button
            onClick={doImport}
            disabled={!templates?.length || importing}
            variant="contained"
            color="secondary"
            sx={{ borderRadius: 2, fontWeight: 900 }}
          >
            {importing ? 'Importando…' : `Importar ${templates?.length || ''} template${templates?.length === 1 ? '' : 's'}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pré-visualização do e-mail */}
      <Dialog open={previewIdx !== null} onClose={() => setPreviewIdx(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 900 }} noWrap>
              {previewIdx !== null ? templates?.[previewIdx]?.name : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              Assunto: {previewIdx !== null ? templates?.[previewIdx]?.subject : ''}
            </Typography>
          </Box>
          <IconButton onClick={() => setPreviewIdx(null)} size="small"><CloseRoundedIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#f3f4f6' }}>
          {previewIdx !== null ? (
            <Box
              component="iframe"
              title="preview"
              srcDoc={previewHtml(templates[previewIdx].model)}
              sandbox=""
              sx={{ width: '100%', height: 460, border: 0, display: 'block' }}
            />
          ) : null}
        </DialogContent>
        <DialogActions sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, px: 1 }}>
            Valores de exemplo ({'{{name}}'} = Maria). Você pode editar tudo no construtor depois de importar.
          </Typography>
          <Button onClick={() => setPreviewIdx(null)} variant="outlined" sx={{ borderRadius: 2 }}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
