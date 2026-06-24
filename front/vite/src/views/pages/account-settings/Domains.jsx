// src/views/account-settings/components/Domains.jsx
import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Stack,
    Typography,
    TextField,
    Button,
    IconButton,
    Tooltip,
    Alert,
    Chip,
    Divider,
    CircularProgress,
    Skeleton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    InputAdornment,
    Snackbar
} from '@mui/material';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import HourglassBottomRoundedIcon from '@mui/icons-material/HourglassBottomRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import { post, patch, remove } from '../../../api/api';
import useDomains from '../../../hooks/useDomains';

const getErrorMessage = (err, fallback = 'Ocorreu um erro') =>
    err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

const normalizeDomain = (value) =>
    (value || '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');

const isValidDomain = (domain) => {
    // aceita "site.com" e "vendas.site.com"
    // rejeita protocolo, barras, espaços, e TLD curto
    const d = normalizeDomain(domain);
    if (!d) return false;
    if (d.length > 253) return false;
    if (d.includes(' ')) return false;
    if (d.includes('..')) return false;
    if (!d.includes('.')) return false;
    if (d.startsWith('.') || d.endsWith('.')) return false;

    const labels = d.split('.');
    if (labels.some((l) => !l || l.length > 63)) return false;
    if (labels.some((l) => l.startsWith('-') || l.endsWith('-'))) return false;

    const reLabel = /^[a-z0-9-]+$/;
    if (labels.some((l) => !reLabel.test(l))) return false;

    const tld = labels[labels.length - 1];
    if (!tld || tld.length < 2) return false;

    return true;
};

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            return true;
        } catch {
            return false;
        }
    }
}

function DomainsSkeleton({ rows = 5 }) {
    return (
        <Stack spacing={1}>
            {Array.from({ length: rows }).map((_, i) => (
                <Box
                    key={i}
                    sx={{
                        p: 1.75,
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper'
                    }}
                >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                        <Skeleton variant="rounded" width={110} height={26} />
                        <Skeleton variant="text" width="40%" />
                        <Box sx={{ flex: 1 }} />
                        <Skeleton variant="rounded" width={38} height={38} />
                    </Stack>
                    <Skeleton variant="text" width="70%" sx={{ mt: 1 }} />
                </Box>
            ))}
        </Stack>
    );
}

function ConfirmDialog({ open, title, description, loading, onClose, onConfirm }) {
    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary">
                    {description}
                </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button variant="outlined" onClick={onClose} disabled={loading} sx={{ borderRadius: 2 }}>
                    Cancelar
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    onClick={onConfirm}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : <DeleteRoundedIcon fontSize="small" />}
                    sx={{ borderRadius: 2, fontWeight: 900 }}
                >
                    Excluir
                </Button>
            </DialogActions>
        </Dialog>
    );
}

function DnsRow({ record, onCopy }) {
    const type = `${record?.description || ''} (${record?.type || '-'})` || '-';
    const name = record?.name || '-';
    const value = record?.value || '-';

    return (
        <Box
            sx={{
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                p: 1.25
            }}
        >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Chip size="small" variant="outlined" label={type} sx={{ borderRadius: 2, fontWeight: 900, width: 'fit-content' }} />

                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }} noWrap title={name}>
                        {name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>
                        {value}
                    </Typography>
                </Box>

                <Tooltip title="Copiar valor">
                    <span>
                        <IconButton size="small" onClick={() => onCopy(value)} sx={{ borderRadius: 2 }}>
                            <ContentCopyRoundedIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Stack>
        </Box>
    );
}

function DomainCard({ domain, loading, onDelete, onVerify, onCopyValue }) {
    const status = String(domain?.status || '').toUpperCase();
    const isPending = status === 'PENDING';
    const isVerified = status === 'VERIFIED';

    const badge = isVerified ? (
        <Chip
            size="small"
            color="secondary"
            variant="filled"
            icon={<VerifiedRoundedIcon sx={{ fontSize: 16 }} />}
            label="Verificado"
            sx={{ borderRadius: 2, fontWeight: 900 }}
        />
    ) : (
        <Chip
            size="small"
            variant="outlined"
            icon={<HourglassBottomRoundedIcon sx={{ fontSize: 16 }} />}
            label="Pendente"
            sx={{ borderRadius: 2, fontWeight: 900 }}
        />
    );

    const dns = Array.isArray(domain?.dns_records) ? domain.dns_records : [];

    return (
        <Box
            sx={{
                p: 1.75,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
            }}
        >
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
                {badge}

                <>
                    <Typography variant="subtitle1" sx={{ fontWeight: 950, lineHeight: 1.1 }} noWrap title={domain?.domain}>
                        {domain?.domain || '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                        ID: {domain?.id}
                    </Typography>
                </>

                <Box sx={{ flex: 1 }} />

                <Tooltip title="Excluir domínio">
                    <span>
                        <IconButton size="small" color="error" disabled={loading} onClick={() => onDelete(domain)} sx={{ borderRadius: 2 }}>
                            <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Stack>

            {isPending ? (
                <>
                    <Divider sx={{ my: 1.25 }} />

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <DnsRoundedIcon fontSize="small" />
                        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                            Registros DNS
                        </Typography>
                    </Stack>

                    {dns.length === 0 ? (
                        <Alert severity="warning" sx={{ borderRadius: 2 }}>
                            Nenhum registro DNS retornado pelo backend para este domínio.
                        </Alert>
                    ) : (
                        <Stack spacing={1}>
                            {dns.map((r, idx) => (
                                <DnsRow key={`${r?.type}-${r?.name}-${idx}`} record={r} onCopy={onCopyValue} />
                            ))}
                        </Stack>
                    )}

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end" sx={{ mt: 1.25 }}>
                        <Button
                            onClick={() => onVerify(domain)}
                            variant="contained"
                            color="secondary"
                            disabled={loading}
                            sx={{ borderRadius: 2, fontWeight: 900 }}
                        >
                            Já configurei, verificar agora
                        </Button>
                        <Typography>A verificação pode levar alguns minutos.</Typography>
                    </Stack>
                </>
            ) : null}
        </Box>
    );
}

/**
 * CRUD Domains
 * - GET: /domains (hook)
 * - POST: /domains { domain }
 * - PATCH: /domains/:id/verify
 * - DELETE: /domains/:id
 */
export default function Domains() {
    const { domains, isLoading, error, refresh } = useDomains();

    const list = useMemo(() => {
        if (!domains) return [];
        if (Array.isArray(domains)) return domains;
        if (Array.isArray(domains?.items)) return domains.items;
        return [];
    }, [domains]);

    const [domainInput, setDomainInput] = useState('');
    const [domainError, setDomainError] = useState('');

    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState('');

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);

    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

    const validateDomain = (val) => {
        const normalized = normalizeDomain(val);
        if (!normalized) {
            setDomainError('');
            return false;
        }
        const ok = isValidDomain(normalized);
        setDomainError(ok ? '' : 'Digite um domínio válido (ex: vendas.empresa.com)');
        return ok;
    };

    useEffect(() => {
        validateDomain(domainInput);
    }, [domainInput]);

    const canCreate = useMemo(() => {
        const normalized = normalizeDomain(domainInput);
        return Boolean(normalized) && !domainError && isValidDomain(normalized) && !actionLoading;
    }, [domainInput, domainError, actionLoading]);

    const handleCreate = async (e) => {
        e?.preventDefault?.();
        const normalized = normalizeDomain(domainInput);
        if (!isValidDomain(normalized)) {
            setDomainError('Digite um domínio válido (ex: vendas.empresa.com)');
            return;
        }

        setActionLoading(true);
        setActionError('');

        try {
            await post('/domains', { domain: normalized });
            setDomainInput('');
            await refresh();
        } catch (err) {
            setActionError(getErrorMessage(err, 'Falha ao cadastrar domínio'));
        } finally {
            setActionLoading(false);
        }
    };

    const askDelete = (d) => {
        setPendingDelete(d);
        setConfirmOpen(true);
    };

    const doDelete = async () => {
        if (!pendingDelete?.id) return;
        setActionLoading(true);
        setActionError('');

        try {
            await remove(`/domains/${pendingDelete.id}`);
            setConfirmOpen(false);
            setPendingDelete(null);
            await refresh();
        } catch (err) {
            setActionError(getErrorMessage(err, 'Falha ao excluir domínio'));
        } finally {
            setActionLoading(false);
        }
    };

    const doVerify = async (d) => {
        if (!d?.id) return;
        setActionLoading(true);
        setActionError('');

        try {
            await patch(`/domains/${d.id}/verify`, {});
            await refresh();
        } catch (err) {
            setActionError(getErrorMessage(err, 'Falha ao verificar domínio'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleCopyValue = async (val) => {
        const ok = await copyToClipboard(String(val || ''));
        setSnack({
            open: true,
            msg: ok ? 'Valor copiado!' : 'Não foi possível copiar.',
            severity: ok ? 'success' : 'error'
        });
    };

    return (
        <>
            <Stack spacing={2}>
                {/* Header + actions */}
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.5}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                    justifyContent="space-between"
                >
                    <Tooltip title="Atualizar">
                        <span>
                            <IconButton
                                onClick={refresh}
                                disabled={isLoading || actionLoading}
                                size="small"
                                sx={{
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                    width: 40,
                                    height: 40
                                }}
                            >
                                <RefreshRoundedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>

                {/* Create */}
                <Box
                    sx={{
                        p: 2,
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper'
                    }}
                >
                    <Box component="form" onSubmit={handleCreate}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
                            <TextField
                                label="Seu domínio"
                                placeholder="vendas.empresa.com"
                                value={domainInput}
                                onChange={(e) => setDomainInput(e.target.value)}
                                error={Boolean(domainError)}
                                helperText={domainError || ' '}
                                fullWidth
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LinkRoundedIcon fontSize="small" />
                                        </InputAdornment>
                                    )
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleCreate(e);
                                    }
                                }}
                            />

                            <Button
                                type="submit"
                                variant="contained"
                                color="secondary"
                                startIcon={actionLoading ? <CircularProgress size={16} /> : <AddRoundedIcon />}
                                disabled={!canCreate}
                                sx={{
                                    borderRadius: 2,
                                    fontWeight: 900,
                                    height: 44,
                                    whiteSpace: 'nowrap',
                                    marginBottom: '1.5rem !important'
                                }}
                            >
                                Cadastrar
                            </Button>
                        </Stack>
                    </Box>
                </Box>

                {error ? (
                    <Alert severity="error" sx={{ borderRadius: 2 }}>
                        {getErrorMessage(error, 'Falha ao carregar domínios')}
                    </Alert>
                ) : null}

                {actionError ? (
                    <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setActionError('')}>
                        {actionError}
                    </Alert>
                ) : null}

                {/* List */}
                {isLoading ? (
                    <DomainsSkeleton rows={5} />
                ) : list.length === 0 ? (
                    <Box
                        sx={{
                            p: 3,
                            borderRadius: 3,
                            border: '1px dashed',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            textAlign: 'center'
                        }}
                    >
                        <Typography variant="h6" sx={{ mb: 0.5 }}>
                            Nenhum domínio cadastrado
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Cadastre um domínio para começar a enviar e-mails com ele.
                        </Typography>
                    </Box>
                ) : (
                    <Box
                        sx={{
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            p: 1.5,
                            maxHeight: 620,
                            overflow: 'auto'
                        }}
                    >
                        <Stack spacing={1}>
                            {list.map((d) => (
                                <DomainCard
                                    key={d.id}
                                    domain={d}
                                    loading={actionLoading}
                                    onDelete={askDelete}
                                    onVerify={doVerify}
                                    onCopyValue={handleCopyValue}
                                />
                            ))}
                        </Stack>
                    </Box>
                )}
            </Stack>

            <ConfirmDialog
                open={confirmOpen}
                title="Excluir domínio?"
                description={`Tem certeza que deseja excluir o domínio "${pendingDelete?.domain || ''}"?`}
                loading={actionLoading}
                onClose={() => (actionLoading ? null : setConfirmOpen(false))}
                onConfirm={doDelete}
            />

            <Snackbar open={snack.open} autoHideDuration={2200} onClose={() => setSnack((s) => ({ ...s, open: false }))} message={snack.msg} />
        </>
    );
}
