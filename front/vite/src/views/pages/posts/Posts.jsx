import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormHelperText,
    Grid,
    IconButton,
    InputAdornment,
    Menu,
    MenuItem,
    Stack,
    TextField,
    Tooltip,
    Typography,
    alpha,
    useTheme
} from '@mui/material';
import {
    Add,
    ArrowBackIosNew,
    ArrowForwardIos,
    Close,
    ContentCopy,
    DeleteOutline,
    EditOutlined,
    ImageOutlined,
    Launch,
    MoreVert,
    OndemandVideo,
    PhotoLibrary,
    Refresh,
    SellOutlined,
    Title as TitleIcon,
    UploadFile
} from '@mui/icons-material';
import toast from 'react-hot-toast';

import MainCard from 'ui-component/cards/MainCard';
import api from '../../../api/api';
import usePosts from '../../../hooks/usePosts';

const UPLOADS_BASE_URL = `${import.meta.env.VITE_API_URL}/uploads`;

const POST_TYPE_OPTIONS = [
    { value: 'SINGLE_IMAGE', label: 'Imagem única' },
    { value: 'SINGLE_VIDEO', label: 'Vídeo único' },
    { value: 'CAROUSEL', label: 'Carrossel' }
];

const CARD_WIDTH = 250;
const CARD_HEIGHT = 500;
const CARD_HEADER_HEIGHT = 60;
const CARD_MEDIA_HEIGHT = 290;
const CARD_BODY_HEIGHT = 100;
const CARD_FOOTER_HEIGHT = 50;

function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.posts)) return value.posts;
    if (Array.isArray(value?.items)) return value.items;
    return [];
}

function mediaUrl(storageKey) {
    return `${UPLOADS_BASE_URL}/${storageKey}`;
}

function formatDate(value) {
    if (!value) return '-';

    try {
        return new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
        }).format(new Date(value));
    } catch {
        return value;
    }
}

function formatBytes(bytes = 0) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / 1024 ** i;
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function normalizeTagsInput(input) {
    if (!input || !input.trim()) return [];

    return input
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => (item.startsWith('#') ? item : `#${item}`));
}

function tagsToInput(tags) {
    if (!Array.isArray(tags) || !tags.length) return '';
    return tags.join(', ');
}

function postTypeLabel(postType) {
    return POST_TYPE_OPTIONS.find((item) => item.value === postType)?.label || postType;
}

function detectFilesType(files) {
    if (!files?.length) return '';
    if (files.length > 1) return 'CAROUSEL';

    const [file] = files;
    if (file.type?.startsWith('video/')) return 'SINGLE_VIDEO';
    return 'SINGLE_IMAGE';
}

function getPostTypeMeta(postType) {
    switch (postType) {
        case 'SINGLE_VIDEO':
            return {
                label: 'Vídeo',
                icon: <OndemandVideo fontSize="small" />
            };
        case 'SINGLE_IMAGE':
            return {
                label: 'Imagem',
                icon: <ImageOutlined fontSize="small" />
            };
        default:
            return {
                label: 'Carrossel',
                icon: <PhotoLibrary fontSize="small" />
            };
    }
}

function LoadingActionButton({ loading, children, startIcon, ...props }) {
    return (
        <Button
            {...props}
            disabled={loading || props.disabled}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : startIcon}
        >
            {children}
        </Button>
    );
}

function PostMediaPreview({ post }) {
    const sortedMedia = useMemo(() => ensureArray(post?.media).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)), [post]);

    const [index, setIndex] = useState(0);
    const theme = useTheme();

    useEffect(() => {
        setIndex(0);
    }, [post?.id]);

    if (!sortedMedia.length) {
        return (
            <Box
                sx={{
                    width: '100%',
                    height: CARD_MEDIA_HEIGHT,
                    bgcolor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'text.secondary'
                }}
            >
                <Stack alignItems="center" spacing={1}>
                    <ImageOutlined />
                    <Typography variant="body2">Sem mídia</Typography>
                </Stack>
            </Box>
        );
    }

    const current = sortedMedia[index];
    const isVideo = current?.media_type === 'VIDEO' || current?.mime_type?.startsWith('video/');
    const canNavigate = sortedMedia.length > 1;

    return (
        <Box
            sx={{
                position: 'relative',
                width: '100%',
                height: CARD_MEDIA_HEIGHT,
                overflow: 'hidden',
                bgcolor: '#0b0f19'
            }}
        >
            {isVideo ? (
                <Box
                    component="video"
                    src={mediaUrl(current.storage_key)}
                    controls
                    muted
                    playsInline
                    sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        bgcolor: 'black'
                    }}
                />
            ) : (
                <Box
                    component="img"
                    src={mediaUrl(current.storage_key)}
                    alt={current.original_name || 'Mídia do post'}
                    sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center center',
                        display: 'block',
                        bgcolor: '#0b0f19'
                    }}
                />
            )}

            {canNavigate && (
                <>
                    <IconButton
                        onClick={() => setIndex((prev) => (prev === 0 ? sortedMedia.length - 1 : prev - 1))}
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            left: 8,
                            transform: 'translateY(-50%)',
                            bgcolor: 'rgba(0,0,0,0.42)',
                            color: 'white',
                            width: 28,
                            height: 28,
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.58)' }
                        }}
                    >
                        <ArrowBackIosNew sx={{ fontSize: 14 }} />
                    </IconButton>

                    <IconButton
                        onClick={() => setIndex((prev) => (prev === sortedMedia.length - 1 ? 0 : prev + 1))}
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            right: 8,
                            transform: 'translateY(-50%)',
                            bgcolor: 'rgba(0,0,0,0.42)',
                            color: 'white',
                            width: 28,
                            height: 28,
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.58)' }
                        }}
                    >
                        <ArrowForwardIos sx={{ fontSize: 14 }} />
                    </IconButton>

                    <Box
                        sx={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            px: 1,
                            py: 0.25,
                            borderRadius: 999,
                            bgcolor: 'rgba(0,0,0,0.55)',
                            color: 'white',
                            fontSize: 11,
                            fontWeight: 700
                        }}
                    >
                        {index + 1}/{sortedMedia.length}
                    </Box>

                    <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{
                            position: 'absolute',
                            bottom: 10,
                            left: '50%',
                            transform: 'translateX(-50%)'
                        }}
                    >
                        {sortedMedia.map((_, dotIndex) => (
                            <Box
                                key={dotIndex}
                                sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    bgcolor: dotIndex === index ? 'white' : 'rgba(255,255,255,0.42)'
                                }}
                            />
                        ))}
                    </Stack>
                </>
            )}
        </Box>
    );
}

function InstagramLikeCard({ post, onEdit, onDelete, onOpenMediaMenu }) {
    const theme = useTheme();
    const mediaMeta = getPostTypeMeta(post.post_type);

    return (
        <MainCard
            content={false}
            sx={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                overflow: 'hidden',
                borderRadius: 4,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: theme.shadows[2],
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[8]
                }
            }}
        >
            <Box
                sx={{
                    height: CARD_HEADER_HEIGHT,
                    px: 1.5,
                    py: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                    <Box
                        sx={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${theme.vars.palette.primary.main}, ${theme.vars.palette.secondary.main})`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 800,
                            fontSize: 13,
                            flexShrink: 0
                        }}
                    >
                        P
                    </Box>

                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight={800} noWrap>
                            {post.internal_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                            {mediaMeta.label}
                        </Typography>
                    </Box>
                </Stack>

                <Stack direction="row" spacing={0}>
                    <Tooltip title="Editar textos">
                        <IconButton size="small" onClick={() => onEdit(post)}>
                            <EditOutlined sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir post">
                        <IconButton size="small" color="error" onClick={() => onDelete(post)}>
                            <DeleteOutline sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Box>

            <PostMediaPreview post={post} />

            <Box
                sx={{
                    height: CARD_BODY_HEIGHT,
                    px: 1.5,
                    py: 1.25,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}
            >
                <Box>
                    <Stack direction="row" spacing={0.75} justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ minWidth: 0, flex: 1 }}>
                            {ensureArray(post.tags)
                                .slice(0, 2)
                                .map((tag) => (
                                    <Chip
                                        key={tag}
                                        label={tag}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                            borderRadius: 2,
                                            fontWeight: 600,
                                            maxWidth: 90,
                                            '& .MuiChip-label': {
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }
                                        }}
                                    />
                                ))}
                        </Stack>

                        <Button size="small" variant="text" sx={{ minWidth: 'auto', px: 1 }} onClick={(event) => onOpenMediaMenu(event, post)}>
                            <MoreVert sx={{ fontSize: 18 }} />
                        </Button>
                    </Stack>

                    {post.default_title ? (
                        <Typography
                            variant="body2"
                            sx={{
                                mt: 0.75,
                                fontWeight: 800,
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                            }}
                        >
                            {post.default_title}
                        </Typography>
                    ) : null}

                    {post.default_caption ? (
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                                mt: 0.75,
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.45
                            }}
                        >
                            {post.default_caption}
                        </Typography>
                    ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75 }}>
                            Sem legenda cadastrada.
                        </Typography>
                    )}
                </Box>
            </Box>

            <Divider />

            <Box
                sx={{
                    height: CARD_FOOTER_HEIGHT,
                    px: 1.5,
                    py: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <Stack direction="row" spacing={0.75} alignItems="center">
                    <Chip size="small" icon={mediaMeta.icon} label={`${ensureArray(post.media).length}`} sx={{ height: 24, borderRadius: 2 }} />
                </Stack>

                <Typography variant="caption" color="text.secondary" noWrap>
                    {formatDate(post.updated_at)}
                </Typography>
            </Box>
        </MainCard>
    );
}

function MediaQuickActionsMenu({ anchorEl, open, onClose, post }) {
    const selectedMedia = ensureArray(post?.media).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const handleCopy = async (value, successMessage) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(successMessage);
            onClose();
        } catch {
            toast.error('Não foi possível copiar.');
        }
    };

    return (
        <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
            {!selectedMedia.length && <MenuItem disabled>Sem mídias</MenuItem>}

            {selectedMedia.map((item, index) => {
                const url = mediaUrl(item.storage_key);
                const label = `${index + 1}. ${item.original_name}`;

                return (
                    <Box key={item.id}>
                        <MenuItem
                            onClick={() => {
                                window.open(url, '_blank', 'noopener,noreferrer');
                                onClose();
                            }}
                        >
                            <Launch fontSize="small" sx={{ mr: 1.25 }} />
                            Abrir {label}
                        </MenuItem>

                        <MenuItem onClick={() => handleCopy(url, 'URL da mídia copiada')}>
                            <ContentCopy fontSize="small" sx={{ mr: 1.25 }} />
                            Copiar URL de {label}
                        </MenuItem>

                        <MenuItem onClick={() => handleCopy(item.original_name || '', 'Nome do arquivo copiado')}>
                            <ContentCopy fontSize="small" sx={{ mr: 1.25 }} />
                            Copiar nome de {label}
                        </MenuItem>

                        {index < selectedMedia.length - 1 && <Divider />}
                    </Box>
                );
            })}
        </Menu>
    );
}

function CreatePostDialog({ open, onClose, onCreated }) {
    const [form, setForm] = useState({
        internal_name: '',
        post_type: 'SINGLE_IMAGE',
        default_title: '',
        default_caption: '',
        tags: ''
    });
    const [files, setFiles] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (!open) {
            setForm({
                internal_name: '',
                post_type: 'SINGLE_IMAGE',
                default_title: '',
                default_caption: '',
                tags: ''
            });
            setFiles([]);
            setError('');
            setSubmitting(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    }, [open]);

    const totalBytes = useMemo(() => files.reduce((sum, file) => sum + (file.size || 0), 0), [files]);
    const estimatedTokens = useMemo(() => Math.ceil(totalBytes / (1024 * 1024)), [totalBytes]);

    const handleChange = (field) => (event) => {
        setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const handleFilesChange = (event) => {
        const selected = Array.from(event.target.files || []);
        setFiles(selected);

        const inferredType = detectFilesType(selected);
        if (inferredType) {
            setForm((prev) => ({ ...prev, post_type: inferredType }));
        }
    };

    const validate = () => {
        if (!form.internal_name.trim()) return 'Informe o nome interno do post.';
        if (!files.length) return 'Selecione pelo menos um arquivo.';
        if (form.post_type === 'SINGLE_IMAGE' && files.length !== 1) return 'Post de imagem única deve ter exatamente 1 arquivo.';
        if (form.post_type === 'SINGLE_VIDEO' && files.length !== 1) return 'Post de vídeo único deve ter exatamente 1 arquivo.';
        if (form.post_type === 'SINGLE_VIDEO' && !files[0]?.type?.startsWith('video/')) return 'Selecione um vídeo para post do tipo vídeo.';
        if (form.post_type === 'SINGLE_IMAGE' && !files[0]?.type?.startsWith('image/')) return 'Selecione uma imagem para post do tipo imagem.';
        if (form.post_type === 'CAROUSEL' && files.length < 2) return 'Carrossel deve ter pelo menos 2 arquivos.';
        return '';
    };

    const handleSubmit = async () => {
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const data = new FormData();
            data.append('internal_name', form.internal_name.trim());
            data.append('post_type', form.post_type);

            if (form.default_title.trim()) data.append('default_title', form.default_title.trim());
            if (form.default_caption.trim()) data.append('default_caption', form.default_caption.trim());

            const normalizedTags = normalizeTagsInput(form.tags);
            if (normalizedTags.length) {
                data.append('tags', JSON.stringify(normalizedTags));
            }

            files.forEach((file) => data.append('files', file));

            const response = await api.post('/posts', data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                timeout: 0
            });

            toast.success(response?.data?.message || 'Post criado com sucesso.');
            onCreated?.();
            onClose?.();
        } catch (err) {
            const status = err?.response?.status;
            const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Não foi possível criar o post.';

            if (status === 402) {
                setError(message);
                toast.error('Saldo insuficiente para o upload.');
            } else if (status === 413) {
                setError(message || 'Arquivo muito grande para a configuração atual do servidor.');
                toast.error('Upload muito grande para o limite atual.');
            } else {
                setError(message);
                toast.error('Erro ao criar o post.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1.5 }}>
                <Stack spacing={0.25}>
                    <Typography variant="h4">Novo post</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Cadastre as mídias uma vez e depois edite só os textos.
                    </Typography>
                </Stack>

                <IconButton onClick={onClose} disabled={submitting}>
                    <Close />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2.2}>
                    {error ? <Alert severity="error">{error}</Alert> : null}

                    <TextField
                        label="Nome interno"
                        value={form.internal_name}
                        onChange={handleChange('internal_name')}
                        placeholder="Ex.: Campanha Dia das Mães"
                        fullWidth
                    />

                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <TextField select label="Tipo do post" value={form.post_type} onChange={handleChange('post_type')}>
                                    {POST_TYPE_OPTIONS.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <FormHelperText>O tipo é inferido automaticamente ao selecionar arquivos, mas você pode ajustar.</FormHelperText>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Tags"
                                value={form.tags}
                                onChange={handleChange('tags')}
                                placeholder="#marketing, #instagram, #viral"
                                fullWidth
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SellOutlined fontSize="small" />
                                        </InputAdornment>
                                    )
                                }}
                            />
                        </Grid>
                    </Grid>

                    <TextField
                        label="Título padrão"
                        value={form.default_title}
                        onChange={handleChange('default_title')}
                        placeholder="Título opcional do post"
                        fullWidth
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <TitleIcon fontSize="small" />
                                </InputAdornment>
                            )
                        }}
                    />

                    <TextField
                        label="Legenda padrão"
                        value={form.default_caption}
                        onChange={handleChange('default_caption')}
                        placeholder="Legenda opcional para Instagram/TikTok"
                        multiline
                        minRows={5}
                        fullWidth
                    />

                    <Box
                        sx={{
                            border: '1px dashed',
                            borderColor: 'divider',
                            borderRadius: 3,
                            p: 2,
                            bgcolor: 'background.default'
                        }}
                    >
                        <Stack spacing={1.5}>
                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                alignItems={{ xs: 'flex-start', sm: 'center' }}
                                justifyContent="space-between"
                                spacing={1.5}
                            >
                                <Box>
                                    <Typography variant="subtitle1" fontWeight={800}>
                                        Mídias do post
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Você pode selecionar vários arquivos de uma vez.
                                    </Typography>
                                </Box>

                                <Button component="label" variant="contained" startIcon={<UploadFile />} sx={{ borderRadius: 999 }}>
                                    Selecionar arquivos
                                    <input ref={inputRef} hidden multiple type="file" onChange={handleFilesChange} />
                                </Button>
                            </Stack>

                            {!!files.length && (
                                <>
                                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                        <Chip label={`${files.length} arquivo(s)`} />
                                        <Chip label={formatBytes(totalBytes)} />
                                        <Chip color="primary" variant="outlined" label={`Custo estimado: ${estimatedTokens} token(s)`} />
                                    </Stack>

                                    <Stack spacing={1}>
                                        {files.map((file, index) => (
                                            <Box
                                                key={`${file.name}-${index}`}
                                                sx={{
                                                    p: 1.25,
                                                    borderRadius: 2,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    bgcolor: 'background.paper'
                                                }}
                                            >
                                                <Stack direction="row" spacing={1.25} alignItems="center">
                                                    {file.type?.startsWith('video/') ? (
                                                        <OndemandVideo fontSize="small" color="action" />
                                                    ) : (
                                                        <ImageOutlined fontSize="small" color="action" />
                                                    )}

                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                        <Typography variant="body2" fontWeight={700} noWrap>
                                                            {file.name}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {formatBytes(file.size)}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </Box>
                                        ))}
                                    </Stack>
                                </>
                            )}
                        </Stack>
                    </Box>
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={submitting}>
                    Cancelar
                </Button>
                <LoadingActionButton onClick={handleSubmit} loading={submitting} variant="contained">
                    Criar post
                </LoadingActionButton>
            </DialogActions>
        </Dialog>
    );
}

function EditPostDialog({ open, post, onClose, onSaved }) {
    const [form, setForm] = useState({
        internal_name: '',
        default_title: '',
        default_caption: '',
        tags: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (open && post) {
            setForm({
                internal_name: post.internal_name || '',
                default_title: post.default_title || '',
                default_caption: post.default_caption || '',
                tags: tagsToInput(post.tags)
            });
            setError('');
            setSubmitting(false);
        }
    }, [open, post]);

    const handleChange = (field) => (event) => {
        setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const handleSubmit = async () => {
        if (!post?.id) return;

        if (!form.internal_name.trim()) {
            setError('Informe o nome interno do post.');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const payload = {
                internal_name: form.internal_name.trim(),
                default_title: form.default_title.trim() || null,
                default_caption: form.default_caption.trim() || null,
                tags: JSON.stringify(normalizeTagsInput(form.tags))
            };

            await api.patch(`/posts/${post.id}`, payload);

            toast.success('Post atualizado com sucesso.');
            onSaved?.();
            onClose?.();
        } catch (err) {
            const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Não foi possível atualizar o post.';
            setError(message);
            toast.error('Erro ao atualizar post.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1.5 }}>
                <Stack spacing={0.25}>
                    <Typography variant="h4">Editar post</Typography>
                    <Typography variant="body2" color="text.secondary">
                        As mídias não podem ser alteradas depois do cadastro.
                    </Typography>
                </Stack>

                <IconButton onClick={onClose} disabled={submitting}>
                    <Close />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2.2}>
                    {error ? <Alert severity="error">{error}</Alert> : null}

                    <TextField label="Nome interno" value={form.internal_name} onChange={handleChange('internal_name')} fullWidth />

                    <TextField label="Título padrão" value={form.default_title} onChange={handleChange('default_title')} fullWidth />

                    <TextField
                        label="Legenda padrão"
                        value={form.default_caption}
                        onChange={handleChange('default_caption')}
                        multiline
                        minRows={5}
                        fullWidth
                    />

                    <TextField label="Tags" value={form.tags} onChange={handleChange('tags')} placeholder="#marketing, #instagram" fullWidth />

                    <Alert severity="info">
                        Este post possui <strong>{ensureArray(post?.media).length}</strong> mídia(s) cadastrada(s). A edição por esta tela altera apenas
                        os campos textuais, conforme a API.
                    </Alert>
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={submitting}>
                    Cancelar
                </Button>
                <LoadingActionButton onClick={handleSubmit} loading={submitting} variant="contained">
                    Salvar alterações
                </LoadingActionButton>
            </DialogActions>
        </Dialog>
    );
}

function DeletePostDialog({ open, post, onClose, onDeleted }) {
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        if (!post?.id) return;

        setLoading(true);
        try {
            const response = await api.delete(`/posts/${post.id}`);
            toast.success(response?.data?.message || 'Post deletado com sucesso.');
            onDeleted?.();
            onClose?.();
        } catch (err) {
            const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Não foi possível deletar o post.';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Excluir post</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={1}>
                    <Typography variant="body1">
                        Tem certeza que deseja excluir o post <strong>{post?.internal_name}</strong>?
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Essa ação remove o registro do post, as mídias no banco e os arquivos físicos no servidor.
                    </Typography>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={loading}>
                    Cancelar
                </Button>
                <LoadingActionButton color="error" variant="contained" onClick={handleDelete} loading={loading}>
                    Excluir
                </LoadingActionButton>
            </DialogActions>
        </Dialog>
    );
}

export default function Posts() {
    const theme = useTheme();
    const { posts, isLoading, refresh } = usePosts();

    const postsList = useMemo(() => ensureArray(posts), [posts]);

    const [search, setSearch] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    const [deletingPost, setDeletingPost] = useState(null);

    const [mediaMenuAnchor, setMediaMenuAnchor] = useState(null);
    const [mediaMenuPost, setMediaMenuPost] = useState(null);

    const filteredPosts = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return postsList;

        return postsList.filter((post) => {
            const source = [post.internal_name, post.default_title, post.default_caption, ...ensureArray(post.tags), post.post_type]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return source.includes(query);
        });
    }, [postsList, search]);

    const stats = useMemo(() => {
        const all = postsList;
        return {
            total: all.length,
            images: all.filter((item) => item.post_type === 'SINGLE_IMAGE').length,
            videos: all.filter((item) => item.post_type === 'SINGLE_VIDEO').length,
            carousels: all.filter((item) => item.post_type === 'CAROUSEL').length
        };
    }, [postsList]);

    const handleRefresh = async () => {
        try {
            await refresh?.();
            toast.success('Lista atualizada.');
        } catch {
            toast.error('Não foi possível atualizar a lista.');
        }
    };

    const openMediaMenu = (event, post) => {
        setMediaMenuAnchor(event.currentTarget);
        setMediaMenuPost(post);
    };

    const closeMediaMenu = () => {
        setMediaMenuAnchor(null);
        setMediaMenuPost(null);
    };

    return (
        <>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
                <MainCard
                    content={false}
                    sx={{
                        overflow: 'hidden',
                        borderRadius: 4,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: `linear-gradient(180deg, rgba(${theme.vars.palette.primary.mainChannel} / 0.04) 0%, ${theme.vars.palette.background.paper} 100%)`
                    }}
                >
                    <Box sx={{ p: { xs: 2, md: 3 } }}>
                        <Stack spacing={3}>
                            <Stack
                                direction={{ xs: 'column', md: 'row' }}
                                justifyContent="space-between"
                                alignItems={{ xs: 'flex-start', md: 'center' }}
                                spacing={2}
                            >
                                <Box>
                                    <Typography variant="h3" fontWeight={900}>
                                        Posts
                                    </Typography>
                                </Box>

                                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: { xs: '100%', md: 'auto' } }}>
                                    <TextField
                                        placeholder="Buscar posts..."
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        size="small"
                                        sx={{ minWidth: { xs: '100%', sm: 280 } }}
                                    />

                                    <Tooltip title="Atualizar">
                                        <IconButton onClick={handleRefresh}>
                                            <Refresh />
                                        </IconButton>
                                    </Tooltip>

                                    <Button startIcon={<Add />} variant="contained" onClick={() => setCreateOpen(true)}>
                                        Novo post
                                    </Button>
                                </Stack>
                            </Stack>

                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Box
                                        sx={{
                                            p: 2,
                                            borderRadius: 3,
                                            bgcolor: `rgba(${theme.vars.palette.primary.mainChannel} / 0.08)`,
                                            border: '1px solid',
                                            borderColor: `rgba(${theme.vars.palette.primary.mainChannel} / 0.14)`
                                        }}
                                    >
                                        <Typography variant="body2" color="text.secondary">
                                            Total
                                        </Typography>
                                        <Typography variant="h3" fontWeight={900}>
                                            {stats.total}
                                        </Typography>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} sm={6} md={3}>
                                    <Box
                                        sx={{
                                            p: 2,
                                            borderRadius: 3,
                                            bgcolor: `rgba(${theme.vars.palette.info.mainChannel} / 0.08)`,
                                            border: '1px solid',
                                            borderColor: `rgba(${theme.vars.palette.info.mainChannel} / 0.14)`
                                        }}
                                    >
                                        <Typography variant="body2" color="text.secondary">
                                            Imagem única
                                        </Typography>
                                        <Typography variant="h3" fontWeight={900}>
                                            {stats.images}
                                        </Typography>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} sm={6} md={3}>
                                    <Box
                                        sx={{
                                            p: 2,
                                            borderRadius: 3,
                                            bgcolor: `rgba(${theme.vars.palette.success.mainChannel} / 0.08)`,
                                            border: '1px solid',
                                            borderColor: `rgba(${theme.vars.palette.success.mainChannel} / 0.14)`
                                        }}
                                    >
                                        <Typography variant="body2" color="text.secondary">
                                            Vídeo único
                                        </Typography>
                                        <Typography variant="h3" fontWeight={900}>
                                            {stats.videos}
                                        </Typography>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} sm={6} md={3}>
                                    <Box
                                        sx={{
                                            p: 2,
                                            borderRadius: 3,
                                            bgcolor: `rgba(${theme.vars.palette.warning.mainChannel} / 0.08)`,
                                            border: '1px solid',
                                            borderColor: `rgba(${theme.vars.palette.warning.mainChannel} / 0.14)`
                                        }}
                                    >
                                        <Typography variant="body2" color="text.secondary">
                                            Carrossel
                                        </Typography>
                                        <Typography variant="h3" fontWeight={900}>
                                            {stats.carousels}
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>

                            {isLoading ? (
                                <Box
                                    sx={{
                                        py: 10,
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }}
                                >
                                    <CircularProgress />
                                </Box>
                            ) : filteredPosts.length ? (
                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 2,
                                        justifyContent: { xs: 'center', md: 'flex-start' }
                                    }}
                                >
                                    {filteredPosts.map((post) => (
                                        <InstagramLikeCard
                                            key={post.id}
                                            post={post}
                                            onEdit={setEditingPost}
                                            onDelete={setDeletingPost}
                                            onOpenMediaMenu={openMediaMenu}
                                        />
                                    ))}
                                </Box>
                            ) : (
                                <Box
                                    sx={{
                                        py: 8,
                                        px: 2,
                                        textAlign: 'center',
                                        borderRadius: 4,
                                        border: '1px dashed',
                                        borderColor: 'divider',
                                        bgcolor: 'action.hover'
                                    }}
                                >
                                    <PhotoLibrary sx={{ fontSize: 44, color: 'text.secondary', mb: 1 }} />
                                    <Typography variant="h4" fontWeight={800}>
                                        Nenhum post encontrado
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                                        Cadastre seu primeiro post ou ajuste a busca.
                                    </Typography>
                                    <Button sx={{ mt: 2 }} variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
                                        Criar primeiro post
                                    </Button>
                                </Box>
                            )}
                        </Stack>
                    </Box>
                </MainCard>
            </Box>

            <CreatePostDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />

            <EditPostDialog open={!!editingPost} post={editingPost} onClose={() => setEditingPost(null)} onSaved={refresh} />

            <DeletePostDialog open={!!deletingPost} post={deletingPost} onClose={() => setDeletingPost(null)} onDeleted={refresh} />

            <MediaQuickActionsMenu anchorEl={mediaMenuAnchor} open={!!mediaMenuAnchor} onClose={closeMediaMenu} post={mediaMenuPost} />
        </>
    );
}
