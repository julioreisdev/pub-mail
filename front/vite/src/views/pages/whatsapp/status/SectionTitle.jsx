import { Box, Stack, Typography } from '@mui/material';

import { WA_DARK } from '../waKit';

// Título de seção da página de Status (selo verde + título + legenda + extra à direita)
export default function SectionTitle({ icon: Icon, title, caption, extra, action, sx }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, ...sx }}>
      {Icon ? (
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2.5,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            color: WA_DARK,
            bgcolor: 'rgba(37,211,102,.14)'
          }}
        >
          <Icon size={20} stroke={1.8} />
        </Box>
      ) : null}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0, columnGap: 1, rowGap: 0.25 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.25 }} noWrap>
            {title}
          </Typography>
          {extra || null}
        </Stack>
        {caption ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.35 }}>
            {caption}
          </Typography>
        ) : null}
      </Box>
      {action || null}
    </Stack>
  );
}
