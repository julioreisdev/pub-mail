// src/views/billing/components/TransactionsListCard.jsx
import { useMemo } from 'react';

// MUI
import {
    Box,
    Card,
    CardContent,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Skeleton,
    Stack,
    Tooltip,
    Typography,
    Chip,
    Avatar
} from '@mui/material';

// Icons
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import NorthEastRoundedIcon from '@mui/icons-material/NorthEastRounded';
import SouthWestRoundedIcon from '@mui/icons-material/SouthWestRounded';
import useTransactions from '../../../hooks/useTransactions';

// Helpers
const formatDateTime = (iso) => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(d);
    } catch (e) {
        console.log('Erro ao formatar data:', e);
        return iso;
    }
};

const getTypeMeta = (type) => {
    // Ajuste se você tiver mais tipos além de TOPUP
    switch (type) {
        case 'TOPUP':
            return {
                label: 'Topup',
                color: 'success',
                icon: <NorthEastRoundedIcon fontSize="small" />
            };
        case 'CHARGE':
        case 'DEBIT':
            return {
                label: 'Débito',
                color: 'error',
                icon: <SouthWestRoundedIcon fontSize="small" />
            };
        default:
            return {
                label: type || 'Transação',
                color: 'default',
                icon: <ReceiptLongRoundedIcon fontSize="small" />
            };
    }
};

function TransactionsSkeleton({ rows = 6 }) {
    return (
        <Stack spacing={1.25}>
            {Array.from({ length: rows }).map((_, i) => (
                <Box
                    key={i}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.25,
                        borderRadius: 2
                    }}
                >
                    <Skeleton variant="circular" width={40} height={40} />
                    <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="45%" height={20} />
                        <Skeleton variant="text" width="30%" height={18} />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Skeleton variant="rounded" width={70} height={24} />
                        <Skeleton variant="text" width={60} height={20} />
                    </Box>
                </Box>
            ))}
        </Stack>
    );
}

export default function TransactionsListCard({
    title = 'Transações',
    maxHeight = 340 // controla o scroll
}) {
    const { refresh: refreshTransactions, transactions, isLoading: isTransactionsLoading } = useTransactions();

    const items = useMemo(() => transactions?.items ?? [], [transactions]);

    return (
        <Card
            elevation={0}
            sx={{
                borderRadius: 3,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                overflow: 'hidden'
            }}
        >
            <Box
                sx={{
                    px: 2.25,
                    py: 1.75,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: (theme) => `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`
                }}
            >
                <Box>
                    <Typography variant="h5" sx={{ lineHeight: 1.2 }}>
                        {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {transactions?.total != null ? `${transactions.total} no total` : 'Histórico de movimentações do cartão'}
                    </Typography>
                </Box>

                <Tooltip title="Atualizar transações">
                    <span>
                        <IconButton
                            onClick={refreshTransactions}
                            disabled={isTransactionsLoading}
                            size="small"
                            sx={{
                                borderRadius: 2,
                                border: (theme) => `1px solid ${theme.palette.divider}`,
                                bgcolor: 'background.paper'
                            }}
                        >
                            <RefreshRoundedIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>

            <Divider />

            <CardContent sx={{ p: 2 }}>
                {isTransactionsLoading ? (
                    <TransactionsSkeleton rows={7} />
                ) : items.length === 0 ? (
                    <Box
                        sx={{
                            p: 3,
                            borderRadius: 3,
                            border: (theme) => `1px dashed ${theme.palette.divider}`,
                            textAlign: 'center'
                        }}
                    >
                        <Typography variant="h6" sx={{ mb: 0.5 }}>
                            Nenhuma transação encontrada
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Assim que você comprar tokens ou tiver movimentações, elas vão aparecer aqui.
                        </Typography>
                    </Box>
                ) : (
                    <Box
                        sx={{
                            maxHeight,
                            overflowY: 'auto',
                            pr: 0.5, // espaço pro scrollbar
                            '&::-webkit-scrollbar': { width: 8 },
                            '&::-webkit-scrollbar-thumb': {
                                borderRadius: 8,
                                backgroundColor: (theme) => theme.palette.action.hover
                            }
                        }}
                    >
                        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                            {items.map((tx) => {
                                const meta = getTypeMeta(tx.type);
                                const isPositive = tx.type === 'TOPUP' || Number(tx.amount) > 0;

                                return (
                                    <ListItem
                                        key={tx.id}
                                        disableGutters
                                        sx={{
                                            borderRadius: 2.5,
                                            border: (theme) => `1px solid ${theme.palette.divider}`,
                                            bgcolor: 'background.paper',
                                            transition: 'transform 120ms ease, box-shadow 120ms ease',
                                            '&:hover': {
                                                transform: 'translateY(-1px)',
                                                boxShadow: (theme) => theme.shadows[2]
                                            },
                                            padding: '0.5rem 0 0.5rem 0.5rem'
                                        }}
                                        secondaryAction={
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Chip size="small" label={meta.label} color={meta.color} variant="outlined" sx={{ borderRadius: 2 }} />
                                                <Typography
                                                    variant="subtitle1"
                                                    sx={{
                                                        fontWeight: 700,
                                                        color: isPositive ? 'success.main' : 'error.main',
                                                        minWidth: 86,
                                                        textAlign: 'right',
                                                        paddingRight: '0.5rem'
                                                    }}
                                                >
                                                    {isPositive ? '+' : ''}
                                                    {tx.amount}
                                                </Typography>
                                            </Stack>
                                        }
                                    >
                                        <ListItemAvatar>
                                            <Avatar
                                                sx={{
                                                    borderRadius: 2,
                                                    bgcolor: (theme) => theme.palette.action.hover,
                                                    color: 'text.primary'
                                                }}
                                            >
                                                {meta.icon}
                                            </Avatar>
                                        </ListItemAvatar>

                                        <ListItemText
                                            primary={
                                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                    {tx.description || 'Transação'}
                                                </Typography>
                                            }
                                            secondary={
                                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {formatDateTime(tx.created_at)}
                                                    </Typography>
                                                    {tx.provider_transaction_id ? (
                                                        <>
                                                            <Typography variant="caption" color="text.secondary">
                                                                •
                                                            </Typography>
                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                                sx={{
                                                                    maxWidth: 260,
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                                title={tx.provider_transaction_id}
                                                            >
                                                                {tx.provider_transaction_id}
                                                            </Typography>
                                                        </>
                                                    ) : null}
                                                </Stack>
                                            }
                                        />
                                    </ListItem>
                                );
                            })}
                        </List>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
