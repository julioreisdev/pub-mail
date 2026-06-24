import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

export default function ErrorLayout({
    code = 'Erro',
    title = 'Algo deu errado',
    description = 'Tente novamente mais tarde.',
    primaryActionLabel = 'Voltar para o Dashboard',
    onPrimaryAction,
    secondaryActionLabel = 'Ir para Login',
    onSecondaryAction
}) {
    return (
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
            <Box sx={{ width: '100%', maxWidth: 520 }}>
                <Stack spacing={2} alignItems="flex-start">
                    <Typography variant="h2" sx={{ lineHeight: 1 }}>
                        {code}
                    </Typography>

                    <Typography variant="h4">{title}</Typography>

                    <Typography variant="body1" color="text.secondary">
                        {description}
                    </Typography>

                    <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
                        {onPrimaryAction ? (
                            <Button variant="contained" color="secondary" onClick={onPrimaryAction}>
                                {primaryActionLabel}
                            </Button>
                        ) : null}

                        {onSecondaryAction ? (
                            <Button variant="outlined" onClick={onSecondaryAction}>
                                {secondaryActionLabel}
                            </Button>
                        ) : null}
                    </Stack>
                </Stack>
            </Box>
        </Box>
    );
}
