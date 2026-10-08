import { Box, Stack, Typography } from '@mui/material';

import { WA_DARK } from '../waKit';

// Título de seção da página de Status (selo verde + título + legenda + extra à direita)
// `stackAction`: no celular a ação desce para a linha de baixo, em largura total.
export default function SectionTitle({ icon: Icon, title, caption, extra, action, stackAction, sx }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{
        minWidth: 0,
        columnGap: 1.25,
        rowGap: 1,
        flexWrap: stackAction ? { xs: 'wrap', sm: 'nowrap' } : 'nowrap',
        ...sx
      }}
    >
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
          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.25, minWidth: 0, overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
          {extra || null}
        </Stack>
        {caption ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.35, overflowWrap: 'anywhere' }}>
            {caption}
          </Typography>
        ) : null}
      </Box>
      {action ? (
        <Box sx={{ flexShrink: 0, minWidth: 0, ...(stackAction ? { width: { xs: '100%', sm: 'auto' } } : {}) }}>{action}</Box>
      ) : null}
    </Stack>
  );
}
