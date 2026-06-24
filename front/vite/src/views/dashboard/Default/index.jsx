import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export default function Dashboard() {
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 200);
    return () => clearTimeout(t);
  }, []);

  const userPayload = useMemo(() => safeJsonParse(localStorage.getItem('user'), null), []);
  const userName = userPayload?.user?.name || '';

  if (isLoading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center', p: { xs: 2, md: 3 } }}>
      <Typography
        variant="h1"
        sx={{
          fontWeight: 900,
          fontSize: { xs: 28, md: 40 },
          letterSpacing: -0.4,
          textAlign: 'center'
        }}
      >
        Olá{userName ? `, ${userName}` : ''}!
      </Typography>
    </Box>
  );
}
