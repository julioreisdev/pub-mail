import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';

import MainCard from 'ui-component/cards/MainCard';
import useEmailProjects from '../../../hooks/useEmailProjects';
import InitialFlowConfig from './InitialFlowConfig';

const toList = (v) => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : []);

// Fluxo Inicial: seleciona o projeto → configura o fluxo (inline). Antes listava
// todos os projetos; agora é focado num projeto por vez.
export default function FlowsPage() {
  const { emailProjects, refresh } = useEmailProjects();
  const projects = useMemo(() => toList(emailProjects), [emailProjects]);
  const [projectId, setProjectId] = useState('');
  const selected = projects.find((p) => p.id === projectId) || null;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <MainCard content={false} sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Fluxo Inicial</Typography>
            <Typography variant="body2" color="text.secondary">
              Uma sequência de e-mails disparada automaticamente quando o lead é captado no projeto.
            </Typography>
          </Box>
          <TextField
            select
            size="small"
            label="Projeto"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            sx={{ minWidth: 260 }}
          >
            <MenuItem value="">Selecione um projeto…</MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {selected ? (
          <Box sx={{ mt: 1, borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
            <InitialFlowConfig key={selected.id} inline open project={selected} onSaved={refresh} />
          </Box>
        ) : (
          <Box sx={{ mt: 2, py: 7, textAlign: 'center', color: 'text.secondary', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="body2">Selecione um projeto acima para configurar o fluxo inicial.</Typography>
          </Box>
        )}
      </MainCard>
    </Box>
  );
}
