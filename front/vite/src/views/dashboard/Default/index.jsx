import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

import {
  IconMailBolt,
  IconRobot,
  IconBrandHipchat,
  IconListLetters,
  IconSparkles,
  IconArrowUpRight
} from '@tabler/icons-react';

import { get } from '../../../api/api';
import { useAuth } from 'contexts/AuthContext';
import Leads from '../../pages/webchat/Leads';

// tint theme-aware (troca no dark) via canal CSS var
const tint = (color, a) => (theme) => `rgba(${theme.vars.palette[color].mainChannel} / ${a})`;

// ---- card de estatística ----
function StatCard({ icon: Icon, color, value, label, hint, onClick, loading }) {
  return (
    <Box
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => onClick && (e.key === 'Enter' || e.key === ' ') && onClick()}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
        '&:hover': onClick && {
          transform: 'translateY(-3px)',
          boxShadow: '0 12px 28px rgb(16 24 40 / 12%)',
          borderColor: tint(color, 0.5),
          '& .stat-arrow': { opacity: 1, transform: 'translate(0,0)' }
        }
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            color: `${color}.main`,
            bgcolor: tint(color, 0.14)
          }}
        >
          <Icon size={24} stroke={1.7} />
        </Box>
        {onClick && (
          <Box
            className="stat-arrow"
            sx={{ color: 'text.secondary', opacity: 0, transform: 'translate(-4px,4px)', transition: 'opacity .18s ease, transform .18s ease' }}
          >
            <IconArrowUpRight size={18} stroke={1.8} />
          </Box>
        )}
      </Stack>

      {loading ? (
        <Skeleton variant="text" width={64} height={44} />
      ) : (
        <Typography sx={{ fontWeight: 700, fontSize: 34, lineHeight: 1.1, letterSpacing: '-0.02em', color: 'text.primary' }}>
          {value}
        </Typography>
      )}
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25, fontWeight: 500 }}>
        {label}
      </Typography>
      {hint && !loading ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

// ---- card de integrações de IA ----
function IntegrationsCard({ data, loading, onClick }) {
  const providers = data?.ai_integrations?.providers || [];
  const connected = data?.ai_integrations?.connected ?? 0;
  const total = data?.ai_integrations?.total ?? 0;

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        cursor: 'pointer',
        transition: 'border-color .18s ease, box-shadow .18s ease',
        height: '100%',
        '&:hover': { borderColor: tint('primary', 0.5), boxShadow: '0 12px 28px rgb(16 24 40 / 10%)' }
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: 2.5, display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: tint('primary', 0.14) }}>
          <IconSparkles size={24} stroke={1.7} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>Integrações de IA</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {loading ? 'Carregando…' : `${connected} de ${total} conectada${connected === 1 ? '' : 's'}`}
          </Typography>
        </Box>
      </Stack>

      {loading ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" width={92} height={30} sx={{ borderRadius: 5 }} />
          ))}
        </Stack>
      ) : (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {providers.map((p) => {
            const on = p.count > 0;
            return (
              <Tooltip key={p.key} title={on ? `${p.count} chave${p.count === 1 ? '' : 's'} cadastrada${p.count === 1 ? '' : 's'}` : 'Sem chave'}>
                <Chip
                  size="small"
                  label={on ? `${p.label} · ${p.count}` : p.label}
                  variant={on ? 'filled' : 'outlined'}
                  color={on ? 'primary' : 'default'}
                  sx={{ fontWeight: 600, opacity: on ? 1 : 0.6 }}
                />
              </Tooltip>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = useMemo(() => {
    const name = user?.user?.name || '';
    return name.split(' ')[0] || '';
  }, [user]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await get('/dashboard/overview');
        if (alive) setData(res);
      } catch {
        if (alive) setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const c = data?.counts || {};

  const cards = [
    {
      icon: IconMailBolt,
      color: 'primary',
      value: c.email_projects ?? 0,
      label: 'Projetos de e-mail',
      hint: `${c.leads ?? 0} leads na base`,
      onClick: () => navigate('/email/email-marketing')
    },
    { icon: IconRobot, color: 'secondary', value: c.agents ?? 0, label: 'Agentes de IA', onClick: () => navigate('/webchat/agentes') },
    { icon: IconBrandHipchat, color: 'success', value: c.webchats ?? 0, label: 'Webchats', onClick: () => navigate('/webchat/webchats') },
    { icon: IconListLetters, color: 'orange', value: c.quizzes ?? 0, label: 'Quizzes', onClick: () => navigate('/quizzes') }
  ];

  return (
    <Box sx={{ p: { xs: 0.5, md: 1 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: 24, md: 30 }, letterSpacing: '-0.02em', color: 'text.primary' }}>
          Olá{firstName ? `, ${firstName}` : ''}! 👋
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Bem-vindo(a) de volta. Aqui está um resumo da sua conta.
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        {cards.map((card) => (
          <StatCard key={card.label} {...card} loading={loading} />
        ))}
      </Box>

      <Box sx={{ mt: 2 }}>
        <IntegrationsCard data={data} loading={loading} onClick={() => navigate('/settings/integrations')} />
      </Box>

      {/* leads (visão geral, com seletor de origem) */}
      <Box sx={{ mt: 3 }}>
        <Leads embedded />
      </Box>
    </Box>
  );
}
