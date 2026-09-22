import { useMemo, useState } from 'react';

import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import { IconCopy, IconCheck } from '@tabler/icons-react';

import MainCard from 'ui-component/cards/MainCard';

const safeJsonParse = (text, fallback) => {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

const formatDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso)
    );
  } catch {
    return String(iso);
  }
};

const ROLE_LABEL = { SUPER_ADMIN: 'Super Admin', ADMIN: 'Administrador', OWNER: 'Proprietário', MEMBER: 'Membro' };

// linha label + valor (para a seção "Organização")
function InfoRow({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', textAlign: 'right' }}>
        {value || '—'}
      </Typography>
    </Stack>
  );
}

// identificador técnico (mono + copiar)
function IdRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* noop */
    }
  };
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 130 }}>
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{ flex: 1, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'text.primary', wordBreak: 'break-all' }}
      >
        {value || '—'}
      </Typography>
      {value ? (
        <Tooltip title={copied ? 'Copiado!' : 'Copiar'}>
          <IconButton size="small" onClick={copy} sx={{ color: copied ? 'success.main' : 'text.secondary' }}>
            {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
          </IconButton>
        </Tooltip>
      ) : null}
    </Stack>
  );
}

export default function AccountDataPage() {
  const parsed = useMemo(() => safeJsonParse(localStorage.getItem('user'), null), []);
  const user = parsed?.user || null;
  const org = parsed?.organization || null;

  const name = user?.name || 'Usuário';
  const initial = (name.trim()[0] || 'U').toUpperCase();
  const roleKey = user?.role || '';
  const roleLabel = ROLE_LABEL[roleKey] || roleKey || '—';

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {!user || !org ? (
        <Alert severity="warning" sx={{ borderRadius: 2, mb: 2 }}>
          Não foi possível carregar os dados da conta. Tente sair e entrar novamente.
        </Alert>
      ) : null}

      <MainCard content={false} sx={{ borderRadius: 3 }}>
        {/* Perfil */}
        <Box sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Avatar
              sx={{
                width: 64,
                height: 64,
                fontSize: 26,
                fontWeight: 700,
                color: 'primary.main',
                bgcolor: (t) => alpha(t.palette.primary.main, 0.14)
              }}
            >
              {initial}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {name}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                {user?.email || '—'}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                <Chip size="small" color="primary" label={roleLabel} sx={{ fontWeight: 600 }} />
                <Chip
                  size="small"
                  variant="outlined"
                  color={user?.active === false ? 'default' : 'success'}
                  label={user?.active === false ? 'Inativo' : 'Ativo'}
                  sx={{ fontWeight: 600 }}
                />
              </Stack>
            </Box>
          </Stack>
        </Box>

        <Divider />

        {/* Organização */}
        <Box sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Organização
          </Typography>
          <InfoRow label="Nome" value={org?.name} />
          <Divider />
          <InfoRow label="Status" value={typeof org?.status === 'boolean' ? (org.status ? 'Ativa' : 'Inativa') : org?.status} />
          <Divider />
          <InfoRow label="Criada em" value={org?.created_at ? formatDateTime(org.created_at) : ''} />
        </Box>

        <Divider />

        {/* Identificadores técnicos */}
        <Box sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Identificadores técnicos
          </Typography>
          <Box sx={{ mt: 1 }}>
            <IdRow label="User ID" value={user?.id} />
            <IdRow label="Organization ID" value={user?.organization_id || org?.id} />
            <IdRow label="Document ID" value={org?.document_id} />
            <IdRow label="Stripe Customer ID" value={org?.stripe_customer_id} />
          </Box>
        </Box>
      </MainCard>
    </Box>
  );
}
