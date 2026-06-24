import React, { useEffect, useMemo, useState } from 'react';
import { Switch } from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';

import {
  Box,
  Stack,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  MenuItem
} from '@mui/material';

import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import WorkspacesRoundedIcon from '@mui/icons-material/WorkspacesRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import DataObjectRoundedIcon from '@mui/icons-material/DataObjectRounded';

import MainCard from 'ui-component/cards/MainCard';
import useEmailProjects from '../../../hooks/useEmailProjects';
import useDomains from '../../../hooks/useDomains';

import { post, patch, remove } from '../../../api/api';
import Templates from './Templates';
import WebhookLeadsForm from './WebhookLeadsForm';
import useCountLeads from '../../../hooks/useCountLeads';

import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded';
import ImportLeads from './ImportLeads';
import Schedules from './Schedules';
import Sents from './Sents';
import ExportEmailLeads from './EmailLeadsExports';
import ExportEmailProjectLeads from './ExportEmailProjectLeads';
import ShareLeadsInterProjects from './ShareLeadsInterProjects';

const safeLower = (v) => (v ?? '').toString().toLowerCase();

const formatDateTime = (iso) => {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  } catch (e) {
    console.log(e);
    return iso;
  }
};

const getErrorMessage = (err, fallback = 'Ocorreu um erro') => {
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
};

const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const slugifyEmailLocalPart = (text) => {
  const base = (text || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || 'contato';
};

const buildDefaultFromEmail = (orgName, domain = 'seu-dominio.com') => {
  const local = slugifyEmailLocalPart(orgName);
  return `${local}@${domain}`;
};

const readLocalUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const buildDefaultSettingsFromLocalStorage = () => {
  try {
    const parsed = readLocalUser();

    const orgName = parsed?.organization?.name || '';
    const orgId = parsed?.user?.organization_id || '';

    const defaultFromName = orgName || 'Equipe';
    const defaultFromEmail = buildDefaultFromEmail(orgName || 'Equipe', 'seu-dominio.com');

    return {
      language: 'pt-BR',
      country: 'BR',
      niche: 'ecommerce',
      timezone: 'America/Sao_Paulo',
      unsubscribe_message: 'Desinscrição concluída com sucesso!',
      organization: {
        id: orgId,
        name: orgName
      },
      sender: {
        domain: '',
        domain_id: '',
        reply_to: 'naoresponda@seu-dominio.com',
        fromName: defaultFromName,
        fromEmail: defaultFromEmail
      }
    };
  } catch (e) {
    console.log(e);
    return {
      language: 'pt-BR',
      country: 'BR',
      niche: 'ecommerce',
      timezone: 'America/Sao_Paulo',
      unsubscribe_message: 'Desinscrição concluída com sucesso!',
      sender: {
        domain: '',
        domain_id: '',
        reply_to: 'naoresponda@seu-dominio.com',
        fromName: 'Equipe',
        fromEmail: 'equipe@seu-dominio.com'
      }
    };
  }
};

const defaultSettingsObject = buildDefaultSettingsFromLocalStorage();
const prettyJSON = (obj) => JSON.stringify(obj, null, 2);

function ProjectsSkeleton({ rows = 6 }) {
  return (
    <Stack spacing={1}>
      {Array.from({ length: rows }).map((_, i) => (
        <Box
          key={i}
          sx={{
            p: 1.25,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}
        >
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="40%" height={22} />
            <Skeleton variant="text" width="30%" height={18} />
          </Box>
          <Skeleton variant="rounded" width={84} height={26} />
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

/**
 * Dialog de criar/editar projeto
 * - inputs “fáceis”: niche, unsubscribe_message, domain (select VERIFIED), fromName, fromEmail, reply_to
 * - continua existindo textarea do JSON (settings)
 */
function ProjectFormDialog({ open, mode, initialProject, loading, error, verifiedDomains, onClose, onSubmit }) {
  const isEdit = mode === 'edit';

  const [name, setName] = useState('');
  const [settingsText, setSettingsText] = useState(prettyJSON(defaultSettingsObject));
  const [settingsError, setSettingsError] = useState('');

  const [niche, setNiche] = useState('ecommerce');
  const [unsubscribeMessage, setUnsubscribeMessage] = useState('Desinscrição concluída com sucesso!');

  const [domainId, setDomainId] = useState('');
  const [domainError, setDomainError] = useState('');

  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [replyTo, setReplyTo] = useState('naoresponda@seu-dominio.com');

  const [replyToTouched, setReplyToTouched] = useState(false);
  const [fromEmailTouched, setFromEmailTouched] = useState(false);

  const domainsEmpty = (verifiedDomains || []).length === 0;

  const parseSettings = (text) => {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const validateSettings = (text) => {
    if (!text?.trim()) {
      setSettingsError('');
      return true;
    }
    const parsed = parseSettings(text);
    if (!parsed) {
      setSettingsError('JSON inválido');
      return false;
    }
    setSettingsError('');
    return true;
  };

  const updateSettingsText = (updater) => {
    // usa o settingsText atual se válido, senão cai num default
    const base =
      parseSettings(settingsText) || parseSettings(prettyJSON(initialProject?.settings ?? defaultSettingsObject)) || defaultSettingsObject;
    const nextObj = typeof updater === 'function' ? updater(base) : { ...base, ...(updater || {}) };
    setSettingsText(prettyJSON(nextObj));
    setSettingsError('');
  };

  const getSelectedDomain = (id) => (verifiedDomains || []).find((d) => d?.id === id) || null;

  const applyDomainEffects = (nextDomainId) => {
    const domain = getSelectedDomain(nextDomainId);
    const domainName = domain?.domain || '';

    updateSettingsText((prev) => ({
      ...prev,
      sender: {
        ...(prev?.sender || {}),
        domain: domainName,
        domain_id: nextDomainId
      }
    }));

    // reply_to: se ainda está default ou @seu-dominio.com e user não tocou, troca o domínio
    const currentReply = (replyTo || '').trim();
    const isDefaultReply = !currentReply || currentReply === 'naoresponda@seu-dominio.com' || currentReply.endsWith('@seu-dominio.com');

    if (!replyToTouched && domainName && isDefaultReply) {
      const next = `naoresponda@${domainName}`;
      setReplyTo(next);
      updateSettingsText((prev) => ({
        ...prev,
        sender: { ...(prev?.sender || {}), reply_to: next }
      }));
    }

    // fromEmail: se ainda está default ou @seu-dominio.com e user não tocou, troca o domínio
    const currentFrom = (fromEmail || '').trim();
    const isDefaultFrom = !currentFrom || currentFrom.endsWith('@seu-dominio.com');

    if (!fromEmailTouched && domainName && isDefaultFrom) {
      const next = buildDefaultFromEmail(fromName || 'Equipe', domainName);
      setFromEmail(next);
      updateSettingsText((prev) => ({
        ...prev,
        sender: { ...(prev?.sender || {}), fromEmail: next }
      }));
    }
  };

  useEffect(() => {
    if (!open) return;

    const baseSettings = initialProject?.settings ?? defaultSettingsObject;

    setName(initialProject?.name || '');
    setSettingsText(prettyJSON(baseSettings));
    setSettingsError('');

    setNiche(baseSettings?.niche ?? 'ecommerce');
    setUnsubscribeMessage(baseSettings?.unsubscribe_message ?? 'Desinscrição concluída com sucesso!');

    const orgName = baseSettings?.organization?.name || defaultSettingsObject?.organization?.name || '';
    const defaultFromName = baseSettings?.sender?.fromName || defaultSettingsObject?.sender?.fromName || orgName || 'Equipe';
    setFromName(defaultFromName);

    const defaultFromEmail =
      baseSettings?.sender?.fromEmail ||
      defaultSettingsObject?.sender?.fromEmail ||
      buildDefaultFromEmail(defaultFromName || orgName || 'Equipe', 'seu-dominio.com');
    setFromEmail(defaultFromEmail);

    const defaultReply = baseSettings?.sender?.reply_to || defaultSettingsObject?.sender?.reply_to || 'naoresponda@seu-dominio.com';
    setReplyTo(defaultReply);

    setReplyToTouched(false);
    setFromEmailTouched(false);

    const initialDomainId = baseSettings?.sender?.domain_id || '';
    setDomainId(initialDomainId);

    setDomainError(initialDomainId ? '' : 'Selecione um domínio verificado.');
  }, [open, initialProject]);

  // Sincroniza inputs -> settings JSON
  useEffect(() => {
    if (!open) return;
    updateSettingsText((prev) => ({ ...prev, niche: niche || 'ecommerce' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niche, open]);

  useEffect(() => {
    if (!open) return;
    updateSettingsText((prev) => ({
      ...prev,
      unsubscribe_message: unsubscribeMessage || 'Desinscrição concluída com sucesso!'
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsubscribeMessage, open]);

  useEffect(() => {
    if (!open) return;
    updateSettingsText((prev) => ({
      ...prev,
      sender: { ...(prev?.sender || {}), fromName: fromName || 'Equipe' }
    }));

    // se fromEmail ainda é default e user não tocou, atualiza local-part quando fromName mudar
    const domainName = getSelectedDomain(domainId)?.domain || 'seu-dominio.com';
    const currentFrom = (fromEmail || '').trim();
    const isDefaultFrom = !currentFrom || currentFrom.endsWith(`@${domainName}`) || currentFrom.endsWith('@seu-dominio.com');

    if (!fromEmailTouched && isDefaultFrom) {
      const next = buildDefaultFromEmail(fromName || 'Equipe', domainName || 'seu-dominio.com');
      setFromEmail(next);
      updateSettingsText((prev) => ({
        ...prev,
        sender: { ...(prev?.sender || {}), fromEmail: next }
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromName, open]);

  useEffect(() => {
    if (!open) return;
    updateSettingsText((prev) => ({
      ...prev,
      sender: { ...(prev?.sender || {}), fromEmail: fromEmail || buildDefaultFromEmail(fromName || 'Equipe', 'seu-dominio.com') }
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromEmail, open]);

  useEffect(() => {
    if (!open) return;
    updateSettingsText((prev) => ({
      ...prev,
      sender: { ...(prev?.sender || {}), reply_to: replyTo || 'naoresponda@seu-dominio.com' }
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyTo, open]);

  useEffect(() => {
    if (!open) return;

    if (!domainId) {
      setDomainError('Selecione um domínio verificado.');
      updateSettingsText((prev) => ({
        ...prev,
        sender: { ...(prev?.sender || {}), domain: '', domain_id: '' }
      }));
      return;
    }

    setDomainError('');
    applyDomainEffects(domainId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainId, open]);

  const handleSettingsChange = (val) => {
    setSettingsText(val);

    const ok = validateSettings(val);
    if (!ok) return;

    const parsed = parseSettings(val);
    if (!parsed) return;

    setNiche(parsed?.niche ?? 'ecommerce');
    setUnsubscribeMessage(parsed?.unsubscribe_message ?? 'Desinscrição concluída com sucesso!');

    const nextFromName = parsed?.sender?.fromName ?? defaultSettingsObject?.sender?.fromName ?? 'Equipe';
    setFromName(nextFromName);

    const nextFromEmail =
      parsed?.sender?.fromEmail ?? defaultSettingsObject?.sender?.fromEmail ?? buildDefaultFromEmail(nextFromName, 'seu-dominio.com');
    setFromEmail(nextFromEmail);
    setFromEmailTouched(false);

    const nextReply = parsed?.sender?.reply_to ?? 'naoresponda@seu-dominio.com';
    setReplyTo(nextReply);
    setReplyToTouched(false);

    const nextDomainId = parsed?.sender?.domain_id || '';
    setDomainId(nextDomainId);
    setDomainError(nextDomainId ? '' : 'Selecione um domínio verificado.');
  };

  const title = isEdit ? 'Editar projeto' : 'Novo projeto';
  const cta = isEdit ? 'Salvar' : 'Criar';

  const canSubmit = useMemo(() => {
    const okName = name.trim().length >= 2;
    const okSettings = !settingsError;
    const okDomain = Boolean(domainId);
    return okName && okSettings && okDomain && !loading && !domainsEmpty;
  }, [name, settingsError, domainId, loading, domainsEmpty]);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (loading) return;

    const ok = validateSettings(settingsText);
    if (!ok) return;

    if (name.trim().length < 2) return;

    if (!domainId) {
      setDomainError('Selecione um domínio verificado.');
      return;
    }

    const parsed = parseSettings(settingsText) || {};
    const domain = getSelectedDomain(domainId);
    const domainName = domain?.domain || parsed?.sender?.domain || '';

    const normalized = {
      ...parsed,
      niche: niche || parsed?.niche || 'ecommerce',
      unsubscribe_message: unsubscribeMessage || parsed?.unsubscribe_message || 'Desinscrição concluída com sucesso!',
      sender: {
        ...(parsed?.sender || {}),
        domain: domainName,
        domain_id: domainId,
        fromName: fromName || parsed?.sender?.fromName || 'Equipe',
        fromEmail:
          fromEmail ||
          parsed?.sender?.fromEmail ||
          buildDefaultFromEmail(fromName || parsed?.sender?.fromName || 'Equipe', domainName || 'seu-dominio.com'),
        reply_to: replyTo || parsed?.sender?.reply_to || `naoresponda@${domainName || 'seu-dominio.com'}`
      }
    };

    onSubmit({
      name: name.trim(),
      settings: normalized
    });
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="h5">{title}</Typography>
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

          {domainsEmpty ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Você precisa ter pelo menos um domínio <strong>verificado</strong> para criar/editar projetos.
            </Alert>
          ) : null}

          <Stack spacing={2}>
            <TextField
              label="Nome do projeto"
              placeholder="Ex: Black Friday 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              fullWidth
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="Nicho" placeholder="Ex: ecommerce" value={niche} onChange={(e) => setNiche(e.target.value)} fullWidth />

              <TextField
                label="Mensagem de desinscrição"
                placeholder="Ex: Desinscrição concluída com sucesso!"
                value={unsubscribeMessage}
                onChange={(e) => setUnsubscribeMessage(e.target.value)}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                select
                label="Domínio verificado"
                value={domainId}
                onChange={(e) => setDomainId(e.target.value)}
                fullWidth
                error={Boolean(domainError)}
                helperText={domainError || ' '}
              >
                <MenuItem value="" disabled>
                  Selecione um domínio
                </MenuItem>
                {(verifiedDomains || []).map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.domain}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Reply-to"
                placeholder="naoresponda@seu-dominio.com"
                value={replyTo}
                onChange={(e) => {
                  setReplyToTouched(true);
                  setReplyTo(e.target.value);
                }}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="From name" value={fromName} onChange={(e) => setFromName(e.target.value)} fullWidth />

              <TextField
                label="From email"
                value={fromEmail}
                onChange={(e) => {
                  setFromEmailTouched(true);
                  setFromEmail(e.target.value);
                }}
                fullWidth
              />
            </Stack>

            <Divider />

            <Stack direction="row" spacing={1} alignItems="center">
              <DataObjectRoundedIcon fontSize="small" />
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Settings (JSON)
              </Typography>
            </Stack>

            <TextField
              label="settings"
              value={settingsText}
              onChange={(e) => handleSettingsChange(e.target.value)}
              fullWidth
              multiline
              minRows={10}
              maxRows={18}
              error={Boolean(settingsError)}
              helperText={settingsError || ' '}
              inputProps={{
                spellCheck: false,
                style: { fontFamily: monoFont }
              }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} disabled={loading} variant="outlined">
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
            variant="contained"
            color="secondary"
            startIcon={loading ? <CircularProgress size={16} /> : <SaveRoundedIcon fontSize="small" />}
          >
            {cta}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function ProjectDetailsDialog({ open, project, onClose, leads, leadsLoading }) {
  const [tab, setTab] = React.useState(0);

  React.useEffect(() => {
    if (open) setTab(0);
  }, [open]);

  const projectId = project?.id || '-';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          pb: 1.25
        }}
      >
        <Typography variant="h5">Projeto</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0.5 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
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
            <Tab label="Informações do projeto" />
            <Tab label="Templates" />
            <Tab label="Agendamentos" />
            <Tab label="Envios" />
          </Tabs>
        </Box>

        {tab === 0 ? (
          <Stack spacing={1.25}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                p: 2
              }}
            >
              <Box sx={{ flex: 1, maxWidth: '250px' }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Nome
                </Typography>
                <Typography variant="h4" sx={{ lineHeight: 1.2 }}>
                  {project?.name || '-'}
                </Typography>
              </Box>

              <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />

              <Stack direction="row" spacing={2} sx={{ flex: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Criado em
                  </Typography>
                  <Typography variant="body1">{formatDateTime(project?.created_at) || '-'}</Typography>
                </Box>

                <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    INSCRITOS: {leadsLoading ? <CircularProgress size={14} /> : <strong>{leads?.inscribed_leads ?? '0'}</strong>}
                  </Typography>
                  <Typography variant="subtitle2" color="text.secondary">
                    DESINSCRITOS: {leadsLoading ? <CircularProgress size={14} /> : <strong>{leads?.unscribed_leads ?? '0'}</strong>}
                  </Typography>
                </Box>
              </Stack>
            </Stack>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" color="text.secondary">
                ID
              </Typography>
              <Typography variant="body1" sx={{ wordBreak: 'break-all' }} title={projectId}>
                {projectId}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Settings
              </Typography>

              <Box
                sx={{
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  p: 1.5,
                  overflow: 'auto',
                  maxHeight: 360
                }}
              >
                <Typography
                  component="pre"
                  sx={{
                    m: 0,
                    fontSize: 12,
                    lineHeight: 1.6,
                    fontFamily: monoFont,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {prettyJSON(project?.settings ?? {})}
                </Typography>
              </Box>
            </Box>
          </Stack>
        ) : tab === 1 ? (
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
            <Templates projectSelected={project} />
          </Box>
        ) : tab === 2 ? (
          <Box sx={{ p: 3 }}>
            <Schedules projectSelected={project} />
          </Box>
        ) : (
          <Box sx={{ p: 3 }}>
            <Sents projectSelected={project} />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button variant="contained" color="secondary" onClick={onClose}>
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function EmailMarketing() {
  const { emailProjects, isLoading, error, refresh, mutate } = useEmailProjects();
  const { domains } = useDomains();

  const verifiedDomains = useMemo(() => {
    const list = Array.isArray(domains) ? domains : Array.isArray(domains?.items) ? domains.items : [];
    return list.filter((d) => String(d?.status || '').toUpperCase() === 'VERIFIED');
  }, [domains]);

  const [filter, setFilter] = useState('');

  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [projectForWebhook, setProjectForWebhook] = useState(null);

  const [selectedProject, setSelectedProject] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { leads, isLoading: leadsLoading, refresh: refreshLeads } = useCountLeads(selectedProject?.id);

  const [importLeadsOpen, setImportLeadsOpen] = useState(false);
  const [projectForImport, setProjectForImport] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create'); // create | edit
  const [formProject, setFormProject] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const projects = useMemo(() => {
    if (!emailProjects) return [];
    if (Array.isArray(emailProjects)) return emailProjects;
    if (Array.isArray(emailProjects?.items)) return emailProjects.items;
    return [];
  }, [emailProjects]);

  const filteredProjects = useMemo(() => {
    const q = safeLower(filter).trim();
    if (!q) return projects;
    return projects.filter((p) => safeLower(p?.name).includes(q));
  }, [projects, filter]);

  const totalLabel = useMemo(() => {
    const totalFromApi = emailProjects?.total;
    if (typeof totalFromApi === 'number') return `${totalFromApi} no total`;
    return `${projects.length} no total`;
  }, [emailProjects, projects.length]);

  const openDetails = (project) => {
    setSelectedProject(project);
    setDetailsOpen(true);
  };

  const openCreate = () => {
    setActionError('');
    setFormMode('create');
    setFormProject({ name: '', settings: buildDefaultSettingsFromLocalStorage() });
    setFormOpen(true);
  };

  const openEdit = (project) => {
    setActionError('');
    setFormMode('edit');
    setFormProject(project);
    setFormOpen(true);
  };

  const openDelete = (project) => {
    setActionError('');
    setPendingDelete(project);
    setConfirmOpen(true);
  };

  const handleCreateOrUpdate = async ({ name, settings }) => {
    setActionLoading(true);
    setActionError('');
    try {
      if (formMode === 'create') {
        await post('/email/projects', { name, settings });
      } else {
        await patch(`/email/projects/${formProject?.id}`, { name, settings });
      }
      await mutate();
      setFormOpen(false);
    } catch (e) {
      setActionError(getErrorMessage(e, 'Falha ao salvar projeto'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete?.id) return;
    setActionLoading(true);
    setActionError('');
    try {
      await remove(`/email/projects/${pendingDelete.id}`);
      await mutate();

      setConfirmOpen(false);
      setPendingDelete(null);

      if (selectedProject?.id === pendingDelete.id) {
        setDetailsOpen(false);
        setSelectedProject(null);
      }
    } catch (e) {
      setActionError(getErrorMessage(e, 'Falha ao deletar projeto'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (project, nextActive) => {
    if (!project?.id) return;

    setActionLoading(true);
    setActionError('');

    try {
      await patch(`/email/projects/${project.id}`, { active: nextActive });
      await mutate();
    } catch (e) {
      setActionError(getErrorMessage(e, 'Falha ao atualizar status do projeto'));
    } finally {
      setActionLoading(false);
    }
  };

  const openWebhookModal = (project) => {
    setProjectForWebhook(project);
    setWebhookModalOpen(true);
  };

  const closeWebhookModal = () => {
    setWebhookModalOpen(false);
    setProjectForWebhook(null);
  };

  const openImportLeads = (project) => {
    setProjectForImport(project);
    setImportLeadsOpen(true);
  };

  const closeImportLeads = () => {
    setImportLeadsOpen(false);
    setProjectForImport(null);
  };

  const handleImportedLeads = () => {
    refresh();
    refreshLeads();
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <MainCard
        content={false}
        sx={{
          overflow: 'hidden',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          marginBottom: '1rem'
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.75,
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            flexDirection: { xs: 'column', sm: 'row' },
            background: (theme) => `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ lineHeight: 1.2 }}>
              Projetos
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {totalLabel}
            </Typography>
          </Box>

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
              onClick={openCreate}
              variant="contained"
              color="secondary"
              size="small"
              startIcon={<AddRoundedIcon />}
              sx={{ borderRadius: 2 }}
              disabled={actionLoading}
            >
              Novo projeto
            </Button>
            <ExportEmailLeads />
            <ShareLeadsInterProjects />
          </Stack>
        </Box>

        <Divider />

        <Box sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            {error ? <Alert severity="error">{getErrorMessage(error, 'Falha ao carregar projetos.')}</Alert> : null}

            {actionError ? (
              <Alert severity="error" onClose={() => setActionError('')}>
                {actionError}
              </Alert>
            ) : null}

            <TextField
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar por nome do projeto..."
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />

            {isLoading ? (
              <ProjectsSkeleton rows={7} />
            ) : filteredProjects.length === 0 ? (
              <Box
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: '1px dashed',
                  borderColor: 'divider',
                  textAlign: 'center',
                  bgcolor: 'background.paper'
                }}
              >
                <Typography variant="h6" sx={{ mb: 0.5 }}>
                  Nenhum projeto encontrado
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {filter.trim() ? 'Nenhum projeto corresponde ao filtro.' : 'Crie seu primeiro projeto para começar.'}
                </Typography>
                <Button onClick={openCreate} variant="contained" color="secondary" startIcon={<AddRoundedIcon />}>
                  Criar projeto
                </Button>
              </Box>
            ) : (
              <Box
                sx={{
                  maxHeight: 520,
                  overflowY: 'auto',
                  pr: 0.5,
                  '&::-webkit-scrollbar': { width: 8 },
                  '&::-webkit-scrollbar-thumb': {
                    borderRadius: 8,
                    backgroundColor: (theme) => theme.palette.action.hover
                  }
                }}
              >
                <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.9 }}>
                  {filteredProjects.map((p) => (
                    <Box
                      key={p.id}
                      sx={{
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        overflow: 'hidden',
                        transition: 'transform 120ms ease, box-shadow 120ms ease',
                        '&:hover': { transform: 'translateY(-1px)', boxShadow: (theme) => theme.shadows[2] }
                      }}
                    >
                      <ListItemButton onClick={() => openDetails(p)} sx={{ px: 1.5, py: 1.25 }}>
                        <ListItemAvatar sx={{ minWidth: 48 }}>
                          <Avatar
                            sx={{
                              borderRadius: 2,
                              bgcolor: (theme) => theme.palette.action.hover,
                              color: (theme) => theme.palette.secondary.main
                            }}
                          >
                            <WorkspacesRoundedIcon fontSize="small" />
                          </Avatar>
                        </ListItemAvatar>

                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                              <Typography
                                variant="subtitle1"
                                sx={{
                                  fontWeight: 800,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {p.name}
                              </Typography>

                              <Chip
                                size="small"
                                variant="outlined"
                                label={p?.active ? 'Ativo' : 'Inativo'}
                                color={p?.active ? 'secondary' : 'default'}
                                sx={{ borderRadius: 2 }}
                              />
                            </Stack>
                          }
                          secondary={
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25, minWidth: 0 }}>
                              <Typography variant="caption" color="text.secondary">
                                {formatDateTime(p.created_at)}
                              </Typography>
                              {p.id ? (
                                <>
                                  <Typography variant="caption" color="text.secondary">
                                    •
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    title={p.id}
                                  >
                                    {p.id}
                                  </Typography>
                                </>
                              ) : null}
                            </Stack>
                          }
                        />

                        <Stack direction="row" spacing={0.5} sx={{ ml: 1 }} onClick={(e) => e.stopPropagation()} alignItems="center">
                          <Tooltip title={p?.active ? 'Ativo' : 'Inativo'}>
                            <span>
                              <Switch
                                size="small"
                                color="secondary"
                                checked={Boolean(p?.active)}
                                disabled={actionLoading}
                                onChange={(e) => handleToggleActive(p, e.target.checked)}
                              />
                            </span>
                          </Tooltip>

                          <Tooltip title="Editar">
                            <span>
                              <IconButton size="small" onClick={() => openEdit(p)} disabled={actionLoading} sx={{ borderRadius: 2 }}>
                                <EditRoundedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>

                          <Tooltip title="Deletar">
                            <span>
                              <IconButton size="small" onClick={() => openDelete(p)} disabled={actionLoading} sx={{ borderRadius: 2 }}>
                                <DeleteRoundedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </ListItemButton>

                      <Box sx={{ padding: '1rem', display: 'flex', gap: 1 }} onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          startIcon={<ContentCopyRoundedIcon />}
                          onClick={() => openWebhookModal(p)}
                          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}
                        >
                          Copiar formulário de captação
                        </Button>

                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          startIcon={<FileUploadRoundedIcon fontSize="small" />}
                          onClick={() => openImportLeads(p)}
                          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}
                        >
                          Importar Leads
                        </Button>

                        <ExportEmailProjectLeads projectId={p.id} />
                      </Box>
                    </Box>
                  ))}
                </List>
              </Box>
            )}
          </Stack>
        </Box>
      </MainCard>

      <ProjectDetailsDialog
        open={detailsOpen}
        project={selectedProject}
        onClose={() => setDetailsOpen(false)}
        leads={leads}
        leadsLoading={leadsLoading}
      />

      <ProjectFormDialog
        open={formOpen}
        mode={formMode}
        initialProject={formProject}
        loading={actionLoading}
        error={actionError}
        verifiedDomains={verifiedDomains}
        onClose={() => (actionLoading ? null : setFormOpen(false))}
        onSubmit={handleCreateOrUpdate}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Deletar projeto?"
        description={`Tem certeza que deseja deletar o projeto "${pendingDelete?.name || ''}"? Essa ação não pode ser desfeita.`}
        confirmText="Deletar"
        loading={actionLoading}
        onClose={() => (actionLoading ? null : setConfirmOpen(false))}
        onConfirm={handleDelete}
      />

      <WebhookLeadsForm open={webhookModalOpen} onClose={closeWebhookModal} projectSelected={projectForWebhook} />

      <ImportLeads open={importLeadsOpen} onClose={closeImportLeads} projectSelected={projectForImport} onImported={handleImportedLeads} />
    </Box>
  );
}
