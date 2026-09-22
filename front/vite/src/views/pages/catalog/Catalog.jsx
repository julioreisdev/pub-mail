// src/views/pages/catalog/Catalog.jsx
import { useMemo, useState } from 'react';
import {
    Box,
    Stack,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Card,
    CardContent,
    Chip,
    Divider,
    TextField,
    InputAdornment
} from '@mui/material';
import { SearchIcon as SearchIcon } from 'ui-component/icons';

import MainCard from 'ui-component/cards/MainCard';

function TokenPill({ value }) {
    return (
        <Box
            sx={{
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 0.75,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider'
            }}
        >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Tokens
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                {value}
            </Typography>
        </Box>
    );
}

function ServiceCard({ item }) {
    return (
        <Card
            variant="outlined"
            sx={{
                height: '100%',
                borderRadius: 3,
                transition: 'transform .12s ease, box-shadow .12s ease',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 2
                }
            }}
        >
            <CardContent sx={{ p: 2.5 }}>
                <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Chip
                            size="small"
                            label={item.category}
                            sx={{
                                borderRadius: 2,
                                fontWeight: 700
                            }}
                            variant="filled"
                        />
                        <TokenPill value={item.value} />
                    </Stack>

                    <Box>
                        <Typography variant="h4" sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>
                            {item.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                            {item.description}
                        </Typography>
                    </Box>

                    <Divider sx={{ my: 0.25 }} />

                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Cobrança por unidade
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            {item.value} tokens
                        </Typography>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

export default function Catalog() {
    const list = [
        { category: 'E-mail Marketing', name: 'Envio de e-mail', description: 'Tokens cobrados por 1 envio', value: 100 },
        {
            category: 'E-mail Marketing',
            name: 'Geração de template de e-mail',
            description: 'Tokens cobrados por 1 template gerado com I.A',
            value: 1500
        },
        {
            category: 'Webchats',
            name: 'Resposta de webchat',
            description: 'Tokens cobrados por 1 resposta gerada com I.A',
            value: 1000
        },
        {
            category: 'Posts',
            name: 'Armazenamento',
            description: 'Tokens cobrados a cada MB armazenado',
            value: 1
        }
    ];

    const categories = useMemo(() => {
        const unique = Array.from(new Set(list.map((i) => i.category))).sort((a, b) => a.localeCompare(b));
        return ['Todas', ...unique];
    }, [list]);

    const [category, setCategory] = useState('Todas');
    const [q, setQ] = useState('');

    const filtered = useMemo(() => {
        const query = q.trim().toLowerCase();
        return list
            .filter((i) => (category === 'Todas' ? true : i.category === category))
            .filter((i) => {
                if (!query) return true;
                return (
                    i.name.toLowerCase().includes(query) || i.description.toLowerCase().includes(query) || i.category.toLowerCase().includes(query)
                );
            });
    }, [list, category, q]);

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <MainCard
                content={false}
                sx={{
                    overflow: 'hidden',
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    mb: 2
                }}
            >
                {/* Header */}
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack spacing={2}>
                        <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={2}
                            alignItems={{ xs: 'stretch', md: 'center' }}
                            justifyContent="space-between"
                        >
                            <Box>
                                <Typography variant="h3" sx={{ fontWeight: 900 }}>
                                    Catálogo de Serviços
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                                    Veja os serviços disponíveis e os tokens cobrados por unidade.
                                </Typography>
                            </Box>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="stretch">
                                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
                                    <InputLabel id="category-label">Categoria</InputLabel>
                                    <Select labelId="category-label" value={category} label="Categoria" onChange={(e) => setCategory(e.target.value)}>
                                        {categories.map((c) => (
                                            <MenuItem key={c} value={c}>
                                                {c}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <TextField
                                    size="small"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Buscar serviço..."
                                    sx={{ minWidth: { xs: '100%', sm: 260 } }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon fontSize="small" />
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Stack>
                        </Stack>

                        <Divider />

                        {/* Summary */}
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip size="small" label={`${filtered.length} serviço(s)`} variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }} />
                            {category !== 'Todas' && <Chip size="small" label={`Categoria: ${category}`} sx={{ borderRadius: 2, fontWeight: 700 }} />}
                            {q.trim() && <Chip size="small" label={`Busca: "${q.trim()}"`} sx={{ borderRadius: 2, fontWeight: 700 }} />}
                        </Stack>
                    </Stack>
                </Box>

                {/* List */}
                <Box sx={{ px: { xs: 2, md: 3 }, pb: { xs: 2, md: 3 } }}>
                    {filtered.length === 0 ? (
                        <Box
                            sx={{
                                p: 3,
                                borderRadius: 3,
                                border: '1px dashed',
                                borderColor: 'divider',
                                bgcolor: 'background.default'
                            }}
                        >
                            <Typography variant="h5" sx={{ fontWeight: 800 }}>
                                Nada encontrado
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                                Tente trocar a categoria ou ajustar a busca.
                            </Typography>
                        </Box>
                    ) : (
                        <Grid container spacing={2}>
                            {filtered.map((item, idx) => (
                                <Grid item xs={12} sm={6} lg={4} key={`${item.category}-${item.name}-${idx}`}>
                                    <ServiceCard item={item} />
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </Box>
            </MainCard>
        </Box>
    );
}
