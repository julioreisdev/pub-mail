import { useCallback, useEffect, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';

import { RefreshRoundedIcon as RefreshRoundedIcon } from 'ui-component/icons';
import { SearchRoundedIcon as SearchRoundedIcon } from 'ui-component/icons';
import { RouteRoundedIcon as RouteRoundedIcon } from 'ui-component/icons';
import { TuneRoundedIcon as TuneRoundedIcon } from 'ui-component/icons';
import { MailOutlineRoundedIcon as MailOutlineRoundedIcon } from 'ui-component/icons';

import MainCard from 'ui-component/cards/MainCard';
import { get } from 'api/api';
import useEmailProjects from '../../../hooks/useEmailProjects';
import InitialFlowConfig from './InitialFlowConfig';
import RecycleTab from './RecycleTab';
import TriggersTab from './TriggersTab';

const getErr = (e, f) => e?.response?.data?.message || e?.message || f;
const toList = (v) => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : []);

export default function Automations() {
  const [tab, setTab] = useState(0);
  const { emailProjects, isLoading: loadingProjects, refresh: refreshProjects } = useEmailProjects();
  const [flows, setFlows] = useState([]);
  const [loadingFlows, setLoadingFlows] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [configProject, setConfigProject] = useState(null);

  const loadFlows = useCallback(async () => {
    setLoadingFlows(true);
    try {
      const data = await get('/email/flows');
      setFlows(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(getErr(e, 'Falha ao carregar automações.'));
    } finally {
      setLoadingFlows(false);
    }
  }, []);

  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  const flowByProject = useMemo(() => {
    const map = {};
    flows.forEach((f) => (map[f.project_id] = f));
    return map;
  }, [flows]);

  const projects = useMemo(() => {
    const list = toList(emailProjects);
    const q = filter.trim().toLowerCase();
    return q ? list.filter((p) => String(p.name || '').toLowerCase().includes(q)) : list;
  }, [emailProjects, filter]);

  const loading = loadingProjects || loadingFlows;

  return (
    <MainCard content={false} sx={{ overflow: 'hidden', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      {/* Header */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <RouteRoundedIcon color="secondary" />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>Automações</Typography>
            <Typography variant="body2" color="text.secondary">
              Automatize a jornada dos seus leads.
            </Typography>
          </Box>
        </Stack>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 1.5, '& .MuiTab-root': { textTransform: 'none', fontWeight: 800 } }}>
          <Tab label="Fluxo Inicial" />
          <Tab label="Reciclagem" />
          <Tab label="Gatilhos" />
        </Tabs>
      </Box>
      <Divider />

      {/* Fluxo Inicial */}
      {tab === 0 ? (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>Fluxo Inicial por projeto</Typography>
              <Typography variant="body2" color="text.secondary">
                Uma sequência de e-mails disparada automaticamente assim que o lead é captado no projeto.
              </Typography>
            </Box>
            <Tooltip title="Atualizar">
              <span>
                <IconButton onClick={() => { refreshProjects(); loadFlows(); }} disabled={loading} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <RefreshRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {error ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert> : null}

          <TextField
            fullWidth
            size="small"
            placeholder="Filtrar projetos por nome…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
          />

          {loading ? (
            <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={72} />)}</Stack>
          ) : projects.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
              <Typography variant="h6">Nenhum projeto de e-mail</Typography>
              <Typography variant="body2" color="text.secondary">Crie um projeto em Email Marketing para configurar um fluxo.</Typography>
            </Box>
          ) : (
            <Stack spacing={1.25}>
              {projects.map((p) => {
                const flow = flowByProject[p.id];
                const active = flow?.active;
                const steps = flow?.steps_count || 0;
                return (
                  <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: active ? 'secondary.main' : 'divider', bgcolor: 'background.paper' }}>
                    <Box sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: active ? 'secondary.main' : 'action.hover', color: active ? '#fff' : 'text.secondary', flexShrink: 0 }}>
                      <MailOutlineRoundedIcon fontSize="small" />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 900 }} noWrap>{p.name}</Typography>
                      <Stack direction="row" spacing={0.75} sx={{ mt: 0.25 }}>
                        <Chip size="small" label={active ? 'Ativo' : (steps > 0 ? 'Pausado' : 'Sem fluxo')} color={active ? 'secondary' : 'default'} variant={active ? 'filled' : 'outlined'} sx={{ borderRadius: 1.5, fontWeight: 800, height: 22 }} />
                        {steps > 0 ? <Chip size="small" variant="outlined" label={`${steps} e-mail${steps === 1 ? '' : 's'}`} sx={{ borderRadius: 1.5, height: 22 }} /> : null}
                      </Stack>
                    </Box>
                    <Button variant="contained" color="secondary" startIcon={<TuneRoundedIcon fontSize="small" />} onClick={() => setConfigProject(p)} sx={{ borderRadius: 2, fontWeight: 800, flexShrink: 0 }}>
                      Configurar fluxo
                    </Button>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      ) : null}

      {/* Reciclagem */}
      {tab === 1 ? (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <RecycleTab />
        </Box>
      ) : null}

      {/* Gatilhos */}
      {tab === 2 ? (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <TriggersTab />
        </Box>
      ) : null}

      <InitialFlowConfig
        open={Boolean(configProject)}
        project={configProject}
        onClose={() => setConfigProject(null)}
        onSaved={() => loadFlows()}
      />
    </MainCard>
  );
}
