import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { AddRoundedIcon as AddRoundedIcon } from 'ui-component/icons';
import { DeleteRoundedIcon as DeleteRoundedIcon } from 'ui-component/icons';
import { EditRoundedIcon as EditRoundedIcon } from 'ui-component/icons';
import { RefreshRoundedIcon as RefreshRoundedIcon } from 'ui-component/icons';

import MainCard from 'ui-component/cards/MainCard';
import useAgentes from '../../../hooks/useAgentes';
import { patch, post, remove } from '../../../api/api';

const getErrorMessage = (err, fallback = 'Ocorreu um erro') =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
const DEFAULT_AGENT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_AGENT_TEMPERATURE = 0.7;
const DEFAULT_AGENT_MAX_TOKENS = 500;

function AgentsSkeleton({ rows = 4 }) {
  return (
    <Stack spacing={1.25}>
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
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="36%" height={26} />
              <Skeleton variant="text" width="60%" />
            </Box>
            <Skeleton variant="rounded" width={120} height={28} />
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function ConfirmDialog({ open, loading, title, description, onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading} variant="outlined" sx={{ borderRadius: 2 }}>
          Cancelar
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          color="error"
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} /> : <DeleteRoundedIcon fontSize="small" />}
          sx={{ borderRadius: 2, fontWeight: 900 }}
        >
          Excluir
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AgentFormDialog({ open, mode, initialData, loading, error, onClose, onSubmit }) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [promptMestre, setPromptMestre] = useState('');
  const [active, setActive] = useState(true);
  const [captarTelefone, setCaptarTelefone] = useState(false);
  const [captarEmail, setCaptarEmail] = useState(false);

  useEffect(() => {
    if (!open) return;
    const cfg = initialData?.ia_config || {};
    setName(initialData?.name || '');
    setDescription(initialData?.description || '');
    setPromptMestre(cfg?.prompt_mestre || '');
    setActive(initialData?.active ?? true);
    // Toggles: default OFF em criação. Em edição, lê do ia_config; se ausente
    // (agente legado pré-toggles), assume true pra refletir o comportamento
    // efetivo atual (captura nome+telefone+email rígido).
    if (isEdit) {
      setCaptarTelefone(typeof cfg.captar_telefone === 'boolean' ? cfg.captar_telefone : true);
      setCaptarEmail(typeof cfg.captar_email === 'boolean' ? cfg.captar_email : true);
    } else {
      setCaptarTelefone(false);
      setCaptarEmail(false);
    }
  }, [open, initialData, isEdit]);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!name.trim()) return false;
    if (!promptMestre.trim()) return false;
    return true;
  }, [loading, name, promptMestre]);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    const currentIaConfig =
      initialData?.ia_config && typeof initialData.ia_config === 'object' && !Array.isArray(initialData.ia_config)
        ? initialData.ia_config
        : {};

    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      active: Boolean(active),
      ia_config: {
        ...currentIaConfig,
        prompt_mestre: promptMestre.trim(),
        modelo: currentIaConfig.modelo || DEFAULT_AGENT_MODEL,
        temperatura: Number(currentIaConfig.temperatura ?? DEFAULT_AGENT_TEMPERATURE),
        max_tokens: Number(currentIaConfig.max_tokens ?? DEFAULT_AGENT_MAX_TOKENS),
        captar_telefone: Boolean(captarTelefone),
        captar_email: Boolean(captarEmail)
      }
    });
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{isEdit ? 'Editar agente' : 'Novo agente'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 1.5 }}>
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            <TextField
              label="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              autoFocus
              required
            />

            <TextField label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />

            <TextField
              label="Prompt mestre"
              value={promptMestre}
              onChange={(e) => setPromptMestre(e.target.value)}
              fullWidth
              multiline
              minRows={4}
              required
            />

            <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.5, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                Captação de lead
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Defina quais dados o chat vai pedir antes de ajudar. O nome só é solicitado quando ao menos uma das opções abaixo está ativa. Com as duas desligadas, o chat parte direto pra ajudar com o tema, sem pedir nada.
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Switch
                  checked={captarTelefone}
                  onChange={(e) => setCaptarTelefone(e.target.checked)}
                  color="secondary"
                />
                <Typography variant="body2">Captar Telefone</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Switch
                  checked={captarEmail}
                  onChange={(e) => setCaptarEmail(e.target.checked)}
                  color="secondary"
                />
                <Typography variant="body2">Captar E-mail</Typography>
              </Stack>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Switch checked={active} onChange={(e) => setActive(e.target.checked)} color="secondary" />
              <Typography variant="body2" color="text.secondary">
                Agente ativo
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} disabled={loading} variant="outlined" sx={{ borderRadius: 2 }}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
            variant="contained"
            color="secondary"
            startIcon={loading ? <CircularProgress size={16} /> : null}
            sx={{ borderRadius: 2, fontWeight: 900 }}
          >
            {isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export default function Agentes() {
  const { agentes, isLoading, error, mutate, refresh } = useAgentes();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formData, setFormData] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const list = useMemo(() => (Array.isArray(agentes) ? agentes : []), [agentes]);

  const handleOpenCreate = () => {
    setActionError('');
    setFormMode('create');
    setFormData(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (agent) => {
    setActionError('');
    setFormMode('edit');
    setFormData(agent);
    setFormOpen(true);
  };

  const handleSubmit = async (payload) => {
    setActionLoading(true);
    setActionError('');
    try {
      if (formMode === 'create') {
        await post('/agentes', payload);
      } else {
        await patch(`/agentes/${formData?.id}`, payload);
      }
      await mutate();
      setFormOpen(false);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Falha ao salvar agente.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete?.id) return;
    setActionLoading(true);
    setActionError('');
    try {
      await remove(`/agentes/${pendingDelete.id}`);
      await mutate();
      setConfirmOpen(false);
      setPendingDelete(null);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Falha ao excluir agente.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (agent, nextActive) => {
    if (!agent?.id) return;
    setActionLoading(true);
    setActionError('');
    try {
      await patch(`/agentes/${agent.id}`, { active: nextActive });
      await mutate();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Falha ao atualizar status do agente.'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <MainCard
        content={false}
        sx={{
          overflow: 'hidden',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider'
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
            flexDirection: { xs: 'column', sm: 'row' }
          }}
        >
          <Box>
            <Typography variant="h4">Agentes IA</Typography>
            <Typography variant="body2" color="text.secondary">
              {list.length} no total
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Atualizar">
              <span>
                <IconButton
                  onClick={refresh}
                  disabled={isLoading || actionLoading}
                  size="small"
                  sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
                >
                  <RefreshRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              onClick={handleOpenCreate}
              variant="contained"
              color="secondary"
              startIcon={<AddRoundedIcon />}
              sx={{ borderRadius: 2, fontWeight: 900 }}
              disabled={actionLoading}
            >
              Novo agente
            </Button>
          </Stack>
        </Box>

        <Divider />

        <Box sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            {error ? <Alert severity="error">{getErrorMessage(error, 'Falha ao carregar agentes.')}</Alert> : null}
            {actionError ? (
              <Alert severity="error" onClose={() => setActionError('')}>
                {actionError}
              </Alert>
            ) : null}

            {isLoading ? (
              <AgentsSkeleton />
            ) : list.length === 0 ? (
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
                  Nenhum agente cadastrado
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Crie seu primeiro agente para vincular aos webchats.
                </Typography>
                <Button onClick={handleOpenCreate} variant="contained" color="secondary" startIcon={<AddRoundedIcon />}>
                  Criar agente
                </Button>
              </Box>
            ) : (
              <Stack spacing={1}>
                {list.map((agent) => (
                  <Box
                    key={agent.id}
                    sx={{
                      borderRadius: 2.5,
                      border: '1px solid',
                      borderColor: agent.active ? 'secondary.200' : 'divider',
                      bgcolor: 'background.paper',
                      p: 1.5
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 900 }} noWrap title={agent.name}>
                            {agent.name}
                          </Typography>
                          <Chip
                            size="small"
                            label={agent.active ? 'Ativo' : 'Inativo'}
                            color={agent.active ? 'secondary' : 'default'}
                            variant={agent.active ? 'filled' : 'outlined'}
                            sx={{ borderRadius: 2, fontWeight: 800 }}
                          />
                        </Stack>
                        {agent.description ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }} noWrap title={agent.description}>
                            {agent.description}
                          </Typography>
                        ) : null}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Prompt: {String(agent?.ia_config?.prompt_mestre || '').slice(0, 120) || 'Não definido'}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Tooltip title={agent.active ? 'Ativo' : 'Inativo'}>
                          <span>
                            <Switch
                              size="small"
                              color="secondary"
                              checked={Boolean(agent.active)}
                              disabled={actionLoading}
                              onChange={(e) => handleToggleActive(agent, e.target.checked)}
                            />
                          </span>
                        </Tooltip>

                        <Tooltip title="Editar">
                          <span>
                            <IconButton size="small" onClick={() => handleOpenEdit(agent)} disabled={actionLoading} sx={{ borderRadius: 2 }}>
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title="Excluir">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setPendingDelete(agent);
                                setConfirmOpen(true);
                              }}
                              disabled={actionLoading}
                              sx={{ borderRadius: 2 }}
                            >
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
      </MainCard>

      <AgentFormDialog
        open={formOpen}
        mode={formMode}
        initialData={formData}
        loading={actionLoading}
        error={actionError}
        onClose={() => (actionLoading ? null : setFormOpen(false))}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={confirmOpen}
        loading={actionLoading}
        title="Excluir agente?"
        description={`Tem certeza que deseja excluir o agente "${pendingDelete?.name || ''}"?`}
        onClose={() => (actionLoading ? null : setConfirmOpen(false))}
        onConfirm={handleDelete}
      />
    </Box>
  );
}
