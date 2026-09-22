import PropTypes from 'prop-types';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { IconBrandTelegram } from '@tabler/icons-react';

// ==============================|| TELEGRAM — PÁGINA PLACEHOLDER (em construção) ||============================== //

export default function TelegramPlaceholder({ title, description, Icon = IconBrandTelegram }) {
    return (
        <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '70vh', px: 2 }}>
            <Stack spacing={2.5} alignItems="center" sx={{ maxWidth: 460, textAlign: 'center' }}>
                <Box
                    sx={{
                        width: 84,
                        height: 84,
                        borderRadius: '28px',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fff',
                        background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)',
                        boxShadow: (t) => `0 12px 30px ${alpha('#229ED9', t.palette.mode === 'dark' ? 0.35 : 0.28)}`
                    }}
                >
                    <Icon size={40} stroke={1.8} />
                </Box>

                <Stack spacing={1} alignItems="center">
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>
                        {title}
                    </Typography>
                    {description ? (
                        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                            {description}
                        </Typography>
                    ) : null}
                </Stack>

                <Chip
                    label="Em construção"
                    size="small"
                    sx={{
                        fontWeight: 700,
                        borderRadius: 1.5,
                        color: 'primary.main',
                        bgcolor: (t) => alpha(t.palette.primary.main, 0.12)
                    }}
                />
            </Stack>
        </Box>
    );
}

TelegramPlaceholder.propTypes = {
    title: PropTypes.string,
    description: PropTypes.string,
    Icon: PropTypes.elementType
};
