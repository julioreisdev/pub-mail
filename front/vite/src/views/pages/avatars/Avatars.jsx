import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    CardMedia,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    Skeleton,
    Stack,
    TextField,
    Tooltip,
    Typography,
    alpha,
    useTheme
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import ImageIcon from '@mui/icons-material/Image';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'; // <-- Ícone novo importado

// Ajuste os caminhos conforme o seu projeto
import MainCard from 'ui-component/cards/MainCard';
import { useAvatars } from '../../../hooks/useAvatars';
import { patch, post, remove } from '../../../api/api';

const getErrorMessage = (err, fallback = 'Ocorreu um erro') =>
    err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

// ==========================================
// COMPONENTES AUXILIARES
// ==========================================

function AvatarsSkeleton({ count = 8 }) {
    return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {Array.from({ length: count }).map((_, i) => (
                <Box
                    key={i}
                    sx={{
                        width: {
                            xs: '100%',
                            sm: 'calc(50% - 12px)',
                            md: 'calc(33.333% - 16px)',
                            lg: 'calc(25% - 18px)'
                        }
                    }}
                >
                    <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                        <Skeleton variant="rectangular" height={250} />
                        <CardContent>
                            <Skeleton variant="text" width="80%" height={32} />
                            <Skeleton variant="text" width="60%" />
                        </CardContent>
                        <CardActions sx={{ px: 2, pb: 2 }}>
                            <Skeleton variant="rounded" width={32} height={32} />
                            <Skeleton variant="rounded" width={32} height={32} />
                        </CardActions>
                    </Card>
                </Box>
            ))}
        </Box>
    );
}

function ConfirmDialog({ open, loading, title, description, onClose, onConfirm }) {
    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs">
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary">
                    {description}
                </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} disabled={loading} variant="outlined" sx={{ borderRadius: 2 }}>
                    Cancelar
                </Button>
                <Button
                    onClick={onConfirm}
                    disabled={loading}
                    color="error"
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={16} /> : <DeleteRoundedIcon fontSize="small" />}
                    sx={{ borderRadius: 2, fontWeight: 900 }}
                >
                    Excluir
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ==========================================
// MODAL DE CRIAÇÃO / EDIÇÃO (COM IA)
// ==========================================

function AvatarFormDialog({ open, mode, initialData, loading, error, onClose, onSubmit }) {
    const theme = useTheme();
    const isEdit = mode === 'edit';

    // Estados da Esquerda (Geral)
    const [name, setName] = useState('');
    const [mainPrompt, setMainPrompt] = useState('');
    const [personality, setPersonality] = useState('');
    const [colors, setColors] = useState('');

    // Estados da Direita (Geração e Refinamento)
    const [generatedImageUrl, setGeneratedImageUrl] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState('');
    const [refinePrompt, setRefinePrompt] = useState('');
    const [useAsBase, setUseAsBase] = useState(false);

    useEffect(() => {
        if (!open) return;

        setName(initialData?.name || '');
        setMainPrompt(initialData?.user_prompt || '');
        setPersonality(initialData?.personality || '');
        setColors(initialData?.default_colors ? initialData.default_colors.join(', ') : '');

        setGeneratedImageUrl(initialData?.avatar_image_url || '');
        setRefinePrompt('');
        setGenerationError('');
        setIsGenerating(false);
    }, [open, initialData]);

    const canSave = useMemo(() => {
        if (loading || isGenerating) return false;
        if (!name.trim()) return false;
        if (!generatedImageUrl) return false;
        return true;
    }, [loading, isGenerating, name, generatedImageUrl]);

    const canGenerate = useMemo(() => {
        if (isGenerating) return false;
        if (useAsBase && generatedImageUrl) {
            return refinePrompt.trim().length > 0;
        }
        return mainPrompt.trim().length > 0;
    }, [isGenerating, useAsBase, generatedImageUrl, refinePrompt, mainPrompt]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setGenerationError('');

        try {
            let payload = {
                is_realistic: true,
                personality: personality.trim() || undefined,
                colors: colors.trim() ? colors.split(',').map((c) => c.trim()) : undefined
            };

            if (useAsBase && generatedImageUrl) {
                payload.prompt = refinePrompt.trim();
                payload.lastGeneratedImage = generatedImageUrl;
            } else {
                payload.prompt = mainPrompt.trim();
            }

            const response = await post('/avatar-generations/generate', payload);

            setGeneratedImageUrl(response.data?.result_image_url || response.resultImageUrl);
            setRefinePrompt('');
        } catch (err) {
            setGenerationError(getErrorMessage(err, 'Falha ao gerar avatar. Verifique seus tokens.'));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = (e) => {
        e?.preventDefault?.();
        if (!canSave) return;

        onSubmit({
            name: name.trim(),
            avatar_image_url: generatedImageUrl,
            user_prompt: mainPrompt.trim(),
            personality: personality.trim() || undefined,
            default_colors: colors.trim() ? colors.split(',').map((c) => c.trim()) : undefined,
            is_realistic: true
        });
    };

    return (
        <Dialog open={open} onClose={loading || isGenerating ? undefined : onClose} fullWidth maxWidth="md">
            <DialogTitle sx={{ pb: 1.5 }}>{isEdit ? 'Editar Avatar' : 'Criar Novo Avatar'}</DialogTitle>
            <Divider />

            <DialogContent sx={{ p: 3, bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'grey.50' }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        gap: 4,
                        alignItems: 'flex-start'
                    }}
                >
                    {/* ======================================= */}
                    {/* COLUNA ESQUERDA: Configurações Base     */}
                    {/* ======================================= */}
                    <Box sx={{ flex: 1, width: '100%' }}>
                        <Stack spacing={2.5}>
                            <Typography variant="subtitle2" color="text.primary" fontWeight="bold">
                                Configurações Base
                            </Typography>

                            {error && (
                                <Alert severity="error" sx={{ py: 0 }}>
                                    {error}
                                </Alert>
                            )}
                            {generationError && (
                                <Alert severity="error" sx={{ py: 0 }}>
                                    {generationError}
                                </Alert>
                            )}

                            <TextField label="Nome do Avatar *" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" required />

                            <TextField
                                label="Prompt de Criação"
                                value={mainPrompt}
                                onChange={(e) => setMainPrompt(e.target.value)}
                                fullWidth
                                multiline
                                minRows={3}
                                size="small"
                            />

                            <TextField
                                label="Personalidade"
                                value={personality}
                                onChange={(e) => setPersonality(e.target.value)}
                                fullWidth
                                size="small"
                            />

                            <TextField
                                label="Cores Principais"
                                value={colors}
                                onChange={(e) => setColors(e.target.value)}
                                fullWidth
                                size="small"
                                helperText="Separe por vírgula. Pode usar nomes ou Hexadecimal."
                            />

                            {!useAsBase && (
                                <Button
                                    onClick={handleGenerate}
                                    disabled={!canGenerate}
                                    variant="contained"
                                    color="primary"
                                    startIcon={isGenerating ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighRoundedIcon />}
                                    sx={{ borderRadius: 2, py: 1, fontWeight: 'bold' }}
                                >
                                    Gerar Avatar Por IA
                                </Button>
                            )}
                        </Stack>
                    </Box>

                    {/* ======================================= */}
                    {/* COLUNA DIREITA: Preview e Refinamento   */}
                    {/* ======================================= */}
                    <Box sx={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Stack spacing={2.5} sx={{ width: '100%', maxWidth: 300, mx: 'auto' }}>
                            <Typography variant="subtitle2" color="text.primary" fontWeight="bold">
                                Visualização e Edição
                            </Typography>

                            {/* CAIXA DE IMAGEM */}
                            <Box
                                sx={{
                                    width: '100%',
                                    aspectRatio: '1 / 1',
                                    borderRadius: 2,
                                    border: generatedImageUrl ? 'none' : '2px dashed',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    boxShadow: generatedImageUrl ? theme.customShadows?.z1 || 1 : 0
                                }}
                            >
                                {isGenerating && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            inset: 0,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            bgcolor: alpha(theme.palette.background.paper, 0.7),
                                            zIndex: 10,
                                            backdropFilter: 'blur(4px)'
                                        }}
                                    >
                                        <CircularProgress color="secondary" size={40} thickness={4} />
                                        <Typography variant="body2" fontWeight="bold" sx={{ mt: 1.5, color: 'text.secondary' }}>
                                            Construindo...
                                        </Typography>
                                    </Box>
                                )}

                                {generatedImageUrl ? (
                                    <Box
                                        component="img"
                                        src={generatedImageUrl}
                                        alt="Avatar Preview"
                                        sx={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            display: 'block'
                                        }}
                                    />
                                ) : (
                                    <Stack alignItems="center" spacing={1} color="text.disabled">
                                        <ImageIcon sx={{ fontSize: 40, opacity: 0.5 }} />
                                        <Typography variant="body2">Nenhuma imagem gerada</Typography>
                                    </Stack>
                                )}
                            </Box>

                            {/* CONTROLES DE REFINAMENTO */}
                            <Stack
                                spacing={1.5}
                                sx={{
                                    opacity: generatedImageUrl ? 1 : 0.4,
                                    pointerEvents: generatedImageUrl ? 'auto' : 'none',
                                    transition: 'all 0.3s'
                                }}
                            >
                                <FormControlLabel
                                    control={<Checkbox checked={useAsBase} onChange={(e) => setUseAsBase(e.target.checked)} color="secondary" size="small" />}
                                    label={
                                        <Typography variant="body2" fontWeight="bold" color="text.secondary">
                                            Gerar a partir desse avatar
                                        </Typography>
                                    }
                                />

                                <TextField
                                    label="O que deseja alterar?"
                                    value={refinePrompt}
                                    onChange={(e) => setRefinePrompt(e.target.value)}
                                    fullWidth
                                    size="small"
                                    disabled={!useAsBase}
                                />

                                <Button
                                    onClick={handleGenerate}
                                    disabled={!canGenerate || !useAsBase || !refinePrompt}
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={isGenerating ? <CircularProgress size={16} /> : <AutoFixHighRoundedIcon />}
                                    sx={{ borderRadius: 2 }}
                                >
                                    Aplicar Mudança
                                </Button>
                            </Stack>
                        </Stack>
                    </Box>
                </Box>
            </DialogContent>

            <Divider />
            <DialogActions sx={{ p: 2, px: 3, bgcolor: 'background.paper' }}>
                <Button
                    onClick={onClose}
                    disabled={loading || isGenerating}
                    variant="text"
                    color="inherit"
                    sx={{ borderRadius: 2, fontWeight: 'bold' }}
                >
                    Cancelar
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={!canSave}
                    variant="contained"
                    sx={{
                        borderRadius: 2,
                        fontWeight: 900,
                        px: 3,
                        bgcolor: '#377EF0',
                        color: 'white',
                        '&:hover': { bgcolor: '#1e5dc8' }
                    }}
                    startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                >
                    {isEdit ? 'Salvar Alterações' : 'Salvar no Perfil'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ==========================================
// PÁGINA PRINCIPAL (GALERIA)
// ==========================================

export default function AvataresPage() {
    const { avatars, isLoading, error, mutate, refresh } = useAvatars();

    // Estados do Modal
    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState('create');
    const [formData, setFormData] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState('');

    // Estados de Exclusão
    const [pendingDelete, setPendingDelete] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const list = useMemo(() => (Array.isArray(avatars) ? avatars : []), [avatars]);

    const handleOpenCreate = () => {
        setActionError('');
        setFormMode('create');
        setFormData(null);
        setFormOpen(true);
    };

    const handleOpenEdit = (avatar) => {
        setActionError('');
        setFormMode('edit');
        setFormData(avatar);
        setFormOpen(true);
    };

    const handleSubmit = async (payload) => {
        setActionLoading(true);
        setActionError('');
        try {
            if (formMode === 'create') {
                await post('/avatars', payload);
            } else {
                await patch(`/avatars/${formData?.id}`, payload);
            }
            await mutate();
            setFormOpen(false);
        } catch (err) {
            setActionError(getErrorMessage(err, 'Falha ao salvar avatar.'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!pendingDelete?.id) return;
        setActionLoading(true);
        setActionError('');
        try {
            await remove(`/avatars/${pendingDelete.id}`);
            await mutate();
            setConfirmOpen(false);
            setPendingDelete(null);
        } catch (err) {
            setActionError(getErrorMessage(err, 'Falha ao excluir avatar.'));
        } finally {
            setActionLoading(false);
        }
    };

    // Função para forçar o download da imagem de forma nativa
    const handleDownload = async (avatar) => {
        if (!avatar?.avatar_image_url) return;

        try {
            const response = await fetch(avatar.avatar_image_url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.style.display = 'none';
            link.href = url;

            // Formata o nome do arquivo para algo seguro
            const safeName = avatar.name ? avatar.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'avatar';
            link.download = `${safeName}.png`;

            document.body.appendChild(link);
            link.click();

            // Limpa o objeto da memória
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
        } catch (err) {
            console.error('Erro ao realizar o download da imagem', err);
            setActionError('Não foi possível baixar a imagem no momento.');
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
                {/* HEADER */}
                <Box
                    sx={{
                        px: 3,
                        py: 2.5,
                        display: 'flex',
                        alignItems: { xs: 'stretch', sm: 'center' },
                        justifyContent: 'space-between',
                        gap: 2,
                        flexDirection: { xs: 'column', sm: 'row' }
                    }}
                >
                    <Box>
                        <Typography variant="h4" fontWeight="900" gutterBottom>
                            Galeria de Avatares
                        </Typography>
                    </Box>

                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Tooltip title="Atualizar Galeria">
                            <span>
                                <IconButton
                                    onClick={refresh}
                                    disabled={isLoading || actionLoading}
                                    sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
                                >
                                    <RefreshRoundedIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Button
                            onClick={handleOpenCreate}
                            variant="contained"
                            color="primary"
                            startIcon={<AutoFixHighRoundedIcon />}
                            sx={{ borderRadius: 2, fontWeight: 900, px: 3 }}
                            disabled={actionLoading}
                        >
                            Novo Avatar
                        </Button>
                    </Stack>
                </Box>

                <Divider />

                {/* CONTEÚDO (LISTA DE CARDS) */}
                <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '60vh' }}>
                    <Stack spacing={2}>
                        {error ? <Alert severity="error">{getErrorMessage(error, 'Falha ao carregar avatares.')}</Alert> : null}
                        {actionError ? (
                            <Alert severity="error" onClose={() => setActionError('')}>
                                {actionError}
                            </Alert>
                        ) : null}

                        {isLoading ? (
                            <AvatarsSkeleton />
                        ) : list.length === 0 ? (
                            <Box
                                sx={{
                                    p: 6,
                                    borderRadius: 3,
                                    border: '1px dashed',
                                    borderColor: 'divider',
                                    textAlign: 'center',
                                    bgcolor: 'background.paper',
                                    mt: 2
                                }}
                            >
                                <AutoFixHighRoundedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                                <Typography variant="h6" sx={{ mb: 1 }}>
                                    Nenhum avatar criado ainda
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    Use nossa IA avançada para gerar fotos hiper-realistas para seus projetos.
                                </Typography>
                                <Button onClick={handleOpenCreate} variant="outlined" color="primary" sx={{ borderRadius: 2, fontWeight: 'bold' }}>
                                    Começar a Criar
                                </Button>
                            </Box>
                        ) : (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                {list.map((avatar) => (
                                    <Box
                                        key={avatar.id}
                                        sx={{
                                            width: {
                                                xs: '100%',
                                                sm: 'calc(50% - 12px)',
                                                md: 'calc(33.333% - 16px)',
                                                lg: 'calc(25% - 18px)'
                                            }
                                        }}
                                    >
                                        <Card
                                            sx={{
                                                height: '100%',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                borderRadius: 3,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                                                transition: 'transform 0.2s',
                                                '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }
                                            }}
                                        >
                                            <CardMedia
                                                component="img"
                                                height="260"
                                                image={avatar.avatar_image_url}
                                                alt={avatar.name}
                                                sx={{ objectFit: 'cover' }}
                                            />
                                            <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                                                <Typography variant="h6" fontWeight="bold" noWrap title={avatar.name}>
                                                    {avatar.name}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mt: 0.5 }}
                                                >
                                                    {avatar.user_prompt || 'Nenhum prompt salvo'}
                                                </Typography>
                                            </CardContent>
                                            <Divider sx={{ mx: 2 }} />

                                            {/* BARRA DE AÇÕES DOS CARDS (Editar, Baixar, Excluir) */}
                                            <CardActions sx={{ px: 2, py: 1.5, justifyContent: 'space-between' }}>
                                                {/* Agrupamento Esquerdo */}
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <Tooltip title="Editar Detalhes">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenEdit(avatar)}
                                                            disabled={actionLoading}
                                                            sx={{ bgcolor: 'action.hover' }}
                                                        >
                                                            <EditRoundedIcon fontSize="small" color="primary" />
                                                        </IconButton>
                                                    </Tooltip>

                                                    {/* NOVO BOTÃO DE DOWNLOAD */}
                                                    <Tooltip title="Baixar Avatar">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleDownload(avatar)}
                                                            disabled={actionLoading}
                                                            sx={{ bgcolor: 'action.hover' }}
                                                        >
                                                            <DownloadRoundedIcon fontSize="small" color="primary" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>

                                                {/* Agrupamento Direito */}
                                                <Tooltip title="Excluir Definitivamente">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        disabled={actionLoading}
                                                        onClick={() => {
                                                            setPendingDelete(avatar);
                                                            setConfirmOpen(true);
                                                        }}
                                                    >
                                                        <DeleteRoundedIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </CardActions>
                                        </Card>
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Stack>
                </Box>
            </MainCard>

            {/* Modais */}
            <AvatarFormDialog
                open={formOpen}
                mode={formMode}
                initialData={formData}
                loading={actionLoading}
                error={actionError}
                onClose={() => (actionLoading ? null : setFormOpen(false))}
                onSubmit={handleSubmit}
            />

            <ConfirmDialog
                open={confirmOpen}
                loading={actionLoading}
                title="Excluir Avatar?"
                description={`Tem certeza que deseja excluir permanentemente o avatar "${pendingDelete?.name || ''}"? Esta ação não pode ser desfeita.`}
                onClose={() => (actionLoading ? null : setConfirmOpen(false))}
                onConfirm={handleDelete}
            />
        </Box>
    );
}
