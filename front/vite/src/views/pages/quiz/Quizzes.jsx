import { useEffect, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';

import { AddRoundedIcon as AddRoundedIcon } from 'ui-component/icons';
import { EditRoundedIcon as EditRoundedIcon } from 'ui-component/icons';
import { DeleteRoundedIcon as DeleteRoundedIcon } from 'ui-component/icons';
import { RefreshRoundedIcon as RefreshRoundedIcon } from 'ui-component/icons';
import { OpenInNewRoundedIcon as OpenInNewRoundedIcon } from 'ui-component/icons';
import { BrushRoundedIcon as BrushRoundedIcon } from 'ui-component/icons';
import { ContentCopyRoundedIcon as ContentCopyRoundedIcon } from 'ui-component/icons';

import { CampaignRoundedIcon as CampaignRoundedIcon } from 'ui-component/icons';

import { useNavigate } from 'react-router-dom';
import MainCard from 'ui-component/cards/MainCard';
import { get, post, patch, remove } from 'api/api';
import useQuizzes from '../../../hooks/useQuizzes';
import useQuizDomains from '../../../hooks/useQuizDomains';
import useEmailProjects from '../../../hooks/useEmailProjects';
import QuizAdsDialog from './QuizAdsDialog';
import EmailBuilder from '../email/EmailBuilder';
import { DashboardCustomizeRoundedIcon as DashboardCustomizeRoundedIcon } from 'ui-component/icons';

const getErrorMessage = (err, fallback = 'Falha ao processar a ação') =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

function toList(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

const quizPublicUrl = (quiz) => (quiz ? `https://${quiz.domain}/quiz/${quiz.slug}` : '');

// ===== Modal de criar/editar quiz =====
function QuizFormDialog({ open, mode, initial, verifiedDomains, projects, loading, error, onClose, onSubmit }) {
  const [form, setForm] = useState({});
  const [emailTab, setEmailTab] = useState(0);
  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmailTab(0);
    if (mode === 'edit') {
      setForm({
        name: initial?.name || '',
        domain: initial?.domain || '',
        email_project_id: initial?.email_project_id || '',
        header_scripts: initial?.header_scripts || '',
        footer_scripts: initial?.footer_scripts || '',
        lead_email_html: initial?.lead_email_html || '',
        lead_email_subject: initial?.lead_email_subject || '',
        lead_email_model: initial?.lead_email_model || null,
        active: initial?.active !== false
      });
    } else {
      setForm({
        name: '',
        domain: verifiedDomains[0]?.domain || '',
        email_project_id: '',
        header_scripts: '',
        footer_scripts: '',
        lead_email_html: '',
        lead_email_subject: '',
        lead_email_model: null,
        active: true
      });
    }
  }, [open, mode, initial, verifiedDomains]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
        <DialogTitle>{mode === 'edit' ? 'Editar quiz' : 'Novo quiz'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            <TextField label="Nome do quiz" value={form.name || ''} onChange={set('name')} required fullWidth />

            <TextField
              select
              label="Domínio (verificado)"
              value={form.domain || ''}
              onChange={set('domain')}
              required
              fullWidth
              helperText={
                verifiedDomains.length === 0
                  ? 'Nenhum domínio de quiz verificado. Cadastre em Configurações > Conta & Domínios > Quizzes.'
                  : 'Apenas domínios de quiz verificados aparecem aqui.'
              }
            >
              {verifiedDomains.length === 0 ? (
                <MenuItem value="" disabled>
                  — nenhum domínio verificado —
                </MenuItem>
              ) : (
                verifiedDomains.map((d) => (
                  <MenuItem key={d.id} value={d.domain}>
                    {d.domain}
                  </MenuItem>
                ))
              )}
            </TextField>

            <TextField
              select
              label="Projeto de e-mail (opcional)"
              value={form.email_project_id || ''}
              onChange={set('email_project_id')}
              fullWidth
              helperText="Se escolher, os leads captados pelo quiz vão para este projeto."
            >
              <MenuItem value="">— nenhum —</MenuItem>
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>

            {/* E-mail imediato ao lead — só quando há projeto vinculado */}
            {form.email_project_id ? (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.25 }}>
                  E-mail imediato ao lead
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Enviado assim que o lead preenche a captação. Deixe o HTML vazio para não enviar.
                </Typography>

                <Button
                  size="small"
                  variant="contained"
                  color="secondary"
                  startIcon={<DashboardCustomizeRoundedIcon fontSize="small" />}
                  onClick={() => setBuilderOpen(true)}
                  sx={{ mt: 1, borderRadius: 2, fontWeight: 800 }}
                >
                  Abrir construtor visual
                </Button>

                <TextField
                  label="Assunto do e-mail"
                  value={form.lead_email_subject || ''}
                  onChange={set('lead_email_subject')}
                  fullWidth
                  size="small"
                  sx={{ mt: 1.5 }}
                  placeholder="Ex.: Sua recomendação chegou 🎉"
                />

                <Tabs value={emailTab} onChange={(_, v) => setEmailTab(v)} sx={{ mt: 1, minHeight: 0, '& .MuiTab-root': { minHeight: 0, textTransform: 'none', fontWeight: 700, py: 1 } }}>
                  <Tab label="HTML" />
                  <Tab label="Preview" />
                </Tabs>

                {emailTab === 0 ? (
                  <TextField
                    value={form.lead_email_html || ''}
                    onChange={set('lead_email_html')}
                    fullWidth
                    multiline
                    minRows={8}
                    maxRows={20}
                    sx={{ mt: 1 }}
                    placeholder={'<html>\n  <body>Olá {{name}}, obrigado por responder!</body>\n</html>'}
                    inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
                  />
                ) : (
                  <Box sx={{ mt: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden', height: 320, bgcolor: '#fff' }}>
                    {String(form.lead_email_html || '').trim() ? (
                      <Box
                        component="iframe"
                        title="preview-email"
                        srcDoc={form.lead_email_html}
                        sandbox=""
                        sx={{ width: '100%', height: '100%', border: 0 }}
                      />
                    ) : (
                      <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary', fontSize: 13 }}>
                        Sem HTML para pré-visualizar.
                      </Box>
                    )}
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  Variáveis: {'{{name}}'}, {'{{email}}'}, {'{{phone}}'} e {'{{unsubscribe_link}}'}.
                </Typography>

                <EmailBuilder
                  open={builderOpen}
                  mode="body"
                  initialModel={form.lead_email_model || null}
                  onClose={() => setBuilderOpen(false)}
                  onSave={({ html, model }) => {
                    setForm((p) => ({ ...p, lead_email_html: html, lead_email_model: model }));
                    setBuilderOpen(false);
                    setEmailTab(1);
                  }}
                />
              </Box>
            ) : null}

            <TextField
              label="Código do header (anúncios)"
              value={form.header_scripts || ''}
              onChange={set('header_scripts')}
              fullWidth
              multiline
              minRows={2}
              maxRows={5}
              placeholder="<script ...></script>"
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
            />

            <TextField
              label="Código do rodapé/footer"
              value={form.footer_scripts || ''}
              onChange={set('footer_scripts')}
              fullWidth
              multiline
              minRows={2}
              maxRows={5}
              placeholder="<script ...></script>"
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            type="submit"
            variant="contained"
            color="secondary"
            disabled={loading || !String(form.name || '').trim() || !String(form.domain || '').trim()}
          >
            {mode === 'edit' ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export default function Quizzes() {
  const navigate = useNavigate();
  const { quizzes, isLoading, error, mutate } = useQuizzes();
  const { quizDomains } = useQuizDomains();
  const { emailProjects } = useEmailProjects();

  const [splits, setSplits] = useState([]);
  const [activeSplitId, setActiveSplitId] = useState(null);
  const [weightDraft, setWeightDraft] = useState({});
  const [splitDialog, setSplitDialog] = useState({ open: false, mode: 'create', id: null, name: '' });
  const [splitToDelete, setSplitToDelete] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formData, setFormData] = useState(null);
  const [quizToDelete, setQuizToDelete] = useState(null);
  const [adsQuiz, setAdsQuiz] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const list = useMemo(() => toList(quizzes), [quizzes]);
  const verifiedDomains = useMemo(
    () => toList(quizDomains).filter((d) => d?.status === 'VERIFIED' && d?.domain),
    [quizDomains]
  );
  const projects = useMemo(() => toList(emailProjects), [emailProjects]);

  const activeSplit = useMemo(() => splits.find((s) => s.id === activeSplitId) || null, [splits, activeSplitId]);
  const filteredList = useMemo(
    () => (activeSplitId ? list.filter((q) => (q.split_id || null) === activeSplitId) : list),
    [list, activeSplitId]
  );

  const loadSplits = async () => {
    try {
      const data = await get('/quiz-splits');
      const arr = Array.isArray(data) ? data : [];
      setSplits(arr);
      setActiveSplitId((prev) =>
        prev && arr.some((s) => s.id === prev) ? prev : arr.find((s) => s.is_default)?.id || arr[0]?.id || null
      );
    } catch {
      // silencioso
    }
  };
  useEffect(() => {
    loadSplits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Quiz actions ----
  const handleSubmitQuiz = async (form) => {
    setActionLoading(true);
    setActionError('');
    try {
      const payload = {
        name: form.name,
        domain: form.domain,
        email_project_id: form.email_project_id || null,
        header_scripts: form.header_scripts || null,
        footer_scripts: form.footer_scripts || null,
        // só faz sentido com projeto vinculado; sem projeto, limpa o e-mail
        lead_email_html: form.email_project_id ? form.lead_email_html || null : null,
        lead_email_subject: form.email_project_id ? form.lead_email_subject || null : null,
        lead_email_model: form.email_project_id ? form.lead_email_model || null : null
      };
      if (formMode === 'edit') {
        await patch(`/quizzes/${formData.id}`, payload);
      } else {
        await post('/quizzes', { ...payload, ...(activeSplitId ? { split_id: activeSplitId } : {}) });
      }
      setFormOpen(false);
      setActionSuccess(formMode === 'edit' ? 'Quiz atualizado.' : 'Quiz criado.');
      await Promise.all([mutate(), loadSplits()]);
    } catch (e) {
      setActionError(getErrorMessage(e, 'Falha ao salvar o quiz.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (quiz, value) => {
    setActionError('');
    try {
      await patch(`/quizzes/${quiz.id}`, { active: value });
      await mutate();
    } catch (e) {
      setActionError(getErrorMessage(e, 'Falha ao alterar status.'));
    }
  };

  const confirmDeleteQuiz = async () => {
    if (!quizToDelete) return;
    setActionLoading(true);
    setActionError('');
    try {
      await remove(`/quizzes/${quizToDelete.id}`);
      setQuizToDelete(null);
      await Promise.all([mutate(), loadSplits()]);
    } catch (e) {
      setActionError(getErrorMessage(e, 'Falha ao remover o quiz.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPublic = (quiz) => window.open(quizPublicUrl(quiz), '_blank', 'noopener,noreferrer');
  const handleCopyPublic = async (quiz) => {
    try {
      await navigator.clipboard.writeText(quizPublicUrl(quiz));
      setActionSuccess('Link copiado.');
    } catch {
      setActionError('Não foi possível copiar.');
    }
  };

  // ---- Weight ----
  const handleWeightSave = async (quiz) => {
    const raw = weightDraft[quiz.id];
    if (raw === undefined) return;
    const n = Math.max(0, Math.round(Number(raw) || 0));
    const clear = () =>
      setWeightDraft((prev) => {
        const next = { ...prev };
        delete next[quiz.id];
        return next;
      });
    if (n === Number(quiz.split_weight ?? 100)) {
      clear();
      return;
    }
    try {
      await patch(`/quizzes/${quiz.id}`, { split_weight: n });
      await mutate();
    } catch (e) {
      setActionError(getErrorMessage(e, 'Falha ao salvar o peso.'));
    } finally {
      clear();
    }
  };

  // ---- Split actions ----
  const splitPublicUrl = (split) => (split ? `${window.location.origin}/quiz/splits/${split.slug}` : '');
  const handleCopySplitLink = async (split) => {
    try {
      await navigator.clipboard.writeText(splitPublicUrl(split));
      setActionSuccess('Link do split copiado.');
    } catch {
      setActionError('Não foi possível copiar o link.');
    }
  };
  const handleOpenSplitLink = (split) => window.open(splitPublicUrl(split), '_blank', 'noopener,noreferrer');

  const handleSubmitSplit = async () => {
    const name = String(splitDialog.name || '').trim();
    if (!name) return;
    setActionLoading(true);
    setActionError('');
    try {
      if (splitDialog.mode === 'edit') {
        await patch(`/quiz-splits/${splitDialog.id}`, { name });
        await loadSplits();
      } else {
        const created = await post('/quiz-splits', { name });
        await loadSplits();
        if (created?.id) setActiveSplitId(created.id);
      }
      setSplitDialog({ open: false, mode: 'create', id: null, name: '' });
    } catch (e) {
      setActionError(getErrorMessage(e, 'Falha ao salvar split.'));
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeleteSplit = async () => {
    if (!splitToDelete) return;
    setActionLoading(true);
    setActionError('');
    try {
      await remove(`/quiz-splits/${splitToDelete.id}`);
      await loadSplits();
      setSplitToDelete(null);
      setActionSuccess('Split apagado.');
    } catch (e) {
      setActionError(getErrorMessage(e, 'Não foi possível apagar o split.'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <MainCard content={false} sx={{ overflow: 'hidden', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      {/* Barra de splits */}
      <Box sx={{ px: 2, pt: 1.75, pb: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Tabs
          value={activeSplit ? activeSplitId : false}
          onChange={(_, v) => setActiveSplitId(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ flex: 1, minHeight: 0, '& .MuiTab-root': { minHeight: 0, textTransform: 'none', fontWeight: 800, py: 1 } }}
        >
          {splits.map((s) => (
            <Tab key={s.id} value={s.id} label={`${s.name} · ${s.quizzes_count}`} />
          ))}
        </Tabs>
        <Button
          size="small"
          startIcon={<AddRoundedIcon />}
          onClick={() => setSplitDialog({ open: true, mode: 'create', id: null, name: '' })}
          sx={{ borderRadius: 2, fontWeight: 800 }}
        >
          Split
        </Button>
        {activeSplit ? (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title="Copiar link do split">
              <span>
                <IconButton size="small" onClick={() => handleCopySplitLink(activeSplit)} sx={{ borderRadius: 2 }}>
                  <ContentCopyRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Abrir link do split">
              <span>
                <IconButton size="small" onClick={() => handleOpenSplitLink(activeSplit)} sx={{ borderRadius: 2 }}>
                  <OpenInNewRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Renomear split">
              <span>
                <IconButton
                  size="small"
                  onClick={() => setSplitDialog({ open: true, mode: 'edit', id: activeSplit.id, name: activeSplit.name })}
                  sx={{ borderRadius: 2 }}
                >
                  <EditRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            {!activeSplit.is_default ? (
              <Tooltip title="Apagar split">
                <span>
                  <IconButton size="small" color="error" onClick={() => { setActionError(''); setSplitToDelete(activeSplit); }} sx={{ borderRadius: 2 }}>
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
          </Stack>
        ) : null}
      </Box>

      <Divider />

      {/* Header */}
      <Box sx={{ px: 2, py: 1.75, display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box>
          <Typography variant="h4">{activeSplit ? activeSplit.name : 'Quizzes'}</Typography>
          <Typography variant="body2" color="text.secondary">
            {filteredList.length} no total
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Atualizar">
            <span>
              <IconButton onClick={() => { mutate(); loadSplits(); }} disabled={isLoading || actionLoading} size="small" sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <RefreshRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            onClick={() => { setActionError(''); setFormMode('create'); setFormData(null); setFormOpen(true); }}
            variant="contained"
            color="secondary"
            startIcon={<AddRoundedIcon />}
            sx={{ borderRadius: 2, fontWeight: 900 }}
            disabled={actionLoading}
          >
            Novo quiz
          </Button>
        </Stack>
      </Box>

      <Divider />

      <Box sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          {error ? <Alert severity="error">{getErrorMessage(error, 'Falha ao carregar quizzes.')}</Alert> : null}
          {actionError ? <Alert severity="error" onClose={() => setActionError('')}>{actionError}</Alert> : null}
          {actionSuccess ? <Alert severity="success" onClose={() => setActionSuccess('')}>{actionSuccess}</Alert> : null}

          {verifiedDomains.length === 0 ? (
            <Alert
              severity="info"
              action={
                <Button size="small" color="inherit" onClick={() => navigate('/settings/domains?sub=quiz')}>
                  Cadastrar domínio
                </Button>
              }
            >
              Para criar um quiz, cadastre e verifique um domínio em Conta & Domínios &gt; Quizzes.
            </Alert>
          ) : null}

          {isLoading ? (
            <Stack spacing={1}>
              {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={64} />)}
            </Stack>
          ) : filteredList.length === 0 ? (
            <Box sx={{ p: 3, borderRadius: 3, border: '1px dashed', borderColor: 'divider', textAlign: 'center', bgcolor: 'background.paper' }}>
              <Typography variant="h6" sx={{ mb: 0.5 }}>Nenhum quiz neste split</Typography>
              <Typography variant="body2" color="text.secondary">
                Crie um quiz para publicá-lo no seu domínio.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1}>
              {filteredList.map((quiz) => (
                <Box key={quiz.id} sx={{ borderRadius: 2.5, border: '1px solid', borderColor: quiz.active ? 'secondary.200' : 'divider', bgcolor: 'background.paper', p: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 900 }} noWrap title={quiz.name}>
                          {quiz.name}
                        </Typography>
                        <Chip size="small" label={quiz.active ? 'Ativo' : 'Inativo'} color={quiz.active ? 'secondary' : 'default'} variant={quiz.active ? 'filled' : 'outlined'} sx={{ borderRadius: 2, fontWeight: 800 }} />
                        <Chip size="small" variant="outlined" label={quiz.email_project_id ? `Projeto: ${quiz?.email_projects?.name || 'vinculado'}` : 'Sem projeto de e-mail'} sx={{ borderRadius: 2, fontWeight: 800 }} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" noWrap title={quiz.domain}>
                        Domínio: {quiz.domain}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap title={quiz.slug}>
                        Slug: {quiz.slug}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Tooltip title="Peso deste quiz no split (sorteio ponderado)">
                        <TextField
                          size="small"
                          type="number"
                          value={weightDraft[quiz.id] ?? String(quiz.split_weight ?? 100)}
                          onChange={(e) => setWeightDraft((p) => ({ ...p, [quiz.id]: e.target.value }))}
                          onBlur={() => handleWeightSave(quiz)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                          disabled={actionLoading}
                          inputProps={{ min: 0, style: { textAlign: 'right' } }}
                          InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">%</Typography> }}
                          sx={{ width: 92 }}
                        />
                      </Tooltip>

                      <Tooltip title={quiz.active ? 'Ativo' : 'Inativo'}>
                        <span>
                          <Switch size="small" color="secondary" checked={Boolean(quiz.active)} disabled={actionLoading} onChange={(e) => handleToggleActive(quiz, e.target.checked)} />
                        </span>
                      </Tooltip>

                      <Tooltip title="Anúncios">
                        <span>
                          <IconButton size="small" onClick={() => setAdsQuiz(quiz)} disabled={actionLoading} sx={{ borderRadius: 2 }}>
                            <CampaignRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title="Builder visual">
                        <span>
                          <IconButton size="small" color="secondary" onClick={() => navigate(`/quizzes/${quiz.id}/builder`)} disabled={actionLoading} sx={{ borderRadius: 2 }}>
                            <BrushRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title="Abrir link público">
                        <span>
                          <IconButton size="small" onClick={() => handleOpenPublic(quiz)} sx={{ borderRadius: 2 }}>
                            <OpenInNewRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title="Copiar link">
                        <span>
                          <IconButton size="small" onClick={() => handleCopyPublic(quiz)} sx={{ borderRadius: 2 }}>
                            <ContentCopyRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title="Editar">
                        <span>
                          <IconButton size="small" onClick={() => { setActionError(''); setFormMode('edit'); setFormData(quiz); setFormOpen(true); }} disabled={actionLoading} sx={{ borderRadius: 2 }}>
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title="Excluir">
                        <span>
                          <IconButton size="small" color="error" onClick={() => { setActionError(''); setQuizToDelete(quiz); }} disabled={actionLoading} sx={{ borderRadius: 2 }}>
                            <DeleteRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </Box>

      <QuizFormDialog
        open={formOpen}
        mode={formMode}
        initial={formData}
        verifiedDomains={verifiedDomains}
        projects={projects}
        loading={actionLoading}
        error={formOpen ? actionError : ''}
        onClose={() => (actionLoading ? null : setFormOpen(false))}
        onSubmit={handleSubmitQuiz}
      />

      <QuizAdsDialog open={Boolean(adsQuiz)} quiz={adsQuiz} onClose={() => setAdsQuiz(null)} />

      {/* Criar/renomear split */}
      <Dialog open={splitDialog.open} onClose={() => (actionLoading ? null : setSplitDialog({ open: false, mode: 'create', id: null, name: '' }))} maxWidth="xs" fullWidth>
        <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSubmitSplit(); }}>
          <DialogTitle>{splitDialog.mode === 'edit' ? 'Renomear split' : 'Novo split'}</DialogTitle>
          <DialogContent>
            <TextField autoFocus fullWidth label="Nome do split" value={splitDialog.name} onChange={(e) => setSplitDialog((p) => ({ ...p, name: e.target.value }))} placeholder="Ex.: Quizzes Fosoh" sx={{ mt: 1 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSplitDialog({ open: false, mode: 'create', id: null, name: '' })} disabled={actionLoading}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={actionLoading || !String(splitDialog.name || '').trim()}>
              {splitDialog.mode === 'edit' ? 'Salvar' : 'Criar'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Apagar split */}
      <Dialog open={Boolean(splitToDelete)} onClose={() => (actionLoading ? null : setSplitToDelete(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Apagar split</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            {actionError ? <Alert severity="error">{actionError}</Alert> : null}
            <Typography variant="body2">
              Apagar o split “{splitToDelete?.name}”? Só é possível apagar splits sem quizzes dentro.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSplitToDelete(null)} disabled={actionLoading}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={confirmDeleteSplit} disabled={actionLoading}>Apagar</Button>
        </DialogActions>
      </Dialog>

      {/* Apagar quiz */}
      <Dialog open={Boolean(quizToDelete)} onClose={() => (actionLoading ? null : setQuizToDelete(null))} maxWidth="xs" fullWidth>
        <DialogTitle>Excluir quiz</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Excluir o quiz “{quizToDelete?.name}”? Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuizToDelete(null)} disabled={actionLoading}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={confirmDeleteQuiz} disabled={actionLoading}>Excluir</Button>
        </DialogActions>
      </Dialog>
    </MainCard>
  );
}
