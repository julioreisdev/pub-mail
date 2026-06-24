import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    InputAdornment,
    MenuItem,
    Pagination,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

import MainCard from 'ui-component/cards/MainCard';
import { get } from '../../../api/api';
import useWebchats from '../../../hooks/useWebchats';
import useQuizzes from '../../../hooks/useQuizzes';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function getErrorMessage(error, fallback) {
    const message = error?.response?.data?.message ?? error?.message;
    if (Array.isArray(message)) return message.join(' | ');
    return String(message || fallback);
}

function formatDateTime(value) {
    if (!value) return '';
    try {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
    } catch {
        return String(value);
    }
}

function formatDateTimeForExcel(value) {
    if (!value) return '';
    try {
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(new Date(value));
    } catch {
        return String(value);
    }
}

function flattenCustomFields(custom) {
    if (!custom || typeof custom !== 'object') return '';
    return Object.entries(custom)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        .join(' | ');
}

function buildExcelFromLeads(items, originLabel) {
    const rows = items.map((lead) => ({
        Nome: lead.name || '',
        'E-mail': lead.email || '',
        Telefone: lead.phone || '',
        [originLabel]: lead.webchat_name || lead.quiz_name || '',
        Domínio: lead.webchat_domain || lead.quiz_domain || '',
        Origem: lead.source || '',
        'Session ID': lead.session_id || '',
        'Campos personalizados': flattenCustomFields(lead.custom_fields),
        'Criado em': formatDateTimeForExcel(lead.created_at),
        'Atualizado em': formatDateTimeForExcel(lead.updated_at),
        'Lead ID': lead.id
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    // Larguras razoáveis (em "characters")
    worksheet['!cols'] = [
        { wch: 24 }, // Nome
        { wch: 30 }, // E-mail
        { wch: 18 }, // Telefone
        { wch: 22 }, // Webchat
        { wch: 24 }, // Domínio
        { wch: 14 }, // Origem
        { wch: 26 }, // Session ID
        { wch: 36 }, // Custom fields
        { wch: 18 }, // Criado em
        { wch: 18 }, // Atualizado em
        { wch: 36 } // ID
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
    return workbook;
}

export default function Leads() {
    const { webchats, isLoading: isLoadingWebchats } = useWebchats();
    const { quizzes, isLoading: isLoadingQuizzes } = useQuizzes();

    const [origin, setOrigin] = useState('webchat'); // 'webchat' | 'quiz'
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [webchatId, setWebchatId] = useState('');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    const debounceRef = useRef(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 300);
        return () => debounceRef.current && clearTimeout(debounceRef.current);
    }, [search]);

    const isQuiz = origin === 'quiz';
    const endpointBase = isQuiz ? '/quiz-leads' : '/webchat-leads';
    const idParam = isQuiz ? 'quiz_id' : 'webchat_id';

    const load = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('page_size', String(pageSize));
            if (webchatId) params.set(idParam, webchatId);
            if (debouncedSearch) params.set('q', debouncedSearch);
            const data = await get(`${endpointBase}?${params.toString()}`);
            setItems(Array.isArray(data?.items) ? data.items : []);
            setTotal(Number(data?.total || 0));
        } catch (e) {
            setError(getErrorMessage(e, 'Não foi possível carregar os leads.'));
            setItems([]);
            setTotal(0);
        } finally {
            setIsLoading(false);
        }
    }, [page, pageSize, webchatId, debouncedSearch, endpointBase, idParam]);

    useEffect(() => {
        load();
    }, [load]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const entityList = useMemo(() => {
        const src = isQuiz ? quizzes : webchats;
        return Array.isArray(src) ? src : Array.isArray(src?.items) ? src.items : [];
    }, [isQuiz, quizzes, webchats]);

    const selectedWebchatName = useMemo(() => {
        const item = entityList.find((w) => w.id === webchatId);
        return item?.name || '';
    }, [entityList, webchatId]);

    const originLabel = isQuiz ? 'Quiz' : 'Webchat';

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const params = new URLSearchParams();
            if (webchatId) params.set(idParam, webchatId);
            if (debouncedSearch) params.set('q', debouncedSearch);
            const data = await get(`${endpointBase}/export?${params.toString()}`);
            const list = Array.isArray(data?.items) ? data.items : [];
            if (list.length === 0) {
                toast('Nenhum lead para exportar com esse filtro.', { icon: 'ℹ️' });
                return;
            }
            const workbook = buildExcelFromLeads(list, originLabel);
            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            const slug = selectedWebchatName
                ? selectedWebchatName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
                : 'todos';
            const filename = `leads_${slug}_${stamp}.xlsx`;
            XLSX.writeFile(workbook, filename);
            toast.success(`Exportados ${list.length} leads em ${filename}.`);
        } catch (e) {
            toast.error(getErrorMessage(e, 'Falha ao exportar.'));
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <MainCard
                content={false}
                sx={{
                    overflow: 'hidden',
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider'
                }}
            >
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1.5}
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        justifyContent="space-between"
                        sx={{ mb: 2 }}
                    >
                        <Box>
                            <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
                                Leads
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                Leads capturados pelos webchats e quizzes. Escolha a origem, filtre, busque e exporte em Excel.
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                            <Button
                                variant="outlined"
                                onClick={() => load()}
                                startIcon={<RefreshRoundedIcon />}
                                sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 1.5 }}
                                disabled={isLoading}
                            >
                                Atualizar
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleExport}
                                disabled={isExporting || isLoading || total === 0}
                                startIcon={isExporting ? <CircularProgress size={16} color="inherit" /> : <FileDownloadRoundedIcon />}
                                sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 1.5 }}
                            >
                                Exportar Excel
                            </Button>
                        </Stack>
                    </Stack>

                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1.5}
                        sx={{ mb: 2 }}
                    >
                        <TextField
                            select
                            size="small"
                            label="Origem"
                            value={origin}
                            onChange={(e) => {
                                setOrigin(e.target.value);
                                setWebchatId('');
                                setPage(1);
                            }}
                            sx={{ minWidth: 150 }}
                        >
                            <MenuItem value="webchat">Webchats</MenuItem>
                            <MenuItem value="quiz">Quizzes</MenuItem>
                        </TextField>

                        <TextField
                            select
                            size="small"
                            label={originLabel}
                            value={webchatId}
                            onChange={(e) => {
                                setWebchatId(e.target.value);
                                setPage(1);
                            }}
                            sx={{ minWidth: 220 }}
                            disabled={isQuiz ? isLoadingQuizzes : isLoadingWebchats}
                        >
                            <MenuItem value="">{isQuiz ? 'Todos os quizzes' : 'Todos os webchats'}</MenuItem>
                            {entityList.map((w) => (
                                <MenuItem key={w.id} value={w.id}>
                                    {w.name}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            size="small"
                            label="Buscar"
                            placeholder="nome, e-mail, telefone…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            sx={{ flex: 1, minWidth: 220 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchRoundedIcon fontSize="small" />
                                    </InputAdornment>
                                )
                            }}
                        />

                        <TextField
                            select
                            size="small"
                            label="Por página"
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setPage(1);
                            }}
                            sx={{ minWidth: 120 }}
                        >
                            {PAGE_SIZE_OPTIONS.map((opt) => (
                                <MenuItem key={opt} value={opt}>
                                    {opt}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Stack>

                    {error ? (
                        <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>
                            {error}
                        </Alert>
                    ) : null}

                    <TableContainer
                        sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            bgcolor: 'background.paper'
                        }}
                    >
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ '& th': { fontWeight: 800, bgcolor: 'rgba(0,0,0,0.02)' } }}>
                                    <TableCell>Nome</TableCell>
                                    <TableCell>E-mail</TableCell>
                                    <TableCell>Telefone</TableCell>
                                    <TableCell>{originLabel}</TableCell>
                                    <TableCell>Origem</TableCell>
                                    <TableCell>Criado em</TableCell>
                                    <TableCell align="right">Sessão</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                            <CircularProgress size={24} />
                                        </TableCell>
                                    </TableRow>
                                ) : items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                            {debouncedSearch || webchatId
                                                ? 'Nenhum lead encontrado para o filtro atual.'
                                                : 'Ainda não há leads capturados.'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((lead) => (
                                        <TableRow key={lead.id} hover>
                                            <TableCell>
                                                <Typography sx={{ fontWeight: 700 }}>{lead.name || '—'}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography sx={{ fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                                                    {lead.email}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{lead.phone || '—'}</TableCell>
                                            <TableCell>
                                                <Stack spacing={0.25}>
                                                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{lead.webchat_name || lead.quiz_name || '—'}</Typography>
                                                    {lead.webchat_domain || lead.quiz_domain ? (
                                                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{lead.webchat_domain || lead.quiz_domain}</Typography>
                                                    ) : null}
                                                </Stack>
                                            </TableCell>
                                            <TableCell>
                                                {lead.source ? (
                                                    <Chip size="small" label={lead.source} variant="outlined" sx={{ borderRadius: 1, fontSize: 11 }} />
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title={new Date(lead.created_at).toISOString()} arrow placement="top">
                                                    <Typography sx={{ fontSize: 13 }}>{formatDateTime(lead.created_at)}</Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell align="right">
                                                {lead.session_id ? (
                                                    <Tooltip title={lead.session_id} arrow placement="top">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                navigator.clipboard?.writeText(lead.session_id);
                                                                toast.success('Session ID copiado.');
                                                            }}
                                                        >
                                                            <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        justifyContent="space-between"
                        sx={{ mt: 2 }}
                    >
                        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                            {total > 0
                                ? `Mostrando ${(page - 1) * pageSize + 1}–${Math.min(total, page * pageSize)} de ${total} lead${total === 1 ? '' : 's'}`
                                : '—'}
                        </Typography>
                        <Pagination
                            color="primary"
                            page={page}
                            onChange={(_, value) => setPage(value)}
                            count={totalPages}
                            disabled={isLoading}
                            shape="rounded"
                        />
                    </Stack>
                </Box>
            </MainCard>
        </Box>
    );
}
