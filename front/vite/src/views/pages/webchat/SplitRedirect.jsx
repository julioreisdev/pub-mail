import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

import { get } from 'api/api';

// Sorteio ponderado (pesos relativos).
function weightedPick(members) {
  const list = (Array.isArray(members) ? members : []).filter((m) => m && m.domain && m.slug);
  if (list.length === 0) return null;
  const total = list.reduce((sum, m) => sum + Math.max(0, Number(m.weight) || 0), 0);
  if (total <= 0) return list[Math.floor(Math.random() * list.length)];
  let r = Math.random() * total;
  for (const m of list) {
    r -= Math.max(0, Number(m.weight) || 0);
    if (r < 0) return m;
  }
  return list[list.length - 1];
}

export default function SplitRedirect() {
  const { slug = '' } = useParams();
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await get(`/public/webchat-splits/${encodeURIComponent(slug)}`);
        const members = Array.isArray(data?.members) ? data.members : [];
        const chosen = weightedPick(members);
        if (!chosen) {
          if (alive) setError('Nenhum webchat ativo neste split.');
          return;
        }
        const domain = String(chosen.domain).toLowerCase();
        const target = `https://${domain}/webchat/${encodeURIComponent(chosen.slug)}?nsr=1`;
        window.location.replace(target);
      } catch (e) {
        if (alive) setError('Split não encontrado.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3 }}>
      {error ? (
        <Typography variant="body1" color="text.secondary" align="center">
          {error}
        </Typography>
      ) : (
        <CircularProgress />
      )}
    </Box>
  );
}
