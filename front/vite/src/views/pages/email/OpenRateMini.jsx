// src/components/metrics/OpenRateMini.jsx
import { Box, CircularProgress, Stack, Typography } from '@mui/material';

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export default function OpenRateMini({ total = 0, open = 0 }) {
    const safeTotal = Number.isFinite(Number(total)) ? Number(total) : 0;
    const safeOpen = Number.isFinite(Number(open)) ? Number(open) : 0;

    const pctRaw = safeTotal > 0 ? (safeOpen / safeTotal) * 100 : 0;
    const pct = clamp(Math.round(pctRaw), 0, 100);

    return (
        <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ position: 'relative', width: 34, height: 34, flex: '0 0 auto' }}>
                <CircularProgress variant="determinate" value={pct} size={34} thickness={4.5} sx={{ display: 'block' }} />
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <Typography variant="caption" sx={{ fontWeight: 900, fontSize: 11, lineHeight: 1 }}>
                        {pct}%
                    </Typography>
                </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, flex: '1 1 auto' }}>
                <Typography variant="caption" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                    Taxa de Abertura
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                    Total: {open}
                </Typography>
            </Box>
        </Stack>
    );
}
