import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Autocomplete,
    Avatar,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    MenuItem,
    Stack,
    Tab,
    Tabs,
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
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import OndemandVideoOutlinedIcon from '@mui/icons-material/OndemandVideoOutlined';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import YouTubeIcon from '@mui/icons-material/YouTube';
import InstagramIcon from '@mui/icons-material/Instagram';
import { IconBrandTiktokFilled } from '@tabler/icons-react';
import toast from 'react-hot-toast';

import MainCard from 'ui-component/cards/MainCard';
import usePosts from '../../../hooks/usePosts';
import useSocialAccounts from '../../../hooks/useSocialAccounts';
import useSocialPostSchedules from '../../../hooks/useSocialPostSchedules';
import useSocialPostScheduleRuns from '../../../hooks/useSocialPostScheduleRuns';
import useSocialPostSchedulesMeta from '../../../hooks/useSocialPostSchedulesMeta';
import useSocialPostDailyLimits from '../../../hooks/useSocialPostDailyLimits';
import { get as getRequest, post as postRequest, put as putRequest, remove as removeRequest } from '../../../api/api';

const UPLOADS_BASE_URL = `${import.meta.env.VITE_API_URL}/uploads`;

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
    const value = String(hour).padStart(2, '0');
    return { value: `${value}:00`, label: `${value}:00` };
});

const NETWORK_ORDER = ['TIKTOK', 'YOUTUBE', 'INSTAGRAM'];
const SCHEDULE_STATUS_VALUES = ['SCHEDULED', 'PROCESSING', 'FAILED', 'CANCELED'];
const RUN_STATUS_VALUES = ['PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED'];

const NETWORK_CONFIG = {
    TIKTOK: {
        id: 'TIKTOK',
        label: 'TikTok',
        buttonLabel: 'Agendar post no TikTok',
        iaLabel: 'Conteúdo de IA',
        color: '#111111',
        buttonBackground: 'linear-gradient(120deg, #ff0050 0%, #00f2ea 52%, #000000 100%)',
        buttonTextColor: '#ffffff',
        defaultPayload: {
            title: '',
            caption: '',
            privacy_level: '',
            allow_comment: false,
            allow_duet: false,
            allow_stitch: false,
            commercial_content_enabled: false,
            brand_organic_toggle: false,
            brand_content_toggle: false
        }
    },
    YOUTUBE: {
        id: 'YOUTUBE',
        label: 'YouTube',
        buttonLabel: 'Agendar post no Youtube',
        iaLabel: 'Conteúdo alterado por IA',
        color: '#FF0000',
        buttonBackground: '#ff0000',
        buttonTextColor: '#ffffff',
        defaultPayload: { title: '', description: '', is_shorts: true }
    },
    INSTAGRAM: {
        id: 'INSTAGRAM',
        label: 'Instagram',
        buttonLabel: 'Agendar post no Instagram',
        iaLabel: 'Feito com IA',
        color: '#E1306C',
        buttonBackground: 'linear-gradient(115deg, #f58529 0%, #dd2a7b 38%, #8134af 68%, #515bd4 100%)',
        buttonTextColor: '#ffffff',
        defaultPayload: { caption: '', publish_mode: 'FEED' }
    }
};

function currentLocalDateISO() {
    const now = new Date();
    const timezoneOffsetInMs = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - timezoneOffsetInMs).toISOString().slice(0, 10);
}

function startOfMonthLocalISO() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return toDateInputValue(firstDay);
}

function normalizeDateFilterMask(rawValue) {
    const digits = String(rawValue || '')
        .replace(/\D/g, '')
        .slice(0, 6);

    if (!digits) return '';
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 6)}`;
}

function formatFilterDateDisplayFromIso(isoDate) {
    const normalized = String(isoDate || '').trim();
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';

    const yy = match[1].slice(-2);
    const mm = match[2];
    const dd = match[3];
    return `${dd}/${mm}/${yy}`;
}

function formatFilterDateDisplayFromDate(date) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
}

function parseFilterDateInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const year = Number(isoMatch[1]);
        const month = Number(isoMatch[2]);
        const day = Number(isoMatch[3]);
        const parsed = new Date(year, month - 1, day);
        if (
            parsed.getFullYear() === year &&
            parsed.getMonth() === month - 1 &&
            parsed.getDate() === day
        ) {
            return parsed;
        }
        return null;
    }

    const shortMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (!shortMatch) return null;

    const day = Number(shortMatch[1]);
    const month = Number(shortMatch[2]);
    const year = 2000 + Number(shortMatch[3]);
    const parsed = new Date(year, month - 1, day);

    if (
        parsed.getFullYear() === year &&
        parsed.getMonth() === month - 1 &&
        parsed.getDate() === day
    ) {
        return parsed;
    }

    return null;
}

const TODAY_ISO = currentLocalDateISO();
const START_OF_MONTH_ISO = startOfMonthLocalISO();

function toDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toHourInputValue(date) {
    return `${String(date.getHours()).padStart(2, '0')}:00`;
}

function getDefaultScheduleSlot() {
    const nextHour = new Date();
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);

    return {
        scheduledDate: toDateInputValue(nextHour),
        scheduledHour: toHourInputValue(nextHour)
    };
}

const SCHEDULE_STATUS_META = {
    SCHEDULED: { label: 'Agendado', color: 'info', icon: <ScheduleRoundedIcon sx={{ fontSize: 16 }} /> },
    PROCESSING: { label: 'Processando', color: 'warning', icon: <AutorenewRoundedIcon sx={{ fontSize: 16 }} /> },
    SENT: { label: 'Enviado', color: 'success', icon: <CheckCircleRoundedIcon sx={{ fontSize: 16 }} /> },
    FAILED: { label: 'Falhou', color: 'error', icon: <ErrorOutlineRoundedIcon sx={{ fontSize: 16 }} /> },
    CANCELED: { label: 'Cancelado', color: 'default', icon: <ErrorOutlineRoundedIcon sx={{ fontSize: 16 }} /> }
};

const RUN_STATUS_META = {
    PROCESSING: { label: 'Processando', color: 'warning', icon: <AutorenewRoundedIcon sx={{ fontSize: 16 }} /> },
    COMPLETED: { label: 'Concluído', color: 'success', icon: <CheckCircleRoundedIcon sx={{ fontSize: 16 }} /> },
    FAILED: { label: 'Falhou', color: 'error', icon: <ErrorOutlineRoundedIcon sx={{ fontSize: 16 }} /> },
    CANCELED: { label: 'Cancelado', color: 'default', icon: <ErrorOutlineRoundedIcon sx={{ fontSize: 16 }} /> }
};

const INITIAL_FILTERS = {
    status: 'ALL',
    from: formatFilterDateDisplayFromIso(START_OF_MONTH_ISO),
    to: formatFilterDateDisplayFromIso(TODAY_ISO)
};

const INITIAL_DRAFT = {
    selectedSocialAccountId: '',
    selectedPostId: '',
    aiContent: false,
    ...getDefaultScheduleSlot(),
    platformPayload: {}
};

const INVALID_SCHEDULE_HOUR_MESSAGE = 'Erro: Horário inválido. Escolha um horário válido.';

function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
    return [];
}

function normalizePostTags(tags) {
    return ensureArray(tags)
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .map((item) => (item.startsWith('#') ? item : `#${item}`));
}

function mergeCaptionWithTags(baseCaption, tags) {
    const normalizedTags = normalizePostTags(tags);
    if (!normalizedTags.length) return (baseCaption || '').trim();

    const caption = (baseCaption || '').trim();
    if (!caption) return normalizedTags.join(' ');

    const existingTokens = new Set(caption.split(/\s+/).map((token) => token.trim().toLowerCase()));
    const tagsToAppend = normalizedTags.filter((tag) => !existingTokens.has(tag.toLowerCase()));

    if (!tagsToAppend.length) return caption;
    return `${caption}\n\n${tagsToAppend.join(' ')}`;
}

function mediaUrl(storageKey) {
    return `${UPLOADS_BASE_URL}/${storageKey}`;
}

function formatDateTime(value) {
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

function postTypeLabel(postType) {
    if (postType === 'SINGLE_IMAGE') return 'Imagem única';
    if (postType === 'SINGLE_VIDEO') return 'Vídeo único';
    if (postType === 'CAROUSEL') return 'Carrossel';
    return postType || '-';
}

function isVideoMedia(media) {
    return media?.media_type === 'VIDEO' || media?.mime_type?.startsWith('video/');
}

function networkMeta(network) {
    return NETWORK_CONFIG[network] || {
        id: network,
        label: network || '-',
        buttonLabel: network || '-',
        iaLabel: 'Conteúdo de IA',
        color: '#111111',
        defaultPayload: {}
    };
}

function socialAccountDisplay(account) {
    if (!account) return '-';
    return account.display_name || 'Conta sem nome';
}

function socialAccountAvatarUrl(account) {
    const value = String(account?.profile_image_url || '').trim();
    return value || '';
}

function socialAccountInitial(account) {
    const name = socialAccountDisplay(account);
    const first = String(name || '').trim().charAt(0);
    return (first || '?').toUpperCase();
}

function SocialAccountIdentity({
    account,
    network,
    showNetworkIcon = false,
    avatarSize = 22,
    textVariant = 'subtitle2',
    textColor = 'text.primary',
    fontWeight = 700,
    noWrap = false
}) {
    return (
        <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0 }}>
            {showNetworkIcon ? <NetworkIcon network={network || account?.social_network} size={16} /> : null}
            <Avatar
                src={socialAccountAvatarUrl(account)}
                alt={socialAccountDisplay(account)}
                sx={{ width: avatarSize, height: avatarSize, fontSize: Math.max(10, Math.floor(avatarSize * 0.52)) }}
            >
                {socialAccountInitial(account)}
            </Avatar>
            <Typography variant={textVariant} sx={{ fontWeight, minWidth: 0 }} color={textColor} noWrap={noWrap}>
                {socialAccountDisplay(account)}
            </Typography>
        </Stack>
    );
}

function formatCountdown(totalSeconds) {
    const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hh = String(Math.floor(safe / 3600)).padStart(2, '0');
    const mm = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
    const ss = String(safe % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

function getSecondsUntilNextUtcReset(nowMs) {
    const now = new Date(nowMs);
    const nextUtcMidnight = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0
    );
    return Math.max(0, Math.floor((nextUtcMidnight - now.getTime()) / 1000));
}

function resolvePostMediaKind(post) {
    const media = ensureArray(post?.media);
    const hasVideo = media.some((item) => isVideoMedia(item));
    const hasImage = media.some((item) => !isVideoMedia(item));
    if (hasVideo && hasImage) return 'MIXED';
    if (hasVideo) return 'VIDEO';
    if (hasImage) return media.length > 1 ? 'CAROUSEL' : 'PHOTO';
    return 'EMPTY';
}

function resolveFirstVideoDurationSec(post) {
    const media = ensureArray(post?.media).find((item) => isVideoMedia(item));
    const duration = Number(media?.duration_sec);
    if (!Number.isFinite(duration) || duration <= 0) return null;
    return Math.floor(duration);
}

function normalizeTikTokPrivacyLevel(value) {
    const raw = String(value || '')
        .trim()
        .toUpperCase();

    if (!raw) return '';
    if (raw === 'PRIVATE') return 'SELF_ONLY';
    if (raw === 'PUBLIC') return 'PUBLIC_TO_EVERYONE';
    if (raw === 'FRIENDS') return 'MUTUAL_FOLLOW_FRIENDS';
    if (raw === 'FOLLOWERS') return 'FOLLOWER_OF_CREATOR';
    return raw;
}

function tiktokPrivacyLabel(value) {
    const normalized = normalizeTikTokPrivacyLevel(value);
    if (normalized === 'PUBLIC_TO_EVERYONE') return 'Público';
    if (normalized === 'MUTUAL_FOLLOW_FRIENDS') return 'Apenas Amigos';
    if (normalized === 'FOLLOWER_OF_CREATOR') return 'Seguidores do criador';
    if (normalized === 'SELF_ONLY') return 'Privado';
    return normalized || '-';
}

function isTikTokPrivatePrivacy(value) {
    return normalizeTikTokPrivacyLevel(value) === 'SELF_ONLY';
}

function isTikTokCommercialDisclosureInvalid(payload) {
    const isEnabled = Boolean(payload?.commercial_content_enabled);
    if (!isEnabled) return false;
    return !Boolean(payload?.brand_organic_toggle) && !Boolean(payload?.brand_content_toggle);
}

function resolveTikTokDisclosureSummary(payload) {
    const isEnabled = Boolean(payload?.commercial_content_enabled);
    if (!isEnabled) return '';

    const brandOrganic = Boolean(payload?.brand_organic_toggle);
    const brandContent = Boolean(payload?.brand_content_toggle);

    if (brandContent) {
        return "Sua foto/vídeo será rotulada como 'Parceria paga'.";
    }

    if (brandOrganic) {
        return "Sua foto/vídeo será rotulada como 'Conteúdo promocional'.";
    }

    return '';
}

function resolveTikTokComplianceText(payload) {
    const isEnabled = Boolean(payload?.commercial_content_enabled);
    const brandContent = Boolean(payload?.brand_content_toggle);

    if (isEnabled && brandContent) {
        return "Ao publicar, você concorda com a Política de Conteúdo de Marca e com a Confirmação de Uso de Música do TikTok.";
    }

    return 'Ao publicar, você concorda com a Confirmação de Uso de Música do TikTok.';
}

function mapDispatchErrorMessage(rawMessage) {
    const text = String(rawMessage || '').trim();
    if (!text) return 'Não foi possível disparar o agendamento agora.';

    if (
        /conta social indispon[ií]vel|desconectad|sem access token|access token tiktok inv[aá]lido|refresh token do tiktok indispon[ií]vel|access_token_invalid/i.test(
            text
        )
    ) {
        return 'A conta do TikTok parece desconectada ou sem permissão válida. Reconecte a conta e tente novamente.';
    }

    return text;
}

function normalizeDateRange(from, to) {
    const result = {};

    if (from) {
        const fromDate = parseFilterDateInput(from);
        if (fromDate && !Number.isNaN(fromDate.getTime())) {
            fromDate.setHours(0, 0, 0, 0);
            result.from = fromDate.toISOString();
        }
    }

    if (to) {
        const toDate = parseFilterDateInput(to);
        if (toDate && !Number.isNaN(toDate.getTime())) {
            toDate.setHours(23, 59, 59, 999);
            result.to = toDate.toISOString();
        }
    }

    return result;
}

function toLocalDateInputValue(value) {
    if (!value) return TODAY_ISO;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return TODAY_ISO;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function toLocalHourInputValue(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getHours()).padStart(2, '0')}:00`;
}

function NetworkIcon({ network, size = 16 }) {
    if (network === 'TIKTOK') {
        return <IconBrandTiktokFilled size={size + 2} stroke={1.8} />;
    }

    if (network === 'YOUTUBE') {
        return <YouTubeIcon sx={{ fontSize: size + 4 }} />;
    }

    if (network === 'INSTAGRAM') {
        return <InstagramIcon sx={{ fontSize: size + 3 }} />;
    }

    return <CalendarMonthOutlinedIcon sx={{ fontSize: size + 2 }} />;
}

function StatusChip({ status, type = 'schedule' }) {
    const meta =
        type === 'run'
            ? RUN_STATUS_META[status] || RUN_STATUS_META.FAILED
            : SCHEDULE_STATUS_META[status] || SCHEDULE_STATUS_META.FAILED;

    const isProcessing = String(status || '').toUpperCase() === 'PROCESSING';

    return (
        <Chip
            size="small"
            color={meta.color}
            icon={meta.icon}
            label={meta.label}
            sx={{
                borderRadius: 2,
                fontWeight: 800,
                ...(isProcessing
                    ? {
                          '& .MuiChip-icon': {
                              animation: 'status-chip-spin 1.05s linear infinite'
                          },
                          '@keyframes status-chip-spin': {
                              from: { transform: 'rotate(0deg)' },
                              to: { transform: 'rotate(360deg)' }
                          }
                      }
                    : {})
            }}
        />
    );
}

function MediaThumb({ media, size = 48 }) {
    if (!media?.storage_key) {
        return (
            <Box
                sx={{
                    width: size,
                    height: size,
                    borderRadius: 1.2,
                    bgcolor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <ImageOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            </Box>
        );
    }

    const previewUrl = mediaUrl(media.storage_key);

    if (isVideoMedia(media)) {
        return (
            <Box sx={{ position: 'relative', width: size, height: size, borderRadius: 1.2, overflow: 'hidden', bgcolor: '#0b0f19' }}>
                <Box
                    component="video"
                    src={previewUrl}
                    muted
                    playsInline
                    preload="metadata"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(0,0,0,0.22)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <OndemandVideoOutlinedIcon sx={{ color: 'common.white', fontSize: 16 }} />
                </Box>
            </Box>
        );
    }

    return (
        <Box
            component="img"
            src={previewUrl}
            alt={media.original_name || 'Prévia'}
            sx={{ width: size, height: size, borderRadius: 1.2, objectFit: 'cover', display: 'block' }}
        />
    );
}

function buildPlatformPayload(network, draft) {
    if (network === 'TIKTOK') {
        return {
            title: draft.platformPayload?.title || '',
            caption: draft.platformPayload?.caption || '',
            privacy_level: draft.platformPayload?.privacy_level || '',
            allow_comment: Boolean(draft.platformPayload?.allow_comment),
            allow_duet: Boolean(draft.platformPayload?.allow_duet),
            allow_stitch: Boolean(draft.platformPayload?.allow_stitch),
            commercial_content_enabled: Boolean(draft.platformPayload?.commercial_content_enabled),
            brand_organic_toggle: Boolean(draft.platformPayload?.brand_organic_toggle),
            brand_content_toggle: Boolean(draft.platformPayload?.brand_content_toggle)
        };
    }

    if (network === 'YOUTUBE') {
        return {
            title: draft.platformPayload?.title || '',
            description: draft.platformPayload?.description || '',
            is_shorts: Boolean(draft.platformPayload?.is_shorts)
        };
    }

    if (network === 'INSTAGRAM') {
        return {
            caption: draft.platformPayload?.caption || '',
            publish_mode: draft.platformPayload?.publish_mode || 'FEED'
        };
    }

    return draft.platformPayload || {};
}

function NetworkSpecificFields({
    network,
    draft,
    setDraft,
    selectedPost,
    tiktokCreatorInfo,
    isTikTokCreatorInfoLoading
}) {
    if (network === 'TIKTOK') {
        const privacyOptions = ensureArray(tiktokCreatorInfo?.privacy_level_options);
        const postMediaKind = resolvePostMediaKind(selectedPost);
        const isPhotoPost = postMediaKind === 'PHOTO' || postMediaKind === 'CAROUSEL';
        const commentLockedByCreator = Boolean(tiktokCreatorInfo?.comment_disabled);
        const duetLockedByCreator = Boolean(tiktokCreatorInfo?.duet_disabled) || isPhotoPost;
        const stitchLockedByCreator = Boolean(tiktokCreatorInfo?.stitch_disabled) || isPhotoPost;
        const commercialDisclosureEnabled = Boolean(draft.platformPayload?.commercial_content_enabled);
        const brandOrganicToggle = Boolean(draft.platformPayload?.brand_organic_toggle);
        const brandContentToggle = Boolean(draft.platformPayload?.brand_content_toggle);
        const isPrivateVisibility = isTikTokPrivatePrivacy(draft.platformPayload?.privacy_level);
        const disclosureSummary = resolveTikTokDisclosureSummary(draft.platformPayload);
        const complianceText = resolveTikTokComplianceText(draft.platformPayload);
        const disclosureSelectionInvalid = isTikTokCommercialDisclosureInvalid(draft.platformPayload);

        return (
            <Stack spacing={1.2}>
                <TextField
                    label="Título no TikTok"
                    value={draft.platformPayload?.title || ''}
                    onChange={(event) =>
                        setDraft((prev) => ({
                            ...prev,
                            platformPayload: { ...prev.platformPayload, title: event.target.value }
                        }))
                    }
                    fullWidth
                />

                <TextField
                    label="Descrição no TikTok"
                    value={draft.platformPayload?.caption || ''}
                    onChange={(event) =>
                        setDraft((prev) => ({
                            ...prev,
                            platformPayload: { ...prev.platformPayload, caption: event.target.value }
                        }))
                    }
                    fullWidth
                    multiline
                    minRows={2}
                />

                <TextField
                    select
                    label="Privacidade"
                    value={draft.platformPayload?.privacy_level || ''}
                    onChange={(event) =>
                        setDraft((prev) => ({
                            ...prev,
                            platformPayload: { ...prev.platformPayload, privacy_level: event.target.value }
                        }))
                    }
                    disabled={isTikTokCreatorInfoLoading || privacyOptions.length === 0}
                    helperText={
                        isTikTokCreatorInfoLoading
                            ? 'Carregando opções da conta TikTok...'
                            : privacyOptions.length === 0
                              ? 'Conecte uma conta TikTok válida para carregar as opções.'
                              : brandContentToggle
                                ? 'Selecione manualmente a privacidade permitida para esta conta. A opção "Somente eu" fica indisponível com conteúdo de marca.'
                                : 'Selecione manualmente a privacidade permitida para esta conta.'
                    }
                    fullWidth
                >
                    <MenuItem value="" disabled>
                        Selecione a privacidade
                    </MenuItem>
                    {privacyOptions.map((option) => (
                        <MenuItem
                            key={option}
                            value={option}
                            disabled={brandContentToggle && isTikTokPrivatePrivacy(option)}
                        >
                            {tiktokPrivacyLabel(option)}
                        </MenuItem>
                    ))}
                </TextField>

                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.6 }}>
                        Interações
                    </Typography>
                    <Stack spacing={0.2}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={Boolean(draft.platformPayload?.allow_comment)}
                                    onChange={(event) =>
                                        setDraft((prev) => ({
                                            ...prev,
                                            platformPayload: { ...prev.platformPayload, allow_comment: event.target.checked }
                                        }))
                                    }
                                    disabled={commentLockedByCreator || isTikTokCreatorInfoLoading}
                                />
                            }
                            label="Allow Comment"
                        />

                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={Boolean(draft.platformPayload?.allow_duet)}
                                    onChange={(event) =>
                                        setDraft((prev) => ({
                                            ...prev,
                                            platformPayload: { ...prev.platformPayload, allow_duet: event.target.checked }
                                        }))
                                    }
                                    disabled={duetLockedByCreator || isTikTokCreatorInfoLoading}
                                />
                            }
                            label="Allow Duet"
                        />

                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={Boolean(draft.platformPayload?.allow_stitch)}
                                    onChange={(event) =>
                                        setDraft((prev) => ({
                                            ...prev,
                                            platformPayload: { ...prev.platformPayload, allow_stitch: event.target.checked }
                                        }))
                                    }
                                    disabled={stitchLockedByCreator || isTikTokCreatorInfoLoading}
                                />
                            }
                            label="Allow Stitch"
                        />
                    </Stack>

                    {isPhotoPost ? (
                        <Typography variant="caption" color="text.secondary">
                            Para posts com foto/carrossel, Duet e Stitch não se aplicam e permanecem desativados.
                        </Typography>
                    ) : null}
                </Box>

                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.6 }}>
                        Divulgação de conteúdo comercial
                    </Typography>

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={commercialDisclosureEnabled}
                                onChange={(event) =>
                                    setDraft((prev) => {
                                        const enabled = event.target.checked;
                                        return {
                                            ...prev,
                                            platformPayload: {
                                                ...prev.platformPayload,
                                                commercial_content_enabled: enabled,
                                                brand_organic_toggle: enabled ? Boolean(prev.platformPayload?.brand_organic_toggle) : false,
                                                brand_content_toggle: enabled ? Boolean(prev.platformPayload?.brand_content_toggle) : false
                                            }
                                        };
                                    })
                                }
                                disabled={isTikTokCreatorInfoLoading}
                            />
                        }
                        label="Este conteúdo promove você, uma marca, produto ou serviço"
                    />

                    {commercialDisclosureEnabled ? (
                        <Stack spacing={0.2} sx={{ ml: 0.5 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={brandOrganicToggle}
                                        onChange={(event) =>
                                            setDraft((prev) => ({
                                                ...prev,
                                                platformPayload: {
                                                    ...prev.platformPayload,
                                                    brand_organic_toggle: event.target.checked
                                                }
                                            }))
                                        }
                                        disabled={isTikTokCreatorInfoLoading}
                                    />
                                }
                                label="Sua marca"
                            />

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={brandContentToggle}
                                        onChange={(event) =>
                                            setDraft((prev) => ({
                                                ...prev,
                                                platformPayload: {
                                                    ...prev.platformPayload,
                                                    brand_content_toggle: event.target.checked
                                                }
                                            }))
                                        }
                                        disabled={isTikTokCreatorInfoLoading || isPrivateVisibility}
                                    />
                                }
                                label="Conteúdo de marca"
                            />

                            {isPrivateVisibility ? (
                                <Typography variant="caption" color="text.secondary">
                                    A visibilidade de conteúdo de marca não pode ser privada.
                                </Typography>
                            ) : null}

                            {disclosureSummary ? (
                                <Typography variant="caption" color="text.secondary">
                                    {disclosureSummary}
                                </Typography>
                            ) : null}
                        </Stack>
                    ) : null}

                    {disclosureSelectionInvalid ? (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                            Você precisa indicar se seu conteúdo promove você, terceiros ou ambos.
                        </Alert>
                    ) : null}

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        {complianceText}
                    </Typography>
                </Box>
            </Stack>
        );
    }

    if (network === 'YOUTUBE') {
        return (
            <Stack spacing={1.2}>
                <TextField
                    label="Título no YouTube"
                    value={draft.platformPayload?.title || ''}
                    onChange={(event) =>
                        setDraft((prev) => ({
                            ...prev,
                            platformPayload: { ...prev.platformPayload, title: event.target.value }
                        }))
                    }
                    fullWidth
                />

                <TextField
                    label="Descrição no YouTube"
                    value={draft.platformPayload?.description || ''}
                    onChange={(event) =>
                        setDraft((prev) => ({
                            ...prev,
                            platformPayload: { ...prev.platformPayload, description: event.target.value }
                        }))
                    }
                    fullWidth
                    multiline
                    minRows={2}
                />

                <FormControlLabel
                    control={
                        <Checkbox
                            checked={Boolean(draft.platformPayload?.is_shorts)}
                            onChange={(event) =>
                                setDraft((prev) => ({
                                    ...prev,
                                    platformPayload: { ...prev.platformPayload, is_shorts: event.target.checked }
                                }))
                            }
                        />
                    }
                    label="Publicar como Shorts"
                />
            </Stack>
        );
    }

    if (network === 'INSTAGRAM') {
        return (
            <Stack spacing={1.2}>
                <TextField
                    label="Legenda no Instagram"
                    value={draft.platformPayload?.caption || ''}
                    onChange={(event) =>
                        setDraft((prev) => ({
                            ...prev,
                            platformPayload: { ...prev.platformPayload, caption: event.target.value }
                        }))
                    }
                    fullWidth
                    multiline
                    minRows={2}
                />

                <TextField
                    select
                    label="Modo de publicação"
                    value={draft.platformPayload?.publish_mode || 'FEED'}
                    onChange={(event) =>
                        setDraft((prev) => ({
                            ...prev,
                            platformPayload: { ...prev.platformPayload, publish_mode: event.target.value }
                        }))
                    }
                    fullWidth
                >
                    <MenuItem value="FEED">Feed</MenuItem>
                    <MenuItem value="REELS">Reels</MenuItem>
                    <MenuItem value="STORY">Stories</MenuItem>
                </TextField>
            </Stack>
        );
    }

    return null;
}

function resolvePreviewTitle(network, draft, selectedPost) {
    if (network === 'TIKTOK') {
        return (
            String(draft.platformPayload?.title || '').trim() ||
            String(selectedPost?.default_title || '').trim() ||
            String(selectedPost?.internal_name || '').trim()
        );
    }

    if (network === 'YOUTUBE') {
        return (
            String(draft.platformPayload?.title || '').trim() ||
            String(selectedPost?.default_title || '').trim() ||
            String(selectedPost?.internal_name || '').trim()
        );
    }

    return String(selectedPost?.internal_name || '').trim();
}

function resolvePreviewDescription(network, draft, selectedPost) {
    if (network === 'TIKTOK') {
        return (
            String(draft.platformPayload?.caption || '').trim() ||
            String(selectedPost?.default_caption || '').trim()
        );
    }

    if (network === 'YOUTUBE') {
        return (
            String(draft.platformPayload?.description || '').trim() ||
            String(selectedPost?.default_caption || '').trim()
        );
    }

    if (network === 'INSTAGRAM') {
        return (
            String(draft.platformPayload?.caption || '').trim() ||
            String(selectedPost?.default_caption || '').trim()
        );
    }

    return '';
}

function SchedulePreviewPanel({ network, draft, selectedPost, selectedSocialAccount }) {
    const media = useMemo(
        () =>
            ensureArray(selectedPost?.media)
                .slice()
                .sort((a, b) => (a?.sort_order || 0) - (b?.sort_order || 0)),
        [selectedPost]
    );
    const firstMedia = media[0] || null;
    const title = resolvePreviewTitle(network, draft, selectedPost);
    const description = resolvePreviewDescription(network, draft, selectedPost);

    return (
        <Box
            sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 1.5,
                bgcolor: 'background.paper'
            }}
        >
            <Stack spacing={1.2}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Pré-visualização
                </Typography>

                <Stack direction="row" spacing={0.8} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                        Conta selecionada:
                    </Typography>
                    <SocialAccountIdentity
                        account={selectedSocialAccount}
                        network={network}
                        avatarSize={18}
                        textVariant="caption"
                        textColor="text.secondary"
                        fontWeight={700}
                        noWrap
                    />
                </Stack>

                {!selectedPost ? (
                    <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                        Selecione um post da galeria para visualizar como ficará o conteúdo antes de agendar.
                    </Alert>
                ) : (
                    <>
                        <Box
                            sx={{
                                borderRadius: 1.5,
                                overflow: 'hidden',
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'action.hover'
                            }}
                        >
                            {firstMedia?.storage_key ? (
                                isVideoMedia(firstMedia) ? (
                                    <Box
                                        component="video"
                                        src={mediaUrl(firstMedia.storage_key)}
                                        controls
                                        muted
                                        preload="metadata"
                                        sx={{ width: '100%', maxHeight: 260, display: 'block', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <Box
                                        component="img"
                                        src={mediaUrl(firstMedia.storage_key)}
                                        alt={firstMedia?.original_name || 'Pré-visualização'}
                                        sx={{ width: '100%', maxHeight: 260, display: 'block', objectFit: 'cover' }}
                                    />
                                )
                            ) : (
                                <Box
                                    sx={{
                                        minHeight: 160,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <Typography variant="caption" color="text.secondary">
                                        Sem mídia disponível
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        {media.length > 1 ? (
                            <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap' }}>
                                {media.slice(0, 6).map((item, index) => (
                                    <MediaThumb key={item.id || item.storage_key || `media-${index}`} media={item} size={44} />
                                ))}
                            </Stack>
                        ) : null}

                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {title || 'Sem título'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {description || 'Sem descrição'}
                            </Typography>
                        </Box>

                        {network === 'TIKTOK' ? (
                            <Stack direction="row" spacing={0.6} sx={{ flexWrap: 'wrap' }}>
                                <Chip
                                    size="small"
                                    label={
                                        draft.platformPayload?.privacy_level
                                            ? `Privacidade: ${tiktokPrivacyLabel(draft.platformPayload.privacy_level)}`
                                            : 'Privacidade não definida'
                                    }
                                    color={draft.platformPayload?.privacy_level ? 'primary' : 'default'}
                                    sx={{ borderRadius: 1.5 }}
                                />
                                <Chip
                                    size="small"
                                    label={
                                        draft.platformPayload?.commercial_content_enabled
                                            ? 'Divulgação comercial: ligada'
                                            : 'Divulgação comercial: desligada'
                                    }
                                    sx={{ borderRadius: 1.5 }}
                                />
                            </Stack>
                        ) : null}
                    </>
                )}

                {network === 'TIKTOK' ? (
                    <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                        Após a publicação, o TikTok pode levar alguns minutos para processar o conteúdo e exibi-lo no perfil.
                    </Alert>
                ) : null}
            </Stack>
        </Box>
    );
}

export default function PostSchedules() {
    const { posts, isLoading: isPostsLoading } = usePosts();
    const { meta } = useSocialPostSchedulesMeta();
    const { socialAccounts, isLoading: isSocialAccountsLoading } = useSocialAccounts();
    const {
        dailyLimits,
        isLoading: isDailyLimitsLoading,
        mutate: mutateDailyLimits
    } = useSocialPostDailyLimits({ social_network: 'TIKTOK' });

    const [activeTab, setActiveTab] = useState('TIKTOK');
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [selectedViewAccountId, setSelectedViewAccountId] = useState('');
    const [utcNowMs, setUtcNowMs] = useState(Date.now());
    const isHistoryTab = activeTab === 'HISTORY';
    const selectedViewNetwork = isHistoryTab ? '' : activeTab;

    const baseQueryFilters = useMemo(() => {
        const dateRange = normalizeDateRange(filters.from, filters.to);

        return {
            ...(selectedViewNetwork ? { social_network: selectedViewNetwork } : {}),
            ...(selectedViewAccountId ? { social_account_id: selectedViewAccountId } : {}),
            ...dateRange
        };
    }, [filters.from, filters.to, selectedViewNetwork, selectedViewAccountId]);

    const scheduleQueryFilters = useMemo(
        () => ({
            ...baseQueryFilters,
            ...(filters.status !== 'ALL' && SCHEDULE_STATUS_VALUES.includes(filters.status)
                ? { status: filters.status }
                : {})
        }),
        [baseQueryFilters, filters.status]
    );

    const runQueryFilters = useMemo(
        () => ({
            ...baseQueryFilters,
            ...(filters.status !== 'ALL' && RUN_STATUS_VALUES.includes(filters.status)
                ? { status: filters.status }
                : {})
        }),
        [baseQueryFilters, filters.status]
    );

    const {
        schedules,
        meta: schedulesMeta,
        isLoading: isSchedulesLoading,
        mutate: mutateSchedules
    } = useSocialPostSchedules(scheduleQueryFilters);

    const {
        runs,
        isLoading: isRunsLoading,
        mutate: mutateRuns
    } = useSocialPostScheduleRuns(runQueryFilters);

    const postsList = useMemo(
        () =>
            ensureArray(posts)
                .slice()
                .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                .map((post) => ({
                    ...post,
                    media: ensureArray(post?.media)
                        .slice()
                        .sort((a, b) => (a?.sort_order || 0) - (b?.sort_order || 0))
                })),
        [posts]
    );

    const [selectedNetwork, setSelectedNetwork] = useState('TIKTOK');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [upsertMode, setUpsertMode] = useState('create');
    const [editingScheduleId, setEditingScheduleId] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [deletingScheduleId, setDeletingScheduleId] = useState('');
    const [dispatchingScheduleId, setDispatchingScheduleId] = useState('');
    const [actionError, setActionError] = useState('');
    const [errorDetailModal, setErrorDetailModal] = useState({ open: false, title: '', message: '' });
    const [deleteDialog, setDeleteDialog] = useState({ open: false, schedule: null });
    const [limitModal, setLimitModal] = useState({ open: false, message: '' });
    const [tiktokCreatorInfo, setTikTokCreatorInfo] = useState(null);
    const [isTikTokCreatorInfoLoading, setIsTikTokCreatorInfoLoading] = useState(false);
    const [draft, setDraft] = useState({
        ...INITIAL_DRAFT,
        platformPayload: { ...NETWORK_CONFIG.TIKTOK.defaultPayload }
    });

    const postsById = useMemo(() => new Map(postsList.map((post) => [post.id, post])), [postsList]);
    const socialAccountsList = useMemo(() => ensureArray(socialAccounts), [socialAccounts]);
    const tiktokDailyLimitsByAccountId = useMemo(() => {
        const items = ensureArray(dailyLimits?.items);
        return new Map(items.map((item) => [item.social_account_id, item]));
    }, [dailyLimits]);
    const secondsUntilNextUtcReset = useMemo(() => getSecondsUntilNextUtcReset(utcNowMs), [utcNowMs]);
    const accountsForViewNetwork = useMemo(
        () =>
            socialAccountsList
                .filter((account) =>
                    isHistoryTab
                        ? true
                        : account?.social_network === selectedViewNetwork
                )
                .sort((a, b) => {
                    if (isHistoryTab && a?.social_network !== b?.social_network) {
                        return String(a?.social_network || '').localeCompare(String(b?.social_network || ''));
                    }
                    if (a?.is_default === b?.is_default) {
                        return new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime();
                    }
                    return a?.is_default ? -1 : 1;
                }),
        [socialAccountsList, isHistoryTab, selectedViewNetwork]
    );
    const selectedViewAccount = useMemo(
        () =>
            accountsForViewNetwork.find(
                (account) => account?.id === selectedViewAccountId
            ) || null,
        [accountsForViewNetwork, selectedViewAccountId]
    );

    useEffect(() => {
        const timerId = window.setInterval(() => {
            setUtcNowMs(Date.now());
        }, 1000);

        return () => {
            window.clearInterval(timerId);
        };
    }, []);

    useEffect(() => {
        if (!selectedViewAccountId) return;
        const selectedStillExists = accountsForViewNetwork.some(
            (account) => account?.id === selectedViewAccountId
        );
        if (!selectedStillExists) {
            setSelectedViewAccountId('');
        }
    }, [accountsForViewNetwork, selectedViewAccountId]);

    const availableSocialAccounts = useMemo(
        () =>
            socialAccountsList
                .filter((account) => account?.social_network === selectedNetwork && account?.status === 'ACTIVE')
                .sort((a, b) => {
                    if (a?.is_default === b?.is_default) {
                        return new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();
                    }
                    return a?.is_default ? -1 : 1;
                }),
        [selectedNetwork, socialAccountsList]
    );

    const selectedPost = draft.selectedPostId ? postsById.get(draft.selectedPostId) || null : null;
    const selectedAvailableSocialAccount =
        availableSocialAccounts.find((account) => account?.id === draft.selectedSocialAccountId) || null;
    const selectedAccountDailyLimit = useMemo(() => {
        if (selectedNetwork !== 'TIKTOK' || !draft.selectedSocialAccountId) return null;
        return tiktokDailyLimitsByAccountId.get(draft.selectedSocialAccountId) || null;
    }, [selectedNetwork, draft.selectedSocialAccountId, tiktokDailyLimitsByAccountId]);

    const getPreferredAccountId = (network) => {
        const preferred = socialAccountsList
            .filter((account) => account?.social_network === network && account?.status === 'ACTIVE')
            .sort((a, b) => {
                if (a?.is_default === b?.is_default) {
                    return new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();
                }
                return a?.is_default ? -1 : 1;
            })[0];

        return preferred?.id || '';
    };

    useEffect(() => {
        if (!isCreateModalOpen || selectedNetwork !== 'TIKTOK') {
            setTikTokCreatorInfo(null);
            setIsTikTokCreatorInfoLoading(false);
            return;
        }

        const accountId = draft.selectedSocialAccountId;
        if (!accountId) {
            setTikTokCreatorInfo(null);
            setIsTikTokCreatorInfoLoading(false);
            return;
        }

        let cancelled = false;
        setIsTikTokCreatorInfoLoading(true);

        getRequest(`/posts/schedules/tiktok/creator-info/${accountId}`)
            .then((response) => {
                if (cancelled) return;
                setTikTokCreatorInfo(response || null);

                const allowedPrivacy = ensureArray(response?.privacy_level_options);
                setDraft((prev) => {
                    const currentPrivacy = prev.platformPayload?.privacy_level || '';
                    const shouldResetPrivacy = !currentPrivacy || !allowedPrivacy.includes(currentPrivacy);
                    if (!shouldResetPrivacy) return prev;

                    return {
                        ...prev,
                        platformPayload: {
                            ...prev.platformPayload,
                            privacy_level: ''
                        }
                    };
                });
            })
            .catch(() => {
                if (cancelled) return;
                setTikTokCreatorInfo(null);
            })
            .finally(() => {
                if (cancelled) return;
                setIsTikTokCreatorInfoLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [draft.selectedSocialAccountId, isCreateModalOpen, selectedNetwork]);

    useEffect(() => {
        if (!isCreateModalOpen || selectedNetwork !== 'TIKTOK') return;

        const postKind = resolvePostMediaKind(selectedPost);
        const isPhotoPost = postKind === 'PHOTO' || postKind === 'CAROUSEL';
        const lockComment = Boolean(tiktokCreatorInfo?.comment_disabled);
        const lockDuet = Boolean(tiktokCreatorInfo?.duet_disabled) || isPhotoPost;
        const lockStitch = Boolean(tiktokCreatorInfo?.stitch_disabled) || isPhotoPost;

        setDraft((prev) => {
            const current = prev.platformPayload || {};
            const next = { ...current };
            let changed = false;

            if (lockComment && current.allow_comment) {
                next.allow_comment = false;
                changed = true;
            }
            if (lockDuet && current.allow_duet) {
                next.allow_duet = false;
                changed = true;
            }
            if (lockStitch && current.allow_stitch) {
                next.allow_stitch = false;
                changed = true;
            }

            const isCommercialDisclosureEnabled = Boolean(current.commercial_content_enabled);
            const isPrivateVisibility = isTikTokPrivatePrivacy(current.privacy_level);

            if (!isCommercialDisclosureEnabled) {
                if (current.brand_organic_toggle) {
                    next.brand_organic_toggle = false;
                    changed = true;
                }
                if (current.brand_content_toggle) {
                    next.brand_content_toggle = false;
                    changed = true;
                }
            }

            if (isPrivateVisibility && current.brand_content_toggle) {
                next.brand_content_toggle = false;
                changed = true;
            }

            return changed
                ? {
                      ...prev,
                      platformPayload: next
                  }
                : prev;
        });
    }, [isCreateModalOpen, selectedNetwork, selectedPost, tiktokCreatorInfo]);

    const openCreateModal = (network) => {
        const networkInfo = networkMeta(network);
        const defaultScheduleSlot = getDefaultScheduleSlot();

        setUpsertMode('create');
        setEditingScheduleId('');
        setSelectedNetwork(network);
        setActionError('');
        setDraft({
            ...INITIAL_DRAFT,
            ...defaultScheduleSlot,
            selectedSocialAccountId: getPreferredAccountId(network),
            platformPayload: { ...networkInfo.defaultPayload }
        });
        setIsCreateModalOpen(true);
    };

    const openEditModal = (schedule) => {
        if (!schedule?.id) return;
        if (schedule.status === 'PROCESSING') {
            toast.error('Agendamento em processamento não pode ser editado.');
            return;
        }

        const networkInfo = networkMeta(schedule.social_network);
        const payload = schedule?.platform_payload && typeof schedule.platform_payload === 'object' ? schedule.platform_payload : {};

        setUpsertMode('edit');
        setEditingScheduleId(schedule.id);
        setSelectedNetwork(schedule.social_network);
        setActionError('');
        setDraft({
            ...INITIAL_DRAFT,
            selectedSocialAccountId: schedule.social_account_id || getPreferredAccountId(schedule.social_network),
            selectedPostId: schedule.post_id || '',
            aiContent: Boolean(schedule.ai_content),
            scheduledDate: toLocalDateInputValue(schedule.scheduled_at),
            scheduledHour: toLocalHourInputValue(schedule.scheduled_at),
            platformPayload: {
                ...networkInfo.defaultPayload,
                ...payload
            }
        });
        setIsCreateModalOpen(true);
    };

    const closeCreateModal = () => {
        if (actionLoading) return;
        setUpsertMode('create');
        setEditingScheduleId('');
        setIsCreateModalOpen(false);
    };

    const openErrorDetails = (title, message) => {
        if (!message) return;
        setErrorDetailModal({ open: true, title, message });
    };

    const closeErrorDetails = () => {
        setErrorDetailModal({ open: false, title: '', message: '' });
    };

    const copyErrorDetails = async () => {
        const text = String(errorDetailModal.message || '').trim();
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            toast.success('Erro copiado.');
        } catch {
            toast.error('Não foi possível copiar o erro.');
        }
    };

    const saveSchedule = async () => {
        if (!selectedPost || !draft.scheduledDate || !draft.scheduledHour) return;

        try {
            setActionError('');
            const scheduledAtLocal = new Date(`${draft.scheduledDate}T${draft.scheduledHour}:00`);

            if (Number.isNaN(scheduledAtLocal.getTime())) {
                throw new Error('Data/hora do agendamento inválida.');
            }

            const now = new Date();
            const isSameDay =
                scheduledAtLocal.getFullYear() === now.getFullYear() &&
                scheduledAtLocal.getMonth() === now.getMonth() &&
                scheduledAtLocal.getDate() === now.getDate();

            if (isSameDay && scheduledAtLocal.getTime() <= now.getTime()) {
                throw new Error(INVALID_SCHEDULE_HOUR_MESSAGE);
            }

            if (selectedNetwork === 'TIKTOK') {
                const commercialDisclosureInvalid = isTikTokCommercialDisclosureInvalid(draft.platformPayload);
                if (commercialDisclosureInvalid) {
                    setActionError('Você precisa indicar se seu conteúdo promove você, terceiros ou ambos.');
                    return;
                }

                const selectedPrivacy = String(draft.platformPayload?.privacy_level || '').trim();
                if (!selectedPrivacy) {
                    setActionError('Selecione manualmente a privacidade do post no TikTok.');
                    return;
                }

                const isPrivateVisibility = isTikTokPrivatePrivacy(selectedPrivacy);
                if (isPrivateVisibility && Boolean(draft.platformPayload?.brand_content_toggle)) {
                    setActionError('Conteúdo de marca não pode usar visibilidade privada.');
                    return;
                }

                const selectedLimit = selectedAccountDailyLimit;
                const maxDailyPosts = Number(dailyLimits?.daily_limit || 15);
                const nowUtc = new Date();
                const isTargetUtcToday =
                    scheduledAtLocal.getUTCFullYear() === nowUtc.getUTCFullYear() &&
                    scheduledAtLocal.getUTCMonth() === nowUtc.getUTCMonth() &&
                    scheduledAtLocal.getUTCDate() === nowUtc.getUTCDate();

                if (
                    isTargetUtcToday &&
                    selectedLimit &&
                    Number(selectedLimit.used) >= maxDailyPosts
                ) {
                    setLimitModal({
                        open: true,
                        message: 'Limite de posts diário atingido. Tente novamente mais tarde.'
                    });
                    return;
                }

                const mediaKind = resolvePostMediaKind(selectedPost);
                if (mediaKind === 'VIDEO') {
                    const durationSec = resolveFirstVideoDurationSec(selectedPost);
                    if (!durationSec) {
                        setActionError('Vídeo sem duração disponível na galeria. Reenvie o arquivo para atualizar os metadados.');
                        return;
                    }

                    const maxVideoDuration = Number(tiktokCreatorInfo?.max_video_post_duration_sec);
                    if (!Number.isFinite(maxVideoDuration) || maxVideoDuration <= 0) {
                        setActionError('Não foi possível validar a duração máxima do TikTok para esta conta.');
                        return;
                    }

                    if (durationSec > maxVideoDuration) {
                        setActionError(`Vídeo com ${durationSec}s excede o limite permitido para esta conta (${Math.floor(maxVideoDuration)}s).`);
                        return;
                    }
                }
            }

            setActionLoading(true);
            const payload = {
                social_account_id: draft.selectedSocialAccountId,
                post_id: selectedPost.id,
                social_network: selectedNetwork,
                ai_content: Boolean(draft.iaContent),
                scheduled_at: scheduledAtLocal.toISOString(),
                platform_payload: buildPlatformPayload(selectedNetwork, draft)
            };

            if (upsertMode === 'edit' && editingScheduleId) {
                await putRequest(`/posts/schedules/${editingScheduleId}`, payload);
                toast.success('Agendamento atualizado com sucesso.');
            } else {
                await postRequest('/posts/schedules', payload);
                toast.success('Agendamento criado com sucesso.');
            }

            await Promise.all([mutateSchedules(), mutateRuns(), mutateDailyLimits()]);
            setUpsertMode('create');
            setEditingScheduleId('');
            setIsCreateModalOpen(false);
        } catch (error) {
            const message = error?.response?.data?.message ?? error?.message;
            const normalizedMessage = Array.isArray(message) ? message.join(' | ') : String(message || '');

            if (/hor[aá]rio inv[aá]lido/i.test(normalizedMessage)) {
                setActionError(INVALID_SCHEDULE_HOUR_MESSAGE);
            } else if (/limite de posts di[aá]rio atingido/i.test(normalizedMessage)) {
                setLimitModal({
                    open: true,
                    message: 'Limite de posts diário atingido. Tente novamente mais tarde.'
                });
            } else if (/conta social ativa n[aã]o encontrada/i.test(normalizedMessage)) {
                setActionError('Selecione uma conta social ativa para a rede escolhida.');
            } else if (/post\s*n[aã]o\s*encontrado/i.test(normalizedMessage)) {
                setActionError('Revise os dados do agendamento e tente novamente.');
            } else {
                setActionError('Não foi possivel concluir o agendamento agora.');
            }
        } finally {
            setActionLoading(false);
        }
    };

    const openDeleteDialog = (schedule) => {
        if (!schedule?.id) return;
        if (schedule.status === 'PROCESSING') {
            toast.error('Agendamento em processamento não pode ser excluído.');
            return;
        }
        setDeleteDialog({ open: true, schedule });
    };

    const closeDeleteDialog = () => {
        if (deletingScheduleId) return;
        setDeleteDialog({ open: false, schedule: null });
    };

    const confirmDeleteSchedule = async () => {
        const scheduleId = deleteDialog.schedule?.id;
        if (!scheduleId || deletingScheduleId) return;

        setDeletingScheduleId(scheduleId);
        try {
            await removeRequest(`/posts/schedules/${scheduleId}`);
            await Promise.all([mutateSchedules(), mutateRuns(), mutateDailyLimits()]);
            toast.success('Agendamento excluído com sucesso.');
            setDeleteDialog({ open: false, schedule: null });
        } catch (error) {
            const message = error?.response?.data?.message ?? error?.message;
            const normalizedMessage = Array.isArray(message) ? message.join(' | ') : String(message || '');
            toast.error(normalizedMessage || 'Não foi possível excluir o agendamento.');
        } finally {
            setDeletingScheduleId('');
        }
    };

    const dispatchScheduleNow = async (schedule) => {
        const scheduleId = schedule?.id;
        if (!scheduleId || dispatchingScheduleId) return;

        if (schedule?.status === 'PROCESSING') {
            toast.error('Agendamento em processamento não pode ser disparado agora.');
            return;
        }

        const canDispatchNow = ['SCHEDULED', 'FAILED'].includes(String(schedule?.status || ''));
        if (!canDispatchNow) {
            toast.error('Somente agendamentos com status Agendado ou Falhou podem ser disparados agora.');
            return;
        }

        setDispatchingScheduleId(scheduleId);
        try {
            const response = await postRequest(`/posts/schedules/${scheduleId}/dispatch-now`);
            await Promise.all([mutateSchedules(), mutateRuns(), mutateDailyLimits()]);
            if (String(response?.run?.status || '') === 'FAILED') {
                toast.error(response?.run?.error_message || response?.message || 'Disparo executado com falha.');
            } else {
                toast.success(response?.message || 'Disparo executado com sucesso.');
            }
        } catch (error) {
            const message = error?.response?.data?.message ?? error?.message;
            const normalizedMessage = Array.isArray(message) ? message.join(' | ') : String(message || '');
            toast.error(mapDispatchErrorMessage(normalizedMessage));
        } finally {
            setDispatchingScheduleId('');
        }
    };

    const isCommercialDisclosureInvalid =
        selectedNetwork === 'TIKTOK' &&
        isTikTokCommercialDisclosureInvalid(draft.platformPayload);
    const saveButtonDisabledTooltip = isCommercialDisclosureInvalid
        ? 'Você precisa indicar se seu conteúdo promove você, terceiros ou ambos.'
        : '';

    const isSaveDisabled =
        !draft.selectedSocialAccountId ||
        !draft.selectedPostId ||
        !draft.scheduledDate ||
        !draft.scheduledHour ||
        isCommercialDisclosureInvalid ||
        actionLoading ||
        (upsertMode === 'edit' && !editingScheduleId);

    const scheduleStatusOptions = [
        { value: 'ALL', label: 'Todos' },
        { value: 'SCHEDULED', label: 'Agendado' },
        { value: 'PROCESSING', label: 'Processando' },
        { value: 'FAILED', label: 'Falhou' },
        { value: 'CANCELED', label: 'Cancelado' }
    ];

    const runStatusOptions = [
        { value: 'ALL', label: 'Todos' },
        { value: 'PROCESSING', label: 'Processando' },
        { value: 'COMPLETED', label: 'Concluído' },
        { value: 'FAILED', label: 'Falhou' },
        { value: 'CANCELED', label: 'Cancelado' }
    ];

    const statusOptions = isHistoryTab ? runStatusOptions : scheduleStatusOptions;

    const tableLoading = isHistoryTab ? isRunsLoading : isSchedulesLoading;

    const dispatchedScheduleIds = useMemo(() => {
        return new Set(
            ensureArray(runs)
                .map((run) => String(run?.schedule_id || '').trim())
                .filter(Boolean)
        );
    }, [runs]);

    const undispatchedSchedules = useMemo(
        () =>
            ensureArray(schedules).filter((schedule) => !dispatchedScheduleIds.has(String(schedule?.id || '').trim())),
        [dispatchedScheduleIds, schedules]
    );

    const tableItemsRaw = isHistoryTab ? ensureArray(runs) : undispatchedSchedules;
    const tableItems = selectedViewAccountId ? tableItemsRaw : [];
    const hasProcessingRuns = useMemo(
        () =>
            ensureArray(runs).some((run) => String(run?.status || '').toUpperCase() === 'PROCESSING'),
        [runs]
    );

    const tokensCostPerDispatch = schedulesMeta?.tokens_cost_per_dispatch ?? meta?.tokens_cost_per_dispatch ?? 1000;

    useEffect(() => {
        if (!isHistoryTab || !selectedViewAccountId || !hasProcessingRuns) return;

        const intervalId = window.setInterval(() => {
            void mutateRuns();
        }, 5000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [hasProcessingRuns, isHistoryTab, mutateRuns, selectedViewAccountId]);

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
                    <Stack spacing={2.5}>
                        <Box>
                            <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
                                Agendamentos de Post
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Base única para TikTok, YouTube e Instagram, com histórico de disparos e rastreabilidade completa.
                            </Typography>
                        </Box>

                        <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                            Cada disparo do post do agendamento custa <b>{tokensCostPerDispatch} tokens</b>.
                        </Alert>

                        <Divider />

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                            {NETWORK_ORDER.map((network) => {
                                const config = networkMeta(network);
                                const isAnnouncedNetwork = network === 'TIKTOK';

                                return (
                                    <Tooltip key={network} title={isAnnouncedNetwork ? '' : 'A ser anunciado'} disableHoverListener={isAnnouncedNetwork}>
                                        <span>
                                            <Button
                                                variant="contained"
                                                onClick={() => {
                                                    if (isAnnouncedNetwork) openCreateModal(network);
                                                }}
                                                disabled={!isAnnouncedNetwork}
                                                startIcon={<NetworkIcon network={network} size={17} />}
                                                sx={{
                                                    borderRadius: 2,
                                                    fontWeight: 800,
                                                    justifyContent: 'flex-start',
                                                    textTransform: 'none',
                                                    px: 1.8,
                                                    color: config.buttonTextColor || '#ffffff',
                                                    background: config.buttonBackground,
                                                    '&:hover': {
                                                        background: config.buttonBackground,
                                                        filter: 'brightness(0.93)'
                                                    },
                                                    '&.Mui-disabled': {
                                                        color: config.buttonTextColor || '#ffffff',
                                                        background: config.buttonBackground,
                                                        WebkitTextFillColor: config.buttonTextColor || '#ffffff',
                                                        opacity: 0.5
                                                    }
                                                }}
                                            >
                                                {config.buttonLabel}
                                            </Button>
                                        </span>
                                    </Tooltip>
                                );
                            })}
                        </Stack>
                    </Stack>
                </Box>
            </MainCard>

            <MainCard
                content={false}
                sx={{
                    mt: 2,
                    overflow: 'hidden',
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider'
                }}
            >
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                        <Tabs
                            value={activeTab}
                            onChange={(_, value) => {
                                setActiveTab(value);
                                setFilters((prev) => ({ ...prev, status: 'ALL' }));
                                setSelectedViewAccountId('');
                            }}
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 800, borderRadius: 2, minHeight: 40 } }}
                        >
                            {NETWORK_ORDER.map((network) => {
                                const config = networkMeta(network);
                                return (
                                    <Tab
                                        key={network}
                                        value={network}
                                        icon={<NetworkIcon network={network} size={16} />}
                                        iconPosition="start"
                                        label={config.label}
                                        sx={{
                                            mr: 1,
                                            border: `1px solid ${config.color || '#111111'}`,
                                            backgroundColor: '#ffffff',
                                            color: config.color || 'text.primary',
                                            '&.Mui-selected': {
                                                color: config.buttonTextColor || '#ffffff',
                                                background: config.buttonBackground
                                            }
                                        }}
                                    />
                                );
                            })}
                            <Tab
                                value="HISTORY"
                                icon={<HistoryRoundedIcon />}
                                iconPosition="start"
                                label="Histórico"
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    backgroundColor: '#ffffff',
                                    color: 'text.primary',
                                    '&.Mui-selected': {
                                        color: '#ffffff',
                                        bgcolor: 'text.primary'
                                    }
                                }}
                            />
                        </Tabs>
                    </Box>

                    <Stack spacing={1.2} sx={{ mb: 2 }}>
                        {!selectedViewAccountId ? (
                            accountsForViewNetwork.length === 0 ? (
                                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                                    {isHistoryTab
                                        ? 'Nenhuma conta cadastrada para exibir no histórico.'
                                        : `Nenhuma conta cadastrada em ${networkMeta(selectedViewNetwork).label}.`}
                                </Alert>
                            ) : (
                                <Stack spacing={1}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                        {isHistoryTab
                                            ? 'Contas disponíveis no histórico'
                                            : `Contas do ${networkMeta(selectedViewNetwork).label}`}
                                    </Typography>
                                    {accountsForViewNetwork.map((account) => {
                                        const tiktokUsage = tiktokDailyLimitsByAccountId.get(account.id);
                                        const limitLabel =
                                            selectedViewNetwork === 'TIKTOK'
                                                ? `${tiktokUsage?.used ?? 0}/${dailyLimits?.daily_limit ?? 15} hoje • reset em ${formatCountdown(
                                                      secondsUntilNextUtcReset
                                                  )}`
                                                : null;

                                        return (
                                            <Button
                                                key={account.id}
                                                variant="outlined"
                                                onClick={() => setSelectedViewAccountId(account.id)}
                                                sx={{
                                                    borderRadius: 2,
                                                    px: 1.2,
                                                    py: 1,
                                                    textTransform: 'none',
                                                    alignItems: 'flex-start',
                                                    justifyContent: 'flex-start',
                                                    width: '100%'
                                                }}
                                            >
                                                <Stack spacing={0.2} sx={{ textAlign: 'left', width: '100%' }}>
                                                    <SocialAccountIdentity
                                                        account={account}
                                                        network={account?.social_network}
                                                        showNetworkIcon={isHistoryTab}
                                                        avatarSize={20}
                                                        textVariant="subtitle2"
                                                        textColor="text.primary"
                                                        fontWeight={800}
                                                    />
                                                    {selectedViewNetwork === 'TIKTOK' ? (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {isDailyLimitsLoading ? 'Carregando limite diário...' : limitLabel}
                                                        </Typography>
                                                    ) : null}
                                                </Stack>
                                            </Button>
                                        );
                                    })}
                                </Stack>
                            )
                        ) : (
                            <>
                                <Stack spacing={1}>
                                    <Stack direction="row" spacing={0.8} alignItems="center">
                                        {!isHistoryTab ? <NetworkIcon network={selectedViewNetwork} size={16} /> : null}
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                            {isHistoryTab
                                                ? 'Histórico /'
                                                : `Agendamentos / ${networkMeta(selectedViewNetwork).label} /`}
                                        </Typography>
                                        <SocialAccountIdentity
                                            account={selectedViewAccount}
                                            network={selectedViewAccount?.social_network}
                                            avatarSize={18}
                                            textVariant="subtitle2"
                                            textColor="text.primary"
                                            fontWeight={800}
                                            noWrap
                                        />
                                    </Stack>
                                    <Button
                                        variant="outlined"
                                        onClick={() => setSelectedViewAccountId('')}
                                        sx={{
                                            alignSelf: 'flex-start',
                                            borderRadius: 2,
                                            fontWeight: 800,
                                            textTransform: 'none'
                                        }}
                                    >
                                        Voltar
                                    </Button>
                                </Stack>

                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                                    <TextField
                                        select
                                        label="Status"
                                        value={filters.status}
                                        onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                                        sx={{ minWidth: 180 }}
                                    >
                                        {statusOptions.map((option) => (
                                            <MenuItem key={option.value} value={option.value}>
                                                {option.label}
                                            </MenuItem>
                                        ))}
                                    </TextField>

                                    <TextField
                                        type="text"
                                        label="De"
                                        InputLabelProps={{ shrink: true }}
                                        value={filters.from}
                                        onChange={(event) =>
                                            setFilters((prev) => ({
                                                ...prev,
                                                from: normalizeDateFilterMask(event.target.value)
                                            }))
                                        }
                                        onBlur={() =>
                                            setFilters((prev) => {
                                                const parsed = parseFilterDateInput(prev.from);
                                                if (!parsed) return prev;
                                                return { ...prev, from: formatFilterDateDisplayFromDate(parsed) };
                                            })
                                        }
                                        placeholder="DD/MM/AA"
                                        inputProps={{ maxLength: 8, inputMode: 'numeric' }}
                                        sx={{ minWidth: 170 }}
                                    />

                                    <TextField
                                        type="text"
                                        label="Até"
                                        InputLabelProps={{ shrink: true }}
                                        value={filters.to}
                                        onChange={(event) =>
                                            setFilters((prev) => ({
                                                ...prev,
                                                to: normalizeDateFilterMask(event.target.value)
                                            }))
                                        }
                                        onBlur={() =>
                                            setFilters((prev) => {
                                                const parsed = parseFilterDateInput(prev.to);
                                                if (!parsed) return prev;
                                                return { ...prev, to: formatFilterDateDisplayFromDate(parsed) };
                                            })
                                        }
                                        placeholder="DD/MM/AA"
                                        inputProps={{ maxLength: 8, inputMode: 'numeric' }}
                                        sx={{ minWidth: 170 }}
                                    />

                                    <Button
                                        color="inherit"
                                        onClick={() => setFilters(INITIAL_FILTERS)}
                                        sx={{ borderRadius: 2, fontWeight: 800 }}
                                    >
                                        Limpar filtros
                                    </Button>
                                </Stack>
                            </>
                        )}
                    </Stack>

                    {tableLoading ? (
                        <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : tableItems.length === 0 ? (
                        <Alert severity="info">
                            {!selectedViewAccountId
                                ? 'Selecione uma conta para visualizar os itens.'
                                : !isHistoryTab
                                  ? 'Nenhum agendamento pendente encontrado com os filtros atuais.'
                                  : 'Nenhum disparo encontrado no histórico com os filtros atuais.'}
                        </Alert>
                    ) : !isHistoryTab ? (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Post</TableCell>
                                        <TableCell>IA</TableCell>
                                        <TableCell>Data base</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Custo</TableCell>
                                        <TableCell>Criado em</TableCell>
                                        <TableCell align="right">Ações</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {tableItems.map((schedule) => {
                                        const firstMedia = ensureArray(schedule?.post_snapshot?.media)[0] || null;
                                        const hasErrorDetails = schedule.status === 'FAILED' && Boolean(schedule.error_message);
                                        const isProcessing = schedule.status === 'PROCESSING';
                                        const canDispatchNow = ['SCHEDULED', 'FAILED'].includes(String(schedule.status || ''));
                                        const editTooltip = isProcessing
                                            ? 'Agendamento em processamento não pode ser editado'
                                            : 'Clique para editar este agendamento';
                                        const dispatchNowTooltip = isProcessing
                                            ? 'Agendamento em processamento não pode ser disparado agora'
                                            : canDispatchNow
                                              ? 'Disparar agora'
                                              : 'Somente agendamentos com status Agendado ou Falhou podem ser disparados agora';
                                        const deleteTooltip = isProcessing
                                            ? 'Agendamento em processamento não pode ser excluído'
                                            : 'Excluir agendamento';

                                        return (
                                            <TableRow key={schedule.id} hover>
                                                <TableCell sx={{ minWidth: 260 }}>
                                                    <Tooltip title={editTooltip}>
                                                        <Box
                                                            onClick={() => {
                                                                if (isProcessing) return;
                                                                openEditModal(schedule);
                                                            }}
                                                            sx={{
                                                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                                                borderRadius: 1.5,
                                                                p: 0.35,
                                                                ml: -0.35,
                                                                mr: -0.35,
                                                                '&:hover': { bgcolor: isProcessing ? 'transparent' : 'action.hover' }
                                                            }}
                                                        >
                                                            <Stack direction="row" spacing={1.2} alignItems="center">
                                                                <MediaThumb media={firstMedia} />
                                                                <Box sx={{ minWidth: 0 }}>
                                                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                                                                        {schedule?.post_snapshot?.internal_name || '-'}
                                                                    </Typography>
                                                                    <Typography variant="caption" color="text.secondary" noWrap>
                                                                        {postTypeLabel(schedule?.post_snapshot?.post_type)}
                                                                    </Typography>
                                                                </Box>
                                                            </Stack>
                                                        </Box>
                                                    </Tooltip>
                                                </TableCell>

                                                <TableCell>
                                                    <Chip
                                                        size="small"
                                                        variant={schedule.ai_content ? 'filled' : 'outlined'}
                                                        color={schedule.ai_content ? 'warning' : 'default'}
                                                        label={schedule.ai_content ? 'Sim' : 'Não'}
                                                        sx={{ borderRadius: 2, fontWeight: 800 }}
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Typography variant="body2">{formatDateTime(schedule.scheduled_at)}</Typography>
                                                </TableCell>

                                                <TableCell>
                                                    <Tooltip title={hasErrorDetails ? 'Clique para ver o erro' : ''} disableHoverListener={!hasErrorDetails}>
                                                        <Box
                                                            onClick={() => {
                                                                if (!hasErrorDetails) return;
                                                                openErrorDetails('Erro do agendamento', schedule.error_message);
                                                            }}
                                                            sx={{ display: 'inline-flex', cursor: hasErrorDetails ? 'pointer' : 'default' }}
                                                        >
                                                            <StatusChip status={schedule.status} type="schedule" />
                                                        </Box>
                                                    </Tooltip>
                                                </TableCell>

                                                <TableCell>
                                                    <Typography variant="body2">{schedule.tokens_cost ?? tokensCostPerDispatch} tokens</Typography>
                                                </TableCell>

                                                <TableCell>
                                                    <Typography variant="body2">{formatDateTime(schedule.created_at)}</Typography>
                                                </TableCell>

                                                <TableCell align="right">
                                                    <Tooltip title={dispatchNowTooltip}>
                                                        <span>
                                                            <IconButton
                                                                size="small"
                                                                color="secondary"
                                                                disabled={
                                                                    isProcessing ||
                                                                    !canDispatchNow ||
                                                                    deletingScheduleId === schedule.id ||
                                                                    dispatchingScheduleId === schedule.id ||
                                                                    actionLoading
                                                                }
                                                                onClick={() => dispatchScheduleNow(schedule)}
                                                            >
                                                                {dispatchingScheduleId === schedule.id ? (
                                                                    <CircularProgress size={15} />
                                                                ) : (
                                                                    <RocketLaunchRoundedIcon fontSize="small" />
                                                                )}
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                    <Tooltip title={deleteTooltip}>
                                                        <span>
                                                            <IconButton
                                                                size="small"
                                                                color="error"
                                                                disabled={
                                                                    isProcessing ||
                                                                    deletingScheduleId === schedule.id ||
                                                                    dispatchingScheduleId === schedule.id ||
                                                                    actionLoading
                                                                }
                                                                onClick={() => openDeleteDialog(schedule)}
                                                            >
                                                                <DeleteOutlineRoundedIcon fontSize="small" />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Conta</TableCell>
                                        <TableCell>Post</TableCell>
                                        <TableCell>IA</TableCell>
                                        <TableCell>Data base</TableCell>
                                        <TableCell>Enviado em</TableCell>
                                        <TableCell>Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {tableItems.map((run) => {
                                        const firstMedia = ensureArray(run?.post_snapshot?.media)[0] || null;
                                        const hasErrorDetails = run.status === 'FAILED' && Boolean(run.error_message);

                                        return (
                                            <TableRow key={run.id} hover>
                                                <TableCell sx={{ minWidth: 190 }}>
                                                    <SocialAccountIdentity
                                                        account={run?.social_account}
                                                        network={run?.social_network}
                                                        showNetworkIcon
                                                        avatarSize={20}
                                                        textVariant="subtitle2"
                                                        fontWeight={700}
                                                        noWrap
                                                    />
                                                </TableCell>

                                                <TableCell sx={{ minWidth: 260 }}>
                                                    <Stack direction="row" spacing={1.2} alignItems="center">
                                                        <MediaThumb media={firstMedia} />
                                                        <Box sx={{ minWidth: 0 }}>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                                                                {run?.post_snapshot?.internal_name || '-'}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" noWrap>
                                                                {postTypeLabel(run?.post_snapshot?.post_type)}
                                                            </Typography>
                                                        </Box>
                                                    </Stack>
                                                </TableCell>

                                                <TableCell>
                                                    <Chip
                                                        size="small"
                                                        variant={run.ai_content ? 'filled' : 'outlined'}
                                                        color={run.ai_content ? 'warning' : 'default'}
                                                        label={run.ai_content ? 'Sim' : 'Não'}
                                                        sx={{ borderRadius: 2, fontWeight: 800 }}
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Typography variant="body2">{formatDateTime(run.run_at)}</Typography>
                                                </TableCell>

                                                <TableCell>
                                                    <Typography variant="body2">{formatDateTime(run.sent_at)}</Typography>
                                                </TableCell>

                                                <TableCell>
                                                    <Tooltip title={hasErrorDetails ? 'Clique para ver o erro' : ''} disableHoverListener={!hasErrorDetails}>
                                                        <Box
                                                            onClick={() => {
                                                                if (!hasErrorDetails) return;
                                                                openErrorDetails('Erro do disparo', run.error_message);
                                                            }}
                                                            sx={{ display: 'inline-flex', cursor: hasErrorDetails ? 'pointer' : 'default' }}
                                                        >
                                                            <StatusChip status={run.status} type="run" />
                                                        </Box>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Box>
            </MainCard>
            <Dialog
                open={isCreateModalOpen}
                onClose={closeCreateModal}
                fullWidth
                maxWidth="lg"
                PaperProps={{
                    sx: {
                        borderRadius: 2.5
                    }
                }}
            >
                <DialogTitle>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <NetworkIcon network={selectedNetwork} size={18} />
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            {upsertMode === 'edit' ? `Editar agendamento no ${networkMeta(selectedNetwork).label}` : networkMeta(selectedNetwork).buttonLabel}
                        </Typography>
                    </Stack>
                </DialogTitle>

                <DialogContent dividers>
                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ pt: 0.5 }}>
                        <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
                            {actionError ? (
                                <Alert severity="error" onClose={() => setActionError('')}>
                                    {actionError}
                                </Alert>
                            ) : null}

                            <Autocomplete
                                options={availableSocialAccounts}
                                loading={isSocialAccountsLoading}
                                value={selectedAvailableSocialAccount}
                                onChange={(_, option) =>
                                    setDraft((prev) => ({
                                        ...prev,
                                        selectedSocialAccountId: option?.id || ''
                                    }))
                                }
                                getOptionLabel={(option) => socialAccountDisplay(option)}
                                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                                noOptionsText={isSocialAccountsLoading ? 'Carregando contas...' : `Nenhuma conta ativa conectada no ${networkMeta(selectedNetwork).label}`}
                                renderOption={(props, option) => {
                                    const { key, ...optionProps } = props;
                                    const optionLimit = tiktokDailyLimitsByAccountId.get(option?.id);

                                    return (
                                        <Box component="li" key={key} {...optionProps} sx={{ py: 1 }}>
                                            <Stack spacing={0.2} sx={{ minWidth: 0 }}>
                                                <SocialAccountIdentity
                                                    account={option}
                                                    network={selectedNetwork}
                                                    avatarSize={20}
                                                    textVariant="subtitle2"
                                                    fontWeight={700}
                                                    noWrap
                                                />
                                                <Typography variant="caption" color="text.secondary" noWrap>
                                                    {selectedNetwork === 'TIKTOK'
                                                        ? `${optionLimit?.used ?? 0}/${dailyLimits?.daily_limit ?? 15} hoje • reset em ${formatCountdown(
                                                              secondsUntilNextUtcReset
                                                          )}`
                                                        : ''}
                                                    {option?.is_default ? ' • Conta padrão' : ''}
                                                </Typography>
                                            </Stack>
                                        </Box>
                                    );
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Conta social"
                                        placeholder={`Selecione uma conta do ${networkMeta(selectedNetwork).label}`}
                                        helperText={
                                            selectedNetwork === 'TIKTOK' && selectedAccountDailyLimit
                                                ? `Limite diário: ${selectedAccountDailyLimit.used}/${dailyLimits?.daily_limit ?? 15} • reset em ${formatCountdown(
                                                      secondsUntilNextUtcReset
                                                  )} (UTC)`
                                                : `Escolha qual conta do ${networkMeta(selectedNetwork).label} será usada no disparo`
                                        }
                                        InputProps={{
                                            ...params.InputProps,
                                            startAdornment: selectedAvailableSocialAccount ? (
                                                <Box sx={{ display: 'flex', alignItems: 'center', mr: 0.6 }}>
                                                    <Avatar
                                                        src={socialAccountAvatarUrl(selectedAvailableSocialAccount)}
                                                        alt={socialAccountDisplay(selectedAvailableSocialAccount)}
                                                        sx={{ width: 18, height: 18, fontSize: 10 }}
                                                    >
                                                        {socialAccountInitial(selectedAvailableSocialAccount)}
                                                    </Avatar>
                                                </Box>
                                            ) : null,
                                            endAdornment: (
                                                <>
                                                    {isSocialAccountsLoading ? <CircularProgress color="inherit" size={18} sx={{ mr: 1 }} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            )
                                        }}
                                    />
                                )}
                            />

                            {!isSocialAccountsLoading && availableSocialAccounts.length === 0 ? (
                                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                                    Conecte ao menos uma conta ativa no {networkMeta(selectedNetwork).label} para criar o agendamento.
                                </Alert>
                            ) : null}

                            <Autocomplete
                                options={postsList}
                                loading={isPostsLoading}
                                value={selectedPost}
                                onChange={(_, option) =>
                                    setDraft((prev) => {
                                        const nextPostId = option?.id || '';
                                        const nextPlatformPayload = { ...prev.platformPayload };

                                        if (selectedNetwork === 'TIKTOK') {
                                            const postKind = resolvePostMediaKind(option);
                                            nextPlatformPayload.title = option?.default_title || '';
                                            nextPlatformPayload.caption = mergeCaptionWithTags(option?.default_caption || '', option?.tags);
                                            nextPlatformPayload.privacy_level = prev.platformPayload?.privacy_level || '';

                                            if (postKind === 'PHOTO' || postKind === 'CAROUSEL') {
                                                nextPlatformPayload.allow_duet = false;
                                                nextPlatformPayload.allow_stitch = false;
                                            }
                                        }

                                        return {
                                            ...prev,
                                            selectedPostId: nextPostId,
                                            platformPayload: nextPlatformPayload
                                        };
                                    })
                                }
                                getOptionLabel={(option) => option?.internal_name || ''}
                                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                                noOptionsText={isPostsLoading ? 'Carregando posts...' : 'Nenhum post encontrado na galeria'}
                                renderOption={(props, option) => {
                                    const { key, ...optionProps } = props;
                                    const firstMedia = ensureArray(option?.media)[0] || null;

                                    return (
                                        <Box component="li" key={key} {...optionProps} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, py: 1 }}>
                                            <MediaThumb media={firstMedia} />
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                                                    {option.internal_name}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" noWrap>
                                                    {postTypeLabel(option.post_type)} • {ensureArray(option.media).length} mídia(s)
                                                </Typography>
                                            </Box>
                                        </Box>
                                    );
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Post da Galeria"
                                        placeholder="Selecione um post"
                                        helperText="Selecione o post base que será usado no agendamento"
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {isPostsLoading ? <CircularProgress color="inherit" size={18} sx={{ mr: 1 }} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            )
                                        }}
                                    />
                                )}
                            />

                            <FormControlLabel
                                control={<Checkbox checked={draft.iaContent} onChange={(event) => setDraft((prev) => ({ ...prev, iaContent: event.target.checked }))} />}
                                label={networkMeta(selectedNetwork).iaLabel}
                            />

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
                                <TextField
                                    type="date"
                                    label="Dia da postagem"
                                    InputLabelProps={{ shrink: true }}
                                    value={draft.scheduledDate}
                                    onChange={(event) => setDraft((prev) => ({ ...prev, scheduledDate: event.target.value }))}
                                    inputProps={{ min: TODAY_ISO }}
                                    fullWidth
                                />

                                <TextField
                                    select
                                    label="Horário da postagem"
                                    value={draft.scheduledHour}
                                    onChange={(event) => setDraft((prev) => ({ ...prev, scheduledHour: event.target.value }))}
                                    fullWidth
                                    helperText="Somente horários cheios"
                                >
                                    {HOUR_OPTIONS.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Stack>

                            <Divider />

                            <NetworkSpecificFields
                                network={selectedNetwork}
                                draft={draft}
                                setDraft={setDraft}
                                selectedPost={selectedPost}
                                tiktokCreatorInfo={tiktokCreatorInfo}
                                isTikTokCreatorInfoLoading={isTikTokCreatorInfoLoading}
                            />
                        </Stack>

                        <Box sx={{ width: { xs: '100%', lg: 340 }, flexShrink: 0 }}>
                            <SchedulePreviewPanel
                                network={selectedNetwork}
                                draft={draft}
                                selectedPost={selectedPost}
                                selectedSocialAccount={selectedAvailableSocialAccount}
                            />
                        </Box>
                    </Stack>
                </DialogContent>

                <DialogActions>
                    <Button onClick={closeCreateModal} color="inherit" disabled={actionLoading}>
                        Cancelar
                    </Button>

                    <Tooltip title={saveButtonDisabledTooltip} arrow disableHoverListener={!saveButtonDisabledTooltip}>
                        <span>
                            <Button onClick={saveSchedule} variant="contained" disabled={isSaveDisabled}>
                                {actionLoading ? 'Salvando...' : upsertMode === 'edit' ? 'Salvar edição' : 'Salvar agendamento'}
                            </Button>
                        </span>
                    </Tooltip>
                </DialogActions>
            </Dialog>

            <Dialog open={errorDetailModal.open} onClose={closeErrorDetails} fullWidth maxWidth="sm">
                <DialogTitle>{errorDetailModal.title || 'Detalhes do erro'}</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {errorDetailModal.message || 'Sem detalhes disponíveis.'}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={copyErrorDetails} disabled={!errorDetailModal.message} startIcon={<ContentCopyRoundedIcon fontSize="small" />}>
                        Copiar erro
                    </Button>
                    <Button onClick={closeErrorDetails}>Fechar</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={limitModal.open}
                onClose={() => setLimitModal({ open: false, message: '' })}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>Limite diário por conta</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={1}>
                        <Alert severity="error" sx={{ borderRadius: 2 }}>
                            {limitModal.message || 'Limite de posts diário atingido. Tente novamente mais tarde.'}
                        </Alert>
                        <Typography variant="body2" color="text.secondary">
                            Próximo reset (UTC): <strong>{formatCountdown(secondsUntilNextUtcReset)}</strong>
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLimitModal({ open: false, message: '' })}>Fechar</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={deleteDialog.open} onClose={closeDeleteDialog} fullWidth maxWidth="sm">
                <DialogTitle>Excluir agendamento</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={1.2}>
                        <Typography variant="body2">
                            Confirma a exclusão deste agendamento?
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Post: <strong>{deleteDialog.schedule?.post_snapshot?.internal_name || '-'}</strong>
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Rede: <strong>{networkMeta(deleteDialog.schedule?.social_network).label}</strong>
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Conta:
                        </Typography>
                        <SocialAccountIdentity
                            account={deleteDialog.schedule?.social_account}
                            network={deleteDialog.schedule?.social_network}
                            avatarSize={18}
                            textVariant="body2"
                            textColor="text.secondary"
                            fontWeight={700}
                        />
                        <Typography variant="body2" color="text.secondary">
                            Agendado para: <strong>{formatDateTime(deleteDialog.schedule?.scheduled_at)}</strong>
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Status atual: <strong>{SCHEDULE_STATUS_META[deleteDialog.schedule?.status]?.label || deleteDialog.schedule?.status || '-'}</strong>
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteDialog} disabled={Boolean(deletingScheduleId)}>
                        Cancelar
                    </Button>
                    <Button color="error" variant="contained" onClick={confirmDeleteSchedule} disabled={Boolean(deletingScheduleId)}>
                        {deletingScheduleId ? 'Excluindo...' : 'Excluir agendamento'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
