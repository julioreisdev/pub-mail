import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    MenuItem,
    Pagination,
    Popover,
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
import { RefreshRoundedIcon as RefreshRoundedIcon } from 'ui-component/icons';
import { SearchRoundedIcon as SearchRoundedIcon } from 'ui-component/icons';
import { FileDownloadRoundedIcon as FileDownloadRoundedIcon } from 'ui-component/icons';
import { OpenInNewRoundedIcon as OpenInNewRoundedIcon } from 'ui-component/icons';
import { AddRoundedIcon as AddRoundedIcon } from 'ui-component/icons';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

import MainCard from 'ui-component/cards/MainCard';
import { get, patch, post } from '../../../api/api';
import useWebchats from '../../../hooks/useWebchats';
import useQuizzes from '../../../hooks/useQuizzes';
import useEmailProjects from '../../../hooks/useEmailProjects';

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
        [originLabel]: lead.webchat_name || lead.quiz_name || lead.project_name || '',
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

const ENGAGEMENT = {
    clicked: { label: 'Clicou', color: 'success' },
    opened: { label: 'Abriu', color: 'info' },
    none: { label: 'Nunca interagiu', color: 'default' }
};

function EngagementChip({ lead }) {
    const m = ENGAGEMENT[lead.engagement] || ENGAGEMENT.none;
    const tip =
        [
            lead.last_open ? `Abertura: ${formatDateTime(lead.last_open)}` : null,
            lead.last_click_cta ? `Clique CTA: ${formatDateTime(lead.last_click_cta)}` : null
        ]
            .filter(Boolean)
            .join('  ·  ') || 'Sem interação registrada';
    return (
        <Tooltip title={tip} arrow placement="top">
            <Chip
                size="small"
                color={m.color}
                variant={lead.engagement === 'none' ? 'outlined' : 'filled'}
                label={m.label}
                sx={{ borderRadius: 1.5, height: 22, fontWeight: 700 }}
            />
        </Tooltip>
    );
}

function TagsCell({ lead, onSave, disabled }) {
    const [anchor, setAnchor] = useState(null);
    const [input, setInput] = useState('');
    const tags = Array.isArray(lead.tags) ? lead.tags : [];

    const add = () => {
        const t = input.trim();
        if (!t) return;
        if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) onSave(lead, [...tags, t]);
        setInput('');
    };
    const remove = (t) => onSave(lead, tags.filter((x) => x !== t));

    return (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {tags.map((t) => (
                <Chip key={t} size="small" label={t} onDelete={disabled ? undefined : () => remove(t)} color="secondary" variant="outlined" sx={{ borderRadius: 1.5, height: 22 }} />
            ))}
            <Tooltip title="Adicionar tag">
                <span>
                    <IconButton size="small" disabled={disabled} onClick={(e) => setAnchor(e.currentTarget)} sx={{ border: '1px dashed', borderColor: 'divider', width: 22, height: 22 }}>
                        <AddRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                </span>
            </Tooltip>
            <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
                <Box sx={{ p: 1.5, width: 230 }}>
                    <TextField
                        autoFocus
                        size="small"
                        fullWidth
                        placeholder="Nova tag (Enter)"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                add();
                            }
                        }}
                    />
                    <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                        <Button size="small" variant="contained" color="secondary" onClick={add} sx={{ borderRadius: 1.5 }}>
                            Adicionar
                        </Button>
                    </Stack>
                </Box>
            </Popover>
        </Stack>
    );
}

export default function Leads({ lockedOrigin = null, embedded = false }) {
    const { webchats, isLoading: isLoadingWebchats } = useWebchats();
    const { quizzes, isLoading: isLoadingQuizzes } = useQuizzes();
    const { emailProjects, isLoading: isLoadingProjects } = useEmailProjects();

    const [origin, setOrigin] = useState(lockedOrigin || 'webchat'); // 'webchat' | 'quiz' | 'email'
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
    const [allRaw, setAllRaw] = useState([]); // agregado das 3 origens (origem "Todos")

    // filtros por coluna (origem e-mail)
    const [fEngagement, setFEngagement] = useState('');
    const [fSource, setFSource] = useState('');
    const [fTag, setFTag] = useState('');
    const [fDateFrom, setFDateFrom] = useState('');
    const [fDateTo, setFDateTo] = useState('');

    // seleção + tags
    const [selected, setSelected] = useState(() => new Set());
    const [allTags, setAllTags] = useState([]);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkTags, setBulkTags] = useState([]);
    const [bulkInput, setBulkInput] = useState('');
    const [bulkSaving, setBulkSaving] = useState(false);

    const debounceRef = useRef(null);

    // Origem travada por contexto (Webchat/Quiz/E-mail): a mesma tela é
    // remontada por props sem trocar de componente, então sincroniza o estado.
    useEffect(() => {
        if (lockedOrigin) {
            setOrigin(lockedOrigin);
            setWebchatId('');
            setPage(1);
            setFEngagement('');
            setFSource('');
            setFTag('');
            setFDateFrom('');
            setFDateTo('');
            setSelected(new Set());
        }
    }, [lockedOrigin]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 300);
        return () => debounceRef.current && clearTimeout(debounceRef.current);
    }, [search]);

    const isAll = origin === 'all';
    const isQuiz = origin === 'quiz';
    const isEmail = origin === 'email';
    const endpointBase = isEmail ? '/email-project-leads' : isQuiz ? '/quiz-leads' : '/webchat-leads';
    const idParam = isEmail ? 'project_id' : isQuiz ? 'quiz_id' : 'webchat_id';

    // params de filtro só valem pra origem e-mail
    const buildFilterParams = useCallback(
        (params) => {
            if (!isEmail) return;
            if (fEngagement) params.set('engagement', fEngagement);
            if (fSource) params.set('source', fSource);
            if (fTag) params.set('tag', fTag);
            if (fDateFrom) params.set('date_from', new Date(fDateFrom + 'T00:00:00').toISOString());
            if (fDateTo) params.set('date_to', new Date(fDateTo + 'T23:59:59').toISOString());
        },
        [isEmail, fEngagement, fSource, fTag, fDateFrom, fDateTo]
    );

    const load = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('page_size', String(pageSize));
            if (webchatId) params.set(idParam, webchatId);
            if (debouncedSearch) params.set('q', debouncedSearch);
            buildFilterParams(params);
            const data = await get(`${endpointBase}?${params.toString()}`);
            setItems(Array.isArray(data?.items) ? data.items : []);
            setTotal(Number(data?.total || 0));
            setSelected(new Set());
        } catch (e) {
            setError(getErrorMessage(e, 'Não foi possível carregar os leads.'));
            setItems([]);
            setTotal(0);
        } finally {
            setIsLoading(false);
        }
    }, [page, pageSize, webchatId, debouncedSearch, endpointBase, idParam, buildFilterParams]);

    // reset de página quando um filtro muda
    useEffect(() => {
        setPage(1);
    }, [fEngagement, fSource, fTag, fDateFrom, fDateTo]);

    // carrega tags distintas da org (pra filtro + bulk)
    const loadTags = useCallback(async () => {
        try {
            const data = await get('/email/leads/tags');
            setAllTags(Array.isArray(data) ? data : []);
        } catch {
            /* silencioso */
        }
    }, []);
    useEffect(() => {
        loadTags();
    }, [loadTags]);

    // Origem "Todos": agrega as 3 fontes e pagina client-side sobre o agregado.
    const loadAll = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const p = new URLSearchParams();
            p.set('page', '1');
            p.set('page_size', '300');
            if (debouncedSearch) p.set('q', debouncedSearch);
            const qs = p.toString();
            const tag = (res, o) => (Array.isArray(res?.items) ? res.items : []).map((x) => ({ ...x, __origin: o }));
            const [w, q, e] = await Promise.all([
                get(`/webchat-leads?${qs}`).catch(() => ({ items: [] })),
                get(`/quiz-leads?${qs}`).catch(() => ({ items: [] })),
                get(`/email-project-leads?${qs}`).catch(() => ({ items: [] }))
            ]);
            const merged = [...tag(w, 'webchat'), ...tag(q, 'quiz'), ...tag(e, 'email')].sort(
                (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
            );
            setAllRaw(merged);
            setTotal(merged.length);
            setSelected(new Set());
        } catch (err) {
            setError(getErrorMessage(err, 'Não foi possível carregar os leads.'));
            setAllRaw([]);
            setTotal(0);
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearch]);

    useEffect(() => {
        if (isAll) loadAll();
    }, [isAll, loadAll]);

    useEffect(() => {
        if (!isAll) load();
    }, [isAll, load]);

    // fatia client-side do agregado por página (origem "Todos")
    useEffect(() => {
        if (isAll) setItems(allRaw.slice((page - 1) * pageSize, page * pageSize));
    }, [isAll, allRaw, page, pageSize]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const entityList = useMemo(() => {
        const src = isEmail ? emailProjects : isQuiz ? quizzes : webchats;
        return Array.isArray(src) ? src : Array.isArray(src?.items) ? src.items : [];
    }, [isEmail, isQuiz, emailProjects, quizzes, webchats]);

    const selectedWebchatName = useMemo(() => {
        const item = entityList.find((w) => w.id === webchatId);
        return item?.name || '';
    }, [entityList, webchatId]);

    const originLabel = isAll ? 'Canal' : isEmail ? 'Projeto' : isQuiz ? 'Quiz' : 'Webchat';
    const entityLoading = isEmail ? isLoadingProjects : isQuiz ? isLoadingQuizzes : isLoadingWebchats;
    const colCount = 7 + (isEmail ? 3 : 0);

    // Salva tags do lead (email) e recarrega a página.
    const handleSaveTags = async (lead, tags) => {
        if (!lead?.lead_id) return;
        // otimista: reflete já na UI
        setItems((prev) => prev.map((it) => (it.lead_id === lead.lead_id ? { ...it, tags } : it)));
        try {
            await patch(`/email/leads/${lead.lead_id}`, { tags });
            loadTags();
        } catch (e) {
            setError(getErrorMessage(e, 'Falha ao salvar tags.'));
            load();
        }
    };

    // seleção
    const pageLeadIds = useMemo(() => items.map((it) => it.lead_id).filter(Boolean), [items]);
    const allSelected = pageLeadIds.length > 0 && pageLeadIds.every((id) => selected.has(id));
    const someSelected = pageLeadIds.some((id) => selected.has(id));
    const toggleAll = () => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (allSelected) pageLeadIds.forEach((id) => next.delete(id));
            else pageLeadIds.forEach((id) => next.add(id));
            return next;
        });
    };
    const toggleOne = (id) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    // aplica tags em massa
    const applyBulkTags = async () => {
        const tags = [...bulkTags];
        const extra = bulkInput.trim();
        if (extra && !tags.some((t) => t.toLowerCase() === extra.toLowerCase())) tags.push(extra);
        const leadIds = [...selected];
        if (tags.length === 0 || leadIds.length === 0) return;
        setBulkSaving(true);
        try {
            await post('/email/leads/tags/bulk', { lead_ids: leadIds, add: tags });
            setBulkOpen(false);
            setSelected(new Set());
            await Promise.all([load(), loadTags()]);
            toast.success(`Tags adicionadas a ${leadIds.length} lead(s).`);
        } catch (e) {
            setError(getErrorMessage(e, 'Falha ao aplicar tags.'));
        } finally {
            setBulkSaving(false);
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            let list;
            if (isAll) {
                // "Todos": exporta o agregado já carregado em memória.
                list = allRaw;
            } else {
                const params = new URLSearchParams();
                if (webchatId) params.set(idParam, webchatId);
                if (debouncedSearch) params.set('q', debouncedSearch);
                buildFilterParams(params);
                const data = await get(`${endpointBase}/export?${params.toString()}`);
                list = Array.isArray(data?.items) ? data.items : [];
            }
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
        <Box sx={{ p: embedded ? 0 : { xs: 2, md: 3 } }}>
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
                        <Typography variant="h4" sx={{ fontWeight: 900 }}>
                            Leads
                        </Typography>
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
                        {!lockedOrigin && (
                            <TextField
                                select
                                size="small"
                                label="Origem"
                                value={origin}
                                onChange={(e) => {
                                    setOrigin(e.target.value);
                                    setWebchatId('');
                                    setPage(1);
                                    setFEngagement('');
                                    setFSource('');
                                    setFTag('');
                                    setFDateFrom('');
                                    setFDateTo('');
                                    setSelected(new Set());
                                }}
                                sx={{ minWidth: 150 }}
                            >
                                <MenuItem value="all">Todos</MenuItem>
                                <MenuItem value="webchat">Webchats</MenuItem>
                                <MenuItem value="quiz">Quizzes</MenuItem>
                                <MenuItem value="email">Projetos de e-mail</MenuItem>
                            </TextField>
                        )}

                        {!isAll && <TextField
                            select
                            size="small"
                            label={originLabel}
                            value={webchatId}
                            onChange={(e) => {
                                setWebchatId(e.target.value);
                                setPage(1);
                            }}
                            sx={{ minWidth: 220 }}
                            disabled={entityLoading}
                        >
                            <MenuItem value="">{isEmail ? 'Todos os projetos' : isQuiz ? 'Todos os quizzes' : 'Todos os webchats'}</MenuItem>
                            {entityList.map((w) => (
                                <MenuItem key={w.id} value={w.id}>
                                    {w.name}
                                </MenuItem>
                            ))}
                        </TextField>}

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

                    {/* Filtros por coluna (origem e-mail) */}
                    {isEmail ? (
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ md: 'center' }}>
                            <TextField select size="small" label="Engajamento" value={fEngagement} onChange={(e) => setFEngagement(e.target.value)} sx={{ minWidth: 170 }}>
                                <MenuItem value="">Todos</MenuItem>
                                <MenuItem value="clicked">Clicou</MenuItem>
                                <MenuItem value="opened">Abriu (sem clicar)</MenuItem>
                                <MenuItem value="none">Nunca interagiu</MenuItem>
                            </TextField>
                            <TextField select size="small" label="Origem do lead" value={fSource} onChange={(e) => setFSource(e.target.value)} sx={{ minWidth: 150 }}>
                                <MenuItem value="">Todas</MenuItem>
                                <MenuItem value="formulário">Formulário</MenuItem>
                                <MenuItem value="quiz">Quiz</MenuItem>
                                <MenuItem value="webchat">Webchat</MenuItem>
                                <MenuItem value="api">API</MenuItem>
                            </TextField>
                            <TextField select size="small" label="Tag" value={fTag} onChange={(e) => setFTag(e.target.value)} sx={{ minWidth: 150 }}>
                                <MenuItem value="">Todas</MenuItem>
                                {allTags.map((t) => (
                                    <MenuItem key={t} value={t}>{t}</MenuItem>
                                ))}
                            </TextField>
                            <TextField size="small" type="date" label="Captado de" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
                            <TextField size="small" type="date" label="até" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
                            {(fEngagement || fSource || fTag || fDateFrom || fDateTo) ? (
                                <Button size="small" onClick={() => { setFEngagement(''); setFSource(''); setFTag(''); setFDateFrom(''); setFDateTo(''); }} sx={{ textTransform: 'none' }}>
                                    Limpar filtros
                                </Button>
                            ) : null}
                        </Stack>
                    ) : null}

                    {/* Barra de seleção / tag em massa */}
                    {isEmail && selected.size > 0 ? (
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2, p: 1.25, borderRadius: 2, bgcolor: 'secondary.light', border: '1px solid', borderColor: 'secondary.main' }}>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                {selected.size} lead{selected.size === 1 ? '' : 's'} selecionado{selected.size === 1 ? '' : 's'}
                            </Typography>
                            <Button size="small" variant="contained" color="secondary" startIcon={<AddRoundedIcon fontSize="small" />} onClick={() => { setBulkTags([]); setBulkInput(''); setBulkOpen(true); }} sx={{ borderRadius: 1.5, fontWeight: 800 }}>
                                Adicionar tags
                            </Button>
                            <Button size="small" onClick={() => setSelected(new Set())} sx={{ textTransform: 'none' }}>
                                Limpar seleção
                            </Button>
                        </Stack>
                    ) : null}

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
                                    {isEmail ? (
                                        <TableCell padding="checkbox">
                                            <Checkbox size="small" checked={allSelected} indeterminate={!allSelected && someSelected} onChange={toggleAll} />
                                        </TableCell>
                                    ) : null}
                                    <TableCell>Nome</TableCell>
                                    <TableCell>E-mail</TableCell>
                                    <TableCell>Telefone</TableCell>
                                    <TableCell>{originLabel}</TableCell>
                                    <TableCell>Origem</TableCell>
                                    {isEmail ? <TableCell>Engajamento</TableCell> : null}
                                    {isEmail ? <TableCell>Tags</TableCell> : null}
                                    <TableCell>Criado em</TableCell>
                                    <TableCell align="right">Sessão</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={colCount} align="center" sx={{ py: 4 }}>
                                            <CircularProgress size={24} />
                                        </TableCell>
                                    </TableRow>
                                ) : items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={colCount} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                            {debouncedSearch || webchatId
                                                ? 'Nenhum lead encontrado para o filtro atual.'
                                                : 'Ainda não há leads capturados.'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((lead) => (
                                        <TableRow key={lead.id} hover selected={isEmail && selected.has(lead.lead_id)}>
                                            {isEmail ? (
                                                <TableCell padding="checkbox">
                                                    <Checkbox size="small" checked={selected.has(lead.lead_id)} onChange={() => toggleOne(lead.lead_id)} />
                                                </TableCell>
                                            ) : null}
                                            <TableCell>
                                                <Typography sx={{ fontWeight: 700 }}>{lead.name || '—'}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography sx={{ fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                                                    {lead.email}
                                                </Typography>
                                                {lead.suppressed ? (
                                                    <Tooltip title={lead.global_status === 'COMPLAINED' ? 'Marcou como spam — não recebe mais disparos' : 'Hard bounce — não recebe mais disparos'} arrow>
                                                        <Chip
                                                            size="small"
                                                            color="error"
                                                            variant="outlined"
                                                            label={lead.global_status === 'COMPLAINED' ? 'Suprimido · spam' : 'Suprimido · bounce'}
                                                            sx={{ borderRadius: 1, fontSize: 10, height: 18, mt: 0.5 }}
                                                        />
                                                    </Tooltip>
                                                ) : null}
                                            </TableCell>
                                            <TableCell>{lead.phone || '—'}</TableCell>
                                            <TableCell>
                                                <Stack spacing={0.25}>
                                                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{lead.webchat_name || lead.quiz_name || lead.project_name || '—'}</Typography>
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
                                            {isEmail ? (
                                                <TableCell><EngagementChip lead={lead} /></TableCell>
                                            ) : null}
                                            {isEmail ? (
                                                <TableCell><TagsCell lead={lead} onSave={handleSaveTags} /></TableCell>
                                            ) : null}
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

            {/* Dialog: adicionar tags em massa */}
            <Dialog open={bulkOpen} onClose={bulkSaving ? undefined : () => setBulkOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Adicionar tags a {selected.size} lead{selected.size === 1 ? '' : 's'}</DialogTitle>
                <DialogContent>
                    <Typography variant="caption" color="text.secondary">
                        As tags são adicionadas aos leads (sem remover as existentes). Digite e pressione Enter para adicionar várias.
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
                        {bulkTags.map((t) => (
                            <Chip key={t} label={t} color="secondary" onDelete={() => setBulkTags((prev) => prev.filter((x) => x !== t))} sx={{ borderRadius: 1.5 }} />
                        ))}
                    </Stack>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        sx={{ mt: 1.5 }}
                        label="Nova tag"
                        placeholder="Ex.: vip, promo-julho…"
                        value={bulkInput}
                        onChange={(e) => setBulkInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                const t = bulkInput.trim();
                                if (t && !bulkTags.some((x) => x.toLowerCase() === t.toLowerCase())) setBulkTags((prev) => [...prev, t]);
                                setBulkInput('');
                            }
                        }}
                    />
                    {allTags.length > 0 ? (
                        <>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 0.5 }}>
                                Tags existentes:
                            </Typography>
                            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                                {allTags.filter((t) => !bulkTags.some((x) => x.toLowerCase() === t.toLowerCase())).map((t) => (
                                    <Chip key={t} label={t} size="small" variant="outlined" onClick={() => setBulkTags((prev) => [...prev, t])} sx={{ borderRadius: 1.5, cursor: 'pointer' }} />
                                ))}
                            </Stack>
                        </>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBulkOpen(false)} disabled={bulkSaving}>Cancelar</Button>
                    <Button variant="contained" color="secondary" onClick={applyBulkTags} disabled={bulkSaving || (bulkTags.length === 0 && !bulkInput.trim())} startIcon={bulkSaving ? <CircularProgress size={16} color="inherit" /> : null}>
                        Aplicar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
