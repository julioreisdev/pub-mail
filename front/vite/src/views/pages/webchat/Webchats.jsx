
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  FormControlLabel,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import DashboardCustomizeRoundedIcon from '@mui/icons-material/DashboardCustomizeRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';

import MainCard from 'ui-component/cards/MainCard';
import useWebchats from '../../../hooks/useWebchats';
import useAgentes from '../../../hooks/useAgentes';
import useEmailProjects from '../../../hooks/useEmailProjects';
import useWebchatDomains from '../../../hooks/useWebchatDomains';
import { get, patch, post, remove } from '../../../api/api';

const DEFAULT_AGENT_PROMPT = 'Você é um assistente simpático.';

const getErrorMessage = (err, fallback = 'Ocorreu um erro') =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

function stringifyJson(value, fallback = '{}') {
  try {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || fallback;
    }
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
}

function parseJsonObject(rawValue, fieldLabel) {
  const value = String(rawValue || '').trim();
  if (!value) return {};

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${fieldLabel} precisa estar em JSON válido.`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} deve ser um objeto JSON.`);
  }

  return parsed;
}

function normalizeHost(raw) {
  return String(raw || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
}

function normalizeDomain(raw) {
  return normalizeHost(raw).toLowerCase().replace(/\.$/, '');
}

function isValidDomain(domain) {
  const re =
    /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
  return re.test(domain);
}

function toArray(input) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.items)) return input.items;
  return [];
}

function toObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return input;
}

const ADS_POSITION_OPTIONS = [
  { value: 'topo', label: 'Topo' },
  { value: 'rodape', label: 'Rodapé' },
  { value: 'intersticial', label: 'Intersticial' },
  { value: 'entre-mensagens', label: 'Entre mensagens' }
];
const SIMPLE_AD_POSITIONS = ['topo', 'rodape', 'intersticial'];

const DEFAULT_GPT_SIZES = {
  topo: '[320,100]',
  rodape: '[320,100]',
  intersticial: '[320,100]',
  'entre-mensagens': '[300,100]'
};

function createAdsRowId() {
  return `ad_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAdsPosition(rawValue) {
  const value = String(rawValue || '').trim().toLowerCase();
  if (value === 'entre_mensagens') return 'entre-mensagens';
  if (ADS_POSITION_OPTIONS.some((item) => item.value === value)) return value;
  return '';
}

function defaultGptSizesByPosition(position) {
  const normalized = normalizeAdsPosition(position);
  return DEFAULT_GPT_SIZES[normalized] || DEFAULT_GPT_SIZES.topo;
}

function getAdsPositionLabel(position) {
  return ADS_POSITION_OPTIONS.find((option) => option.value === position)?.label || position;
}

function looksLikeHtmlSnippet(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return false;
  return /<\/?[a-z][\s\S]*>/i.test(value) || /&lt;\/?[a-z][\s\S]*&gt;/i.test(value);
}

function extractGptSlotFromCode(rawCode) {
  const source = String(rawCode || '');
  const fromDefineSlot = source.match(/defineSlot\(\s*['"]([^'"]+)['"]/i)?.[1];
  if (fromDefineSlot) return String(fromDefineSlot).trim();

  const compact = String(rawCode || '').trim();
  if (compact.startsWith('/') && !looksLikeHtmlSnippet(compact)) {
    return compact;
  }

  return '';
}

function extractGptDivIdFromCode(rawCode) {
  const source = String(rawCode || '');
  const fromDefineSlot = source.match(/defineSlot\(\s*['"][^'"]+['"]\s*,\s*\[[^\]]+\]\s*,\s*['"]([^'"]+)['"]/i)?.[1];
  if (fromDefineSlot) return String(fromDefineSlot).trim();

  const fromDisplay = source.match(/display\(\s*['"]([^'"]+)['"]\s*\)/i)?.[1];
  if (fromDisplay) return String(fromDisplay).trim();

  return '';
}

function normalizeAdContract(source, position) {
  const ad = toObject(source);
  const code = String(ad.codigo_tag || ad.codigo || '').trim();
  const explicitSlot = String(ad.gpt_slot || '').trim();
  const explicitDivId = String(ad.gpt_div_id || '').trim();
  const explicitFixed = String(ad.anuncio_fixed || ad.html || '').trim();
  const rotulo = (() => {
    const raw = String(ad.rotulo || '').trim();
    return (raw || 'PUBLICIDADE').slice(0, 100);
  })();

  const gptSlot = explicitSlot || extractGptSlotFromCode(code);
  const gptDivId = explicitDivId || extractGptDivIdFromCode(code);
  const anuncioFixed = explicitFixed || (!gptSlot && looksLikeHtmlSnippet(code) ? code : '');
  const storageCode = code || gptSlot || anuncioFixed;

  return {
    codigo_tag: storageCode,
    gpt_slot: gptSlot,
    gpt_div_id: gptDivId,
    anuncio_fixed: anuncioFixed,
    gpt_sizes: String(ad.gpt_sizes || defaultGptSizesByPosition(position)).trim() || defaultGptSizesByPosition(position),
    rotulo,
    rotuloAtivo: ad.rotuloAtivo !== false,
    ativo: ad.ativo !== false
  };
}

function hasAdCode(ad) {
  return Boolean(
    String(ad?.codigo_tag || ad?.codigo || ad?.gpt_slot || ad?.anuncio_fixed || '').trim()
  );
}

function createEmptyAdsConfig() {
  return {
    topo: null,
    rodape: null,
    intersticial: null,
    entre_mensagens: null
  };
}

function createSimpleAd(position, source = {}) {
  const normalized = normalizeAdContract(source, position);
  return {
    id: String(toObject(source).id || createAdsRowId()),
    codigo_tag: normalized.codigo_tag,
    gpt_slot: normalized.gpt_slot,
    gpt_div_id: normalized.gpt_div_id,
    anuncio_fixed: normalized.anuncio_fixed,
    gpt_sizes: normalized.gpt_sizes,
    rotulo: normalized.rotulo,
    rotuloAtivo: normalized.rotuloAtivo !== false,
    ativo: normalized.ativo !== false
  };
}

function createSequenceAd(source = {}) {
  const normalized = normalizeAdContract(source, 'entre-mensagens');
  return {
    id: String(toObject(source).id || createAdsRowId()),
    codigo_tag: normalized.codigo_tag,
    gpt_slot: normalized.gpt_slot,
    gpt_div_id: normalized.gpt_div_id,
    anuncio_fixed: normalized.anuncio_fixed,
    gpt_sizes: normalized.gpt_sizes,
    rotulo: normalized.rotulo,
    rotuloAtivo: normalized.rotuloAtivo !== false,
    ativo: normalized.ativo !== false
  };
}

function parseInterval(rawValue, fallback = 1) {
  const parsed = Number(rawValue);
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  return fallback;
}

function buildAdsConfigFromSource(rawConfig) {
  const config = toObject(rawConfig);
  const next = createEmptyAdsConfig();

  SIMPLE_AD_POSITIONS.forEach((position) => {
    const normalizedPosition = normalizeAdsPosition(position);
    const ad = createSimpleAd(normalizedPosition, config[normalizedPosition]);
    if (!hasAdCode(ad)) return;
    next[normalizedPosition] = ad;
  });

  const between = toObject(config['entre-mensagens'] || config.entre_mensagens);
  const interval = String(parseInterval(between.intervalo_mensagens, 1));
  const sequence = Array.isArray(between.sequence_ads) ? between.sequence_ads : [];
  const sequenceAds = sequence
    .map((item) => createSequenceAd(item))
    .filter((item) => hasAdCode(item));

  if (sequenceAds.length > 0) {
    next.entre_mensagens = {
      id: String(between.id || createAdsRowId()),
      ativo: between.ativo !== false,
      intervalo_mensagens: interval,
      sequence_ads: sequenceAds
    };
  }

  return next;
}

function buildAdsPayloadFromConfig(rawConfig) {
  const source = toObject(rawConfig);
  const payload = {};

  SIMPLE_AD_POSITIONS.forEach((position) => {
    const ad = toObject(source[position]);
    const normalized = normalizeAdContract(ad, position);
    if (!hasAdCode(normalized)) return;
    payload[position] = {
      codigo_tag: normalized.codigo_tag,
      gpt_slot: normalized.gpt_slot || null,
      gpt_div_id: normalized.gpt_div_id || null,
      anuncio_fixed: normalized.anuncio_fixed || null,
      gpt_sizes: normalized.gpt_sizes,
      rotulo: normalized.rotulo,
      rotuloAtivo: normalized.rotuloAtivo !== false,
      ativo: normalized.ativo !== false
    };
  });

  const between = toObject(source.entre_mensagens || source['entre-mensagens']);
  const sequenceSource = Array.isArray(between.sequence_ads) ? between.sequence_ads : [];
  const sequenceAds = sequenceSource
    .map((entry, index) => {
      const ad = normalizeAdContract(entry, 'entre-mensagens');
      if (!hasAdCode(ad)) return null;
      return {
        id: String(toObject(entry).id || `seq_${index + 1}`),
        codigo_tag: ad.codigo_tag,
        gpt_slot: ad.gpt_slot || null,
        gpt_div_id: ad.gpt_div_id || null,
        anuncio_fixed: ad.anuncio_fixed || null,
        gpt_sizes: ad.gpt_sizes,
        rotulo: ad.rotulo,
        rotuloAtivo: ad.rotuloAtivo !== false,
        ativo: ad.ativo !== false
      };
    })
    .filter(Boolean);

  if (sequenceAds.length > 0) {
    payload.entre_mensagens = {
      ativo: between.ativo !== false,
      intervalo_mensagens: parseInterval(between.intervalo_mensagens, 1),
      sequence_ads: sequenceAds
    };
  }

  return payload;
}

function createAdsEditor(position, source = {}, options = {}) {
  const normalizedPosition = normalizeAdsPosition(position) || 'topo';
  const mode = options.mode || 'create';
  const originPosition = normalizeAdsPosition(options.originPosition) || '';
  const forceAdvanced = options.showAdvanced === true;

  if (normalizedPosition === 'entre-mensagens') {
    const between = toObject(source);
    const sequenceRaw = Array.isArray(between.sequence_ads) ? between.sequence_ads : [];
    const sequenceAds = sequenceRaw
      .map((entry) => createSequenceAd(entry))
      .filter((entry) => hasAdCode(entry));
    if (sequenceAds.length === 0) {
      sequenceAds.push(createSequenceAd());
    }
    const activeTabRaw = Number(options.activeTab ?? between.active_tab ?? 0);
    const activeTab =
      Number.isFinite(activeTabRaw) && activeTabRaw >= 0
        ? Math.min(Math.floor(activeTabRaw), Math.max(0, sequenceAds.length - 1))
        : 0;

    return {
      mode,
      originPosition,
      position: normalizedPosition,
      show_advanced:
        forceAdvanced ||
        Boolean(
          String(between.gpt_slot || between.gpt_div_id || between.anuncio_fixed || '').trim() ||
            sequenceAds.some((entry) =>
              String(entry.gpt_slot || entry.gpt_div_id || entry.anuncio_fixed || '').trim()
            )
        ),
      ativo: between.ativo !== false,
      intervalo_mensagens: String(parseInterval(between.intervalo_mensagens, 1)),
      sequence_ads: sequenceAds,
      active_tab: activeTab
    };
  }

  const ad = createSimpleAd(normalizedPosition, source);
  return {
    mode,
    originPosition,
    position: normalizedPosition,
    show_advanced:
      forceAdvanced ||
      Boolean(String(ad.gpt_slot || ad.gpt_div_id || ad.anuncio_fixed || '').trim()),
    ativo: ad.ativo !== false,
    codigo_tag: String(ad.codigo_tag || ''),
    gpt_slot: String(ad.gpt_slot || ''),
    gpt_div_id: String(ad.gpt_div_id || ''),
    anuncio_fixed: String(ad.anuncio_fixed || ''),
    gpt_sizes: String(ad.gpt_sizes || defaultGptSizesByPosition(normalizedPosition)),
    rotulo: String(ad.rotulo || 'PUBLICIDADE'),
    rotuloAtivo: ad.rotuloAtivo !== false
  };
}

function isSimplePositionInUse(configRaw, position) {
  const config = toObject(configRaw);
  const ad = toObject(config[position]);
  return hasAdCode(ad);
}

function canSelectPosition(configRaw, optionPosition, currentPosition = '') {
  const normalizedOption = normalizeAdsPosition(optionPosition);
  const normalizedCurrent = normalizeAdsPosition(currentPosition);
  if (normalizedOption === 'entre-mensagens') return true;
  if (normalizedOption === normalizedCurrent) return true;
  return !isSimplePositionInUse(configRaw, normalizedOption);
}

function resolveNextCreatePosition(configRaw) {
  const config = toObject(configRaw);
  const firstAvailableSimple = SIMPLE_AD_POSITIONS.find((position) => !isSimplePositionInUse(config, position));
  if (firstAvailableSimple) return firstAvailableSimple;
  return 'entre-mensagens';
}

function cloneAdsConfig(configRaw) {
  const config = toObject(configRaw);
  const between = toObject(config.entre_mensagens);
  const sequence = Array.isArray(between.sequence_ads) ? between.sequence_ads : [];

  return {
    topo: hasAdCode(config.topo) ? { ...toObject(config.topo) } : null,
    rodape: hasAdCode(config.rodape) ? { ...toObject(config.rodape) } : null,
    intersticial: hasAdCode(config.intersticial) ? { ...toObject(config.intersticial) } : null,
    entre_mensagens:
      sequence.length > 0
        ? {
            ...between,
            sequence_ads: sequence.map((entry) => ({ ...toObject(entry) }))
          }
        : null
  };
}

function WebchatsSkeleton({ rows = 4 }) {
  return (
    <Stack spacing={1.25}>
      {Array.from({ length: rows }).map((_, i) => (
        <Box
          key={i}
          sx={{
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            p: 1.5
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="36%" height={26} />
              <Skeleton variant="text" width="58%" />
            </Box>
            <Skeleton variant="rounded" width={120} height={28} />
          </Stack>
        </Box>
      ))}
    </Stack>
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
function WebchatFormDialog({
  open,
  mode,
  initialData,
  activeAgents,
  projects,
  availableDomains,
  loading,
  error,
  onOpenDomainsSettings,
  onClose,
  onSubmit
}) {
  const isEdit = mode === 'edit';

  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [agentMode, setAgentMode] = useState('existing');
  const [agentId, setAgentId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [active, setActive] = useState(true);
  const [defaultCategory, setDefaultCategory] = useState('');
  const [headerAdsCode, setHeaderAdsCode] = useState('');
  const [footerAdsCode, setFooterAdsCode] = useState('');

  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDescription, setNewAgentDescription] = useState('');
  const [newPromptMestre, setNewPromptMestre] = useState(DEFAULT_AGENT_PROMPT);
  // Toggles de captura de lead (default OFF). Quando ambos OFF, o agente
  // pula a captação inteira e parte direto pra ajudar com o tema.
  const [newCaptarTelefone, setNewCaptarTelefone] = useState(false);
  const [newCaptarEmail, setNewCaptarEmail] = useState(false);

  const [formValidationError, setFormValidationError] = useState('');
  const normalizedDomain = useMemo(() => normalizeDomain(domain), [domain]);
  const selectableDomains = useMemo(() => {
    const map = new Map();
    toArray(availableDomains).forEach((entry) => {
      const value = normalizeDomain(entry?.domain);
      if (!value) return;
      map.set(value, entry);
    });

    const currentDomain = normalizeDomain(initialData?.domain || '');
    if (isEdit && currentDomain && !map.has(currentDomain)) {
      map.set(currentDomain, {
        id: `legacy-${currentDomain}`,
        domain: currentDomain,
        status: 'LEGACY'
      });
    }

    return Array.from(map.values());
  }, [availableDomains, initialData, isEdit]);
  const normalizedSelectableDomains = useMemo(
    () => selectableDomains.map((item) => normalizeDomain(item?.domain)).filter(Boolean),
    [selectableDomains]
  );
  const isDomainAvailable = useMemo(
    () => normalizedSelectableDomains.includes(normalizedDomain),
    [normalizedSelectableDomains, normalizedDomain]
  );

  const isDomainInputValid = useMemo(
    () => (normalizedDomain ? isValidDomain(normalizedDomain) : false),
    [normalizedDomain]
  );

  useEffect(() => {
    if (!open) return;

    const hasActiveAgents = activeAgents.length > 0;
    const currentAgentActive = Boolean(
      initialData?.agent_id && activeAgents.some((agent) => agent.id === initialData.agent_id)
    );

    const nextDomain =
      normalizeDomain(initialData?.domain || '') ||
      normalizeDomain(selectableDomains[0]?.domain || '');

    setName(initialData?.name || '');
    setDomain(nextDomain);
    setProjectId(initialData?.email_project_id || '');
    setActive(initialData?.active ?? true);
    setDefaultCategory(
      initialData?.settings?.categoria_padrao ||
        initialData?.categoria_padrao ||
        ''
    );
    setHeaderAdsCode(
      String(
        initialData?.header_scripts ||
          initialData?.header_ads_code ||
          initialData?.settings?.header_ads_code ||
          ''
      )
    );
    setFooterAdsCode(
      String(
        initialData?.footer_scripts ||
          initialData?.footer_ads_code ||
          initialData?.settings?.footer_ads_code ||
          ''
      )
    );

    if (isEdit) {
      setAgentMode(hasActiveAgents ? 'existing' : 'create');
      if (currentAgentActive) {
        setAgentId(initialData.agent_id);
      } else if (hasActiveAgents) {
        setAgentId(activeAgents[0]?.id || '');
      } else {
        setAgentId('');
      }
    } else {
      setAgentMode(hasActiveAgents ? 'existing' : 'create');
      setAgentId(hasActiveAgents ? activeAgents[0]?.id || '' : '');
    }

    setNewAgentName('');
    setNewAgentDescription('');
    setNewPromptMestre(DEFAULT_AGENT_PROMPT);
    setFormValidationError('');
  }, [open, initialData, isEdit, activeAgents, selectableDomains]);

  useEffect(() => {
    if (!open) return;

    if (activeAgents.length === 0) {
      setAgentMode('create');
      setAgentId('');
      return;
    }

    if (agentMode === 'existing' && !agentId) {
      setAgentId(activeAgents[0]?.id || '');
    }
  }, [open, activeAgents, agentMode, agentId]);

  const submitValidationError = useMemo(() => {
    if (loading) return 'Aguarde o processamento atual finalizar.';
    if (!name.trim()) return 'Informe o nome do webchat.';
    if (!normalizedDomain) return 'Selecione um domínio para o webchat.';
    if (!isDomainInputValid) return 'Digite um domínio válido (ex: chat.suaempresa.com).';
    if (!isDomainAvailable) return 'Selecione um domínio da lista de domínios cadastrados.';

    if (agentMode === 'existing') {
      if (!agentId) return 'Selecione um agente ativo.';
      return '';
    }

    if (!newAgentName.trim()) return 'Informe o nome do agente.';
    if (!newPromptMestre.trim()) return 'Informe o prompt mestre do agente.';

    return '';
  }, [
    loading,
    name,
    normalizedDomain,
    isDomainInputValid,
    isDomainAvailable,
    agentMode,
    agentId,
    newAgentName,
    newPromptMestre
  ]);

  const canSubmit = !submitValidationError;

  useEffect(() => {
    if (!formValidationError) return;
    if (!submitValidationError) {
      setFormValidationError('');
    }
  }, [formValidationError, submitValidationError]);

  const domainHelperText = useMemo(() => {
    if (!selectableDomains.length) {
      return 'Nenhum domínio disponível. Cadastre um domínio na aba Webchat.';
    }
    if (!domain.trim()) {
      return 'Selecione um domínio cadastrado para publicação do webchat.';
    }
    if (!isDomainInputValid) {
      return 'Digite um domínio válido (ex: chat.suaempresa.com).';
    }
    if (!isDomainAvailable) {
      return 'Selecione um domínio da lista.';
    }
    return 'Domínio cadastrado e liberado para uso no webchat.';
  }, [domain, isDomainInputValid, isDomainAvailable, selectableDomains.length]);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!canSubmit) {
      setFormValidationError(submitValidationError);
      return;
    }
    setFormValidationError('');
    const existingSettings = toObject(initialData?.settings);
    const categoria = defaultCategory.trim();
    const headerCode = headerAdsCode.trim();
    const footerCode = footerAdsCode.trim();
    const nextSettings = {
      ...existingSettings,
      categoria_padrao: categoria || null,
      header_ads_code: headerCode || null,
      footer_ads_code: footerCode || null
    };

    const basePayload = {
      name: name.trim(),
      domain: normalizedDomain,
      email_project_id: projectId || null,
      active,
      settings: nextSettings,
      header_scripts: headerCode || null,
      footer_scripts: footerCode || null
    };

    if (agentMode === 'existing') {
      onSubmit({
        ...basePayload,
        agentMode: 'existing',
        agent_id: agentId
      });
      return;
    }

    onSubmit({
      ...basePayload,
      agentMode: 'create',
      newAgent: {
        name: newAgentName.trim(),
        description: newAgentDescription.trim() || null,
        active: true,
        ia_config: {
          prompt_mestre: newPromptMestre.trim(),
          captar_telefone: Boolean(newCaptarTelefone),
          captar_email: Boolean(newCaptarEmail)
        }
      }
    });
  };

  return (
    <>
      <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="md">
        <DialogTitle>{isEdit ? 'Editar webchat' : 'Novo webchat'}</DialogTitle>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <DialogContent sx={{ pt: 1.5 }}>
            <Stack spacing={2}>
              {error ? <Alert severity="error">{error}</Alert> : null}
              {formValidationError ? <Alert severity="warning">{formValidationError}</Alert> : null}

              <TextField label="Nome" value={name} onChange={(e) => setName(e.target.value)} fullWidth required autoFocus />

              <TextField
                select
                label="Domínio"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                fullWidth
                required
                disabled={loading || selectableDomains.length === 0}
                error={Boolean(domain.trim()) && !isDomainInputValid}
                helperText={domainHelperText}
              >
                {selectableDomains.length === 0 ? (
                  <MenuItem value="" disabled>
                    Nenhum domínio disponível
                  </MenuItem>
                ) : (
                  selectableDomains.map((entry) => {
                    const value = normalizeDomain(entry?.domain);
                    const label = value || '-';
                    const status = String(entry?.status || '').toUpperCase();
                    const suffix = status === 'LEGACY' ? ' (domínio legado)' : '';
                    return (
                      <MenuItem key={entry?.id || value} value={value}>
                        {label}
                        {suffix}
                      </MenuItem>
                    );
                  })
                )}
              </TextField>

              <TextField
                label="Categoria padrão (opcional)"
                value={defaultCategory}
                onChange={(e) => setDefaultCategory(e.target.value)}
                fullWidth
                placeholder="esportes, finanças, saúde..."
                helperText="Usada como categoria base do conteúdo/respostas."
              />

              {selectableDomains.length === 0 ? (
                  <Alert
                    severity="warning"
                    action={
                      <Button size="small" color="inherit" onClick={onOpenDomainsSettings}>
                        Ir para Domínios
                      </Button>
                    }
                  >
                  Antes de criar um webchat, cadastre um domínio em Configurações &gt; Conta & Domínios &gt; Webchat.
                </Alert>
              ) : null}

              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.default'
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Agente de IA
                </Typography>

                <RadioGroup row value={agentMode} onChange={(e) => setAgentMode(e.target.value)}>
                  <FormControlLabel
                    value="existing"
                    control={<Radio color="secondary" />}
                    label="Vincular agente ativo"
                    disabled={activeAgents.length === 0}
                  />
                  <FormControlLabel value="create" control={<Radio color="secondary" />} label="Criar agente agora" />
                </RadioGroup>

                {activeAgents.length === 0 ? (
                  <Alert severity="info" sx={{ mt: 1.25 }}>
                    Não há agentes ativos. Crie um novo agente agora para concluir este webchat.
                  </Alert>
                ) : null}

                {agentMode === 'existing' ? (
                  <TextField
                    sx={{ mt: 1.25 }}
                    select
                    label="Agente ativo"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    fullWidth
                    required
                    helperText="Somente agentes ativos podem ser vinculados."
                  >
                    <MenuItem value="" disabled>
                      Selecione um agente ativo
                    </MenuItem>
                    {activeAgents.map((agent) => (
                      <MenuItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <Stack spacing={1.25} sx={{ mt: 1.25 }}>
                    <TextField
                      label="Nome do agente"
                      value={newAgentName}
                      onChange={(e) => setNewAgentName(e.target.value)}
                      fullWidth
                      required
                    />

                    <TextField
                      label="Descrição do agente"
                      value={newAgentDescription}
                      onChange={(e) => setNewAgentDescription(e.target.value)}
                      fullWidth
                    />

                    <TextField
                      label="Prompt mestre"
                      value={newPromptMestre}
                      onChange={(e) => setNewPromptMestre(e.target.value)}
                      fullWidth
                      multiline
                      minRows={4}
                      required
                      helperText="Default: Você é um assistente simpático."
                    />

                    <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.5, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                        Captação de lead
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Defina quais dados o chat vai pedir antes de ajudar. O nome só é solicitado quando ao menos uma das opções abaixo está ativa. Com as duas desligadas, o chat parte direto pra ajudar com o tema.
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Switch
                          checked={newCaptarTelefone}
                          onChange={(e) => setNewCaptarTelefone(e.target.checked)}
                          color="secondary"
                        />
                        <Typography variant="body2">Captar Telefone</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Switch
                          checked={newCaptarEmail}
                          onChange={(e) => setNewCaptarEmail(e.target.checked)}
                          color="secondary"
                        />
                        <Typography variant="body2">Captar E-mail</Typography>
                      </Stack>
                    </Box>

                  </Stack>
                )}
              </Box>

              <TextField
                select
                label="Projeto de e-mail (opcional)"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                fullWidth
                helperText="Se definido, os leads são roteados para email_leads + email_project_leads."
              >
                <MenuItem value="">Sem projeto</MenuItem>
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Código do Header para anúncios"
                value={headerAdsCode}
                onChange={(e) => setHeaderAdsCode(e.target.value)}
                fullWidth
                multiline
                minRows={4}
                maxRows={8}
                placeholder='<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"></script>'
                helperText="Script base carregado no header público do webchat para habilitar anúncios."
              />

              <TextField
                label="Códigos do Rodapé/Footer"
                value={footerAdsCode}
                onChange={(e) => setFooterAdsCode(e.target.value)}
                fullWidth
                multiline
                minRows={4}
                maxRows={8}
                placeholder={"<!-- Meta Pixel, GA4, Hotjar, etc -->\n<script>\n  // tracking code aqui\n</script>"}
                helperText="HTML/scripts injetados no rodapé do webchat (antes de </body>). Ideal para pixels de conversão, GA4, Hotjar e demais ferramentas de tracking."
              />

              <Stack direction="row" spacing={1} alignItems="center">
                <Switch checked={active} onChange={(e) => setActive(e.target.checked)} color="secondary" />
                <Typography variant="body2" color="text.secondary">
                  Webchat ativo
                </Typography>
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button type="button" onClick={onClose} disabled={loading} variant="outlined" sx={{ borderRadius: 2 }}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              variant="contained"
              color="secondary"
              startIcon={loading ? <CircularProgress size={16} /> : null}
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              {isEdit ? 'Salvar' : 'Criar'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

    </>
  );
}

function WebchatAdvancedDialog({
  open,
  chat,
  loading,
  error,
  onClose,
  onSubmit
}) {
  const [settingsJson, setSettingsJson] = useState('{}');
  const [popupEnabled, setPopupEnabled] = useState(false);
  const [popupIntervalMinutes, setPopupIntervalMinutes] = useState('10');
  const [popupTitle, setPopupTitle] = useState('Você está no chat por mais de {X} min, atualize a página!');
  const [popupMessage, setPopupMessage] = useState('Para carregar novos anúncios intersticiais, atualize a página e continue o chat.');
  const [popupCtaLabel, setPopupCtaLabel] = useState('ATUALIZAR');

  useEffect(() => {
    if (!open) return;
    const settings = toObject(chat?.settings);
    const popup = toObject(
      settings.interstitial_refresh_popup ||
        settings.interstitialPopup ||
        settings.popup_interstitial_refresh
    );

    setSettingsJson(stringifyJson(settings));
    setPopupEnabled(popup.enabled === true);
    setPopupIntervalMinutes(String(parseInterval(popup.interval_minutes ?? popup.minutes ?? popup.interval, 10)));
    setPopupTitle(String(popup.title || 'Você está no chat por mais de {X} min, atualize a página!'));
    setPopupMessage(String(popup.message || 'Para carregar novos anúncios intersticiais, atualize a página e continue o chat.'));
    setPopupCtaLabel(String(popup.cta_label || popup.ctaText || 'ATUALIZAR'));
  }, [open, chat]);

  const settingsError = useMemo(() => {
    try {
      parseJsonObject(settingsJson, 'Settings');
      return '';
    } catch (err) {
      return err?.message || 'Settings inválido.';
    }
  }, [settingsJson]);

  const canSubmit = !loading && !settingsError;

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    try {
      const intervalMinutes = parseInterval(popupIntervalMinutes, 10);
      const popupConfig = {
        enabled: popupEnabled,
        interval_minutes: intervalMinutes,
        title: String(popupTitle || '').trim() || 'Você está no chat por mais de {X} min, atualize a página!',
        message:
          String(popupMessage || '').trim() ||
          'Para carregar novos anúncios intersticiais, atualize a página e continue o chat.',
        cta_label: String(popupCtaLabel || '').trim() || 'ATUALIZAR'
      };

      onSubmit({
        settings: {
          ...parseJsonObject(settingsJson, 'Settings'),
          interstitial_refresh_popup: popupConfig
        }
      });
    } catch {
      // erros já tratados pelos helpers visuais
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Personalizações avançadas</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent sx={{ pt: 1.5 }}>
          <Stack spacing={1.5}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 1.25,
                bgcolor: 'background.default'
              }}
            >
              <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Pop-up de recarga do intersticial
                  </Typography>
                  <FormControlLabel
                    sx={{ m: 0 }}
                    control={
                      <Switch
                        checked={popupEnabled}
                        onChange={(e) => setPopupEnabled(e.target.checked)}
                        color="secondary"
                      />
                    }
                    label="Ativo"
                    labelPlacement="start"
                  />
                </Stack>

                <TextField
                  label="Tempo (minutos)"
                  type="number"
                  value={popupIntervalMinutes}
                  onChange={(e) => setPopupIntervalMinutes(e.target.value)}
                  fullWidth
                  inputProps={{ min: 1, step: 1 }}
                  helperText="Use {X} no texto para mostrar automaticamente a quantidade de minutos."
                />

                <TextField
                  label="Texto principal"
                  value={popupTitle}
                  onChange={(e) => setPopupTitle(e.target.value)}
                  fullWidth
                />

                <TextField
                  label="Mensagem complementar"
                  value={popupMessage}
                  onChange={(e) => setPopupMessage(e.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={2}
                />

                <TextField
                  label="Texto do botão (CTA)"
                  value={popupCtaLabel}
                  onChange={(e) => setPopupCtaLabel(e.target.value)}
                  fullWidth
                />
              </Stack>
            </Box>

            <TextField
              label="Settings do webchat (JSON)"
              value={settingsJson}
              onChange={(e) => setSettingsJson(e.target.value)}
              fullWidth
              multiline
              minRows={12}
              maxRows={12}
              error={Boolean(settingsError)}
              helperText={settingsError || 'Inclui personalizacao, welcomeScreen, quickReplies e categoria_padrao.'}
              inputProps={{ style: { fontFamily: 'monospace' } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button type="button" onClick={onClose} disabled={loading} variant="outlined" sx={{ borderRadius: 2 }}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
            variant="contained"
            color="secondary"
            startIcon={loading ? <CircularProgress size={16} /> : <TuneRoundedIcon fontSize="small" />}
            sx={{ borderRadius: 2, fontWeight: 900 }}
          >
            Salvar avançado
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function WebchatAdsDialog({
  open,
  chat,
  adsConfig,
  editor,
  loading,
  error,
  onClose,
  onStartAdd,
  onCancelEditor,
  onSaveEditor,
  onEditorPositionChange,
  onEditorFieldChange,
  onEditorIntervalChange,
  onEditorSequenceChange,
  onEditorCodeTagPaste,
  onEditorBetweenFieldBlur,
  onEditorBetweenTabChange,
  onEditorBetweenAddTab,
  onEditorBetweenDeleteTab,
  onEditSimple,
  onDeleteSimple,
  onToggleSimple,
  onEditBetween,
  onDeleteBetween,
  onToggleBetween
}) {
  const simpleCards = SIMPLE_AD_POSITIONS.map((position) => ({
    position,
    ad: toObject(adsConfig?.[position])
  })).filter((entry) => hasAdCode(entry.ad));

  const between = toObject(adsConfig?.entre_mensagens);
  const betweenSequence = Array.isArray(between.sequence_ads) ? between.sequence_ads : [];
  const hasBetweenCard = betweenSequence.length > 0;
  const editorBetweenSequence =
    editor?.position === 'entre-mensagens' && Array.isArray(editor?.sequence_ads)
      ? editor.sequence_ads
      : [];
  const editorBetweenTabRaw = Number(editor?.active_tab ?? 0);
  const editorBetweenTab =
    Number.isFinite(editorBetweenTabRaw) && editorBetweenTabRaw >= 0
      ? Math.min(Math.floor(editorBetweenTabRaw), Math.max(0, editorBetweenSequence.length - 1))
      : 0;
  const editorBetweenAd = editorBetweenSequence[editorBetweenTab] || null;

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    onSaveEditor();
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Anúncios - {chat?.name || 'Webchat'}</DialogTitle>
      <DialogContent sx={{ pt: 1.5 }}>
        <Stack spacing={1.25}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Button
            onClick={onStartAdd}
            variant="contained"
            color="secondary"
            startIcon={<AddRoundedIcon fontSize="small" />}
            disabled={loading || Boolean(editor)}
            sx={{ alignSelf: 'flex-start', borderRadius: 2, fontWeight: 800 }}
          >
            Adicionar anúncio
          </Button>

          {editor ? (
            <Box
              component="form"
              onSubmit={handleSubmit}
              noValidate
              sx={{
                border: '1px solid',
                borderColor: 'secondary.main',
                borderRadius: 2,
                p: 1.25,
                bgcolor: 'background.default',
                boxShadow: (theme) => `0 0 0 1px ${theme.palette.secondary.main}22`
              }}
            >
              <Stack spacing={1.25}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  {editor.mode === 'edit' ? 'Editar anúncio' : 'Novo anúncio'}
                </Typography>

                <TextField
                  select
                  label="Posicionamento"
                  value={editor.position}
                  onChange={(e) => onEditorPositionChange(e.target.value)}
                  fullWidth
                >
                  {ADS_POSITION_OPTIONS.map((option) => (
                    <MenuItem
                      key={option.value}
                      value={option.value}
                      disabled={!canSelectPosition(adsConfig, option.value, editor.position)}
                    >
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="button"
                    size="small"
                    variant={editor.show_advanced ? 'contained' : 'outlined'}
                    color="inherit"
                    onClick={() => onEditorFieldChange('show_advanced', !editor.show_advanced)}
                    sx={{ borderRadius: 2, fontWeight: 700 }}
                  >
                    {editor.show_advanced ? 'Ocultar campos avançados' : 'Campos avançados (opcional)'}
                  </Button>
                </Box>

                {editor.position === 'entre-mensagens' ? (
                  <>
                    <TextField
                      label="A cada quantas mensagens?"
                      type="number"
                      value={editor.intervalo_mensagens}
                      onChange={(e) => onEditorIntervalChange(e.target.value)}
                      onBlur={onEditorBetweenFieldBlur}
                      fullWidth
                      inputProps={{ min: 1, step: 1 }}
                    />

                    <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Tabs
                        value={editorBetweenTab}
                        onChange={(_, value) => {
                          if (value === '__add__') {
                            onEditorBetweenAddTab();
                            return;
                          }
                          onEditorBetweenTabChange(value);
                        }}
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                        textColor="secondary"
                        indicatorColor="secondary"
                        sx={(theme) => ({
                          minHeight: 30,
                          '& .MuiTab-root': {
                            minHeight: 30,
                            minWidth: 34,
                            px: 1,
                            py: 0.25,
                            color: theme.palette.secondary.dark,
                            fontWeight: 700,
                            fontSize: 12,
                            lineHeight: 1.1,
                            borderRadius: 1.5,
                            mx: 0.25
                          },
                          '& .MuiTab-root.Mui-selected': {
                            color: theme.palette.common.white,
                            bgcolor: theme.palette.secondary.main
                          },
                          '& .MuiTabs-indicator': {
                            display: 'none'
                          }
                        })}
                      >
                        {editorBetweenSequence.map((item, index) => (
                          <Tab
                            key={item.id || `tab-${index}`}
                            value={index}
                            label={String(index + 1)}
                            disabled={loading}
                          />
                        ))}
                        <Tab
                          value="__add__"
                          label={
                            <Box component="span" sx={{ fontSize: 14, fontWeight: 800, lineHeight: 1 }}>
                              +
                            </Box>
                          }
                          disabled={loading}
                        />
                      </Tabs>
                    </Box>

                    {editorBetweenAd ? (
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="flex-end">
                          <Button
                            type="button"
                            size="small"
                            color="error"
                            onClick={() => onEditorBetweenDeleteTab(editorBetweenTab)}
                            disabled={loading}
                          >
                            Excluir anúncio atual
                          </Button>
                        </Stack>

                        <TextField
                          label="Código/Tag"
                          value={editorBetweenAd.codigo_tag}
                          onChange={(e) =>
                            onEditorSequenceChange(editorBetweenAd.id, {
                              codigo_tag: e.target.value
                            })
                          }
                          onPaste={() => {
                            requestAnimationFrame(() => {
                              onEditorCodeTagPaste();
                            });
                          }}
                          onBlur={onEditorBetweenFieldBlur}
                          fullWidth
                          multiline
                          minRows={3}
                          maxRows={3}
                          placeholder="Cole aqui o código fornecido pelo Google AdManager ou AdSense..."
                          inputProps={{ style: { fontFamily: 'monospace' } }}
                        />

                        <FormControlLabel
                          control={
                            <Switch
                              checked={editorBetweenAd.rotuloAtivo !== false}
                              onChange={(e) =>
                                onEditorSequenceChange(editorBetweenAd.id, {
                                  rotuloAtivo: e.target.checked
                                })
                              }
                              color="secondary"
                            />
                          }
                          label="Exibir rótulo de publicidade"
                        />
                        <TextField
                          label="Rótulo"
                          value={editorBetweenAd.rotulo ?? 'PUBLICIDADE'}
                          onChange={(e) =>
                            onEditorSequenceChange(editorBetweenAd.id, {
                              rotulo: e.target.value
                            })
                          }
                          onBlur={onEditorBetweenFieldBlur}
                          fullWidth
                          disabled={editorBetweenAd.rotuloAtivo === false}
                          inputProps={{ maxLength: 100 }}
                          placeholder="PUBLICIDADE"
                          helperText={
                            editorBetweenAd.rotuloAtivo === false
                              ? 'Rótulo desativado — nada será exibido acima do anúncio.'
                              : 'Texto discreto exibido acima do anúncio. Ajuda no compliance com Google AdSense/AdManager.'
                          }
                        />

                        <TextField
                          label="gpt_sizes"
                          value={editorBetweenAd.gpt_sizes}
                          onChange={(e) =>
                            onEditorSequenceChange(editorBetweenAd.id, {
                              gpt_sizes: e.target.value
                            })
                          }
                          onBlur={onEditorBetweenFieldBlur}
                          fullWidth
                          placeholder="Ex: 320x100 ou [320,100]"
                        />

                        {editor.show_advanced ? (
                          <>
                            <TextField
                              label="gpt_slot (opcional)"
                              value={editorBetweenAd.gpt_slot || ''}
                              onChange={(e) =>
                                onEditorSequenceChange(editorBetweenAd.id, {
                                  gpt_slot: e.target.value
                                })
                              }
                              onBlur={onEditorBetweenFieldBlur}
                              fullWidth
                              placeholder="Ex: /123456/site/inside_message"
                            />

                            <TextField
                              label="gpt_div_id (opcional)"
                              value={editorBetweenAd.gpt_div_id || ''}
                              onChange={(e) =>
                                onEditorSequenceChange(editorBetweenAd.id, {
                                  gpt_div_id: e.target.value
                                })
                              }
                              onBlur={onEditorBetweenFieldBlur}
                              fullWidth
                              placeholder="Ex: gpt-ad-inline"
                            />

                            <TextField
                              label="HTML do anúncio fixo (opcional)"
                              value={editorBetweenAd.anuncio_fixed || ''}
                              onChange={(e) =>
                                onEditorSequenceChange(editorBetweenAd.id, {
                                  anuncio_fixed: e.target.value
                                })
                              }
                              onBlur={onEditorBetweenFieldBlur}
                              fullWidth
                              multiline
                              minRows={2}
                              maxRows={4}
                              placeholder="Se preencher, tem prioridade sobre gpt_slot."
                            />
                          </>
                        ) : null}
                      </Stack>
                    ) : null}
                  </>
                ) : (
                  <>
                    <TextField
                      label="Código/Tag"
                      value={editor.codigo_tag}
                      onChange={(e) => onEditorFieldChange('codigo_tag', e.target.value)}
                      onPaste={() => {
                        requestAnimationFrame(() => {
                          onEditorCodeTagPaste();
                        });
                      }}
                      fullWidth
                      multiline
                      minRows={3}
                      maxRows={3}
                      placeholder="Cole aqui o código fornecido pelo Google AdManager ou AdSense..."
                      inputProps={{ style: { fontFamily: 'monospace' } }}
                    />

                    <FormControlLabel
                      control={
                        <Switch
                          checked={editor.rotuloAtivo !== false}
                          onChange={(e) => onEditorFieldChange('rotuloAtivo', e.target.checked)}
                          color="secondary"
                        />
                      }
                      label="Exibir rótulo de publicidade"
                    />
                    <TextField
                      label="Rótulo"
                      value={editor.rotulo ?? 'PUBLICIDADE'}
                      onChange={(e) => onEditorFieldChange('rotulo', e.target.value)}
                      fullWidth
                      disabled={editor.rotuloAtivo === false}
                      inputProps={{ maxLength: 100 }}
                      placeholder="PUBLICIDADE"
                      helperText={
                        editor.rotuloAtivo === false
                          ? 'Rótulo desativado — nada será exibido acima do anúncio.'
                          : 'Texto discreto exibido acima do anúncio. Ajuda no compliance com Google AdSense/AdManager.'
                      }
                    />

                    <TextField
                      label="gpt_sizes"
                      value={editor.gpt_sizes}
                      onChange={(e) => onEditorFieldChange('gpt_sizes', e.target.value)}
                      fullWidth
                      placeholder="Ex: 320x100 ou [320,100]"
                    />

                    {editor.show_advanced ? (
                      <>
                        <TextField
                          label="gpt_slot (opcional)"
                          value={editor.gpt_slot || ''}
                          onChange={(e) => onEditorFieldChange('gpt_slot', e.target.value)}
                          fullWidth
                          placeholder="Ex: /123456/site/topo"
                        />

                        <TextField
                          label="gpt_div_id (opcional)"
                          value={editor.gpt_div_id || ''}
                          onChange={(e) => onEditorFieldChange('gpt_div_id', e.target.value)}
                          fullWidth
                          placeholder="Ex: gpt-ad-topo"
                        />

                        <TextField
                          label="HTML do anúncio fixo (opcional)"
                          value={editor.anuncio_fixed || ''}
                          onChange={(e) => onEditorFieldChange('anuncio_fixed', e.target.value)}
                          fullWidth
                          multiline
                          minRows={2}
                          maxRows={4}
                          placeholder="Se preencher, tem prioridade sobre gpt_slot."
                        />
                      </>
                    ) : null}
                  </>
                )}

                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button type="button" onClick={onCancelEditor} disabled={loading} variant="outlined" sx={{ borderRadius: 2 }}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={editor.position === 'entre-mensagens' ? false : loading}
                    variant="contained"
                    color="secondary"
                    startIcon={<CampaignRoundedIcon fontSize="small" />}
                    sx={{ borderRadius: 2, fontWeight: 900 }}
                  >
                    {editor.position === 'entre-mensagens' ? 'Salvar anúncios do entre mensagens' : 'Salvar anúncio'}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          ) : null}

          <Stack spacing={1}>
            {simpleCards.map(({ position, ad }) => (
              <Box
                key={position}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 1.25,
                  bgcolor: 'background.default'
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                      {`Anúncio ${getAdsPositionLabel(position)}`}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      Anúncio ativo
                    </Typography>
                    <Switch
                      size="small"
                      checked={ad.ativo !== false}
                      onChange={(e) => onToggleSimple(position, e.target.checked)}
                      color="secondary"
                      disabled={loading}
                    />
                    <IconButton size="small" onClick={() => onEditSimple(position)} disabled={loading} sx={{ borderRadius: 2 }}>
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onDeleteSimple(position)}
                      disabled={loading}
                      sx={{ borderRadius: 2 }}
                    >
                      <DeleteRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </Box>
            ))}

            {hasBetweenCard ? (
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 1.25,
                  bgcolor: 'background.default'
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                        Anúncio Entre mensagens
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        Anúncio ativo
                      </Typography>
                      <Switch
                        size="small"
                        checked={between.ativo !== false}
                        onChange={(e) => onToggleBetween(e.target.checked)}
                        color="secondary"
                        disabled={loading}
                      />
                      <IconButton size="small" onClick={() => onEditBetween()} disabled={loading} sx={{ borderRadius: 2 }}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={onDeleteBetween}
                        disabled={loading}
                        sx={{ borderRadius: 2 }}
                      >
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>

                  <Stack spacing={0.75}>
                    {betweenSequence.map((item, index) => (
                      <Box
                        key={item.id}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          p: 1,
                          bgcolor: 'background.paper'
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                              {`Anúncio Entre mensagens #${index + 1}`}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              </Box>
            ) : null}

            {simpleCards.length === 0 && !hasBetweenCard && !editor ? (
              <Box
                sx={{
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 2,
                  textAlign: 'center',
                  bgcolor: 'background.paper'
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Nenhum anúncio cadastrado para este webchat.
                </Typography>
              </Box>
            ) : null}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button type="button" onClick={onClose} disabled={loading} variant="outlined" sx={{ borderRadius: 2 }}>
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Webchats() {
  const navigate = useNavigate();
  const { webchats, isLoading, error, mutate, refresh } = useWebchats();
  const { agentes, isLoading: agentesLoading, mutate: mutateAgentes } = useAgentes();
  const { emailProjects } = useEmailProjects();
  const {
    webchatDomains,
    error: webchatDomainsError
  } = useWebchatDomains();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formData, setFormData] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedData, setAdvancedData] = useState(null);
  const [adsOpen, setAdsOpen] = useState(false);
  const [adsData, setAdsData] = useState(null);
  const [adsConfig, setAdsConfig] = useState(createEmptyAdsConfig());
  const [adsEditor, setAdsEditor] = useState(null);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsError, setAdsError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // ===== Splits (pastas de webchats) =====
  const [splits, setSplits] = useState([]);
  const [activeSplitId, setActiveSplitId] = useState(null);
  const [weightDraft, setWeightDraft] = useState({});
  const [splitDialog, setSplitDialog] = useState({ open: false, mode: 'create', id: null, name: '' });
  const [splitToDelete, setSplitToDelete] = useState(null);

  const loadSplits = async () => {
    try {
      const data = await get('/webchat-splits');
      const list = Array.isArray(data) ? data : [];
      setSplits(list);
      setActiveSplitId((prev) =>
        prev && list.some((s) => s.id === prev)
          ? prev
          : list.find((s) => s.is_default)?.id || list[0]?.id || null
      );
    } catch (e) {
      // silencioso — a aba ainda funciona sem splits
    }
  };
  useEffect(() => {
    loadSplits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chats = useMemo(() => toArray(webchats), [webchats]);

  const activeSplit = useMemo(
    () => splits.find((s) => s.id === activeSplitId) || null,
    [splits, activeSplitId]
  );
  const filteredChats = useMemo(
    () => (activeSplitId ? chats.filter((c) => (c.split_id || null) === activeSplitId) : chats),
    [chats, activeSplitId]
  );

  const splitPublicUrl = (split) =>
    split ? `${window.location.origin}/webchat/splits/${split.slug}` : '';

  const handleCopySplitLink = async (split) => {
    try {
      await navigator.clipboard.writeText(splitPublicUrl(split));
      setActionError('');
      setActionSuccess('Link do split copiado.');
    } catch {
      setActionError('Não foi possível copiar o link.');
    }
  };

  const handleOpenSplitLink = (split) => {
    window.open(splitPublicUrl(split), '_blank', 'noopener,noreferrer');
  };

  const handleSubmitSplit = async () => {
    const name = String(splitDialog.name || '').trim();
    if (!name) return;
    setActionLoading(true);
    setActionError('');
    try {
      if (splitDialog.mode === 'edit') {
        await patch(`/webchat-splits/${splitDialog.id}`, { name });
        await loadSplits();
      } else {
        const created = await post('/webchat-splits', { name });
        await loadSplits();
        if (created?.id) setActiveSplitId(created.id);
      }
      setSplitDialog({ open: false, mode: 'create', id: null, name: '' });
    } catch (e) {
      setActionError(getErrorMessage(e, 'Falha ao salvar split.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSplit = (split) => {
    if (!split || split.is_default) return;
    setActionError('');
    setSplitToDelete(split);
  };

  const confirmDeleteSplit = async () => {
    const split = splitToDelete;
    if (!split) return;
    setActionLoading(true);
    setActionError('');
    try {
      await remove(`/webchat-splits/${split.id}`);
      await loadSplits();
      setSplitToDelete(null);
      setActionSuccess('Split apagado.');
    } catch (e) {
      setActionError(getErrorMessage(e, 'Não foi possível apagar o split.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleWeightChange = (id, value) => {
    setWeightDraft((prev) => ({ ...prev, [id]: value }));
  };

  const handleWeightSave = async (chat) => {
    const raw = weightDraft[chat.id];
    if (raw === undefined) return;
    const n = Math.max(0, Math.round(Number(raw) || 0));
    const clearDraft = () =>
      setWeightDraft((prev) => {
        const next = { ...prev };
        delete next[chat.id];
        return next;
      });
    if (n === Number(chat.split_weight ?? 100)) {
      clearDraft();
      return;
    }
    try {
      await patch(`/webchats/${chat.id}`, { split_weight: n });
      await mutate();
    } catch (e) {
      setActionError(getErrorMessage(e, 'Falha ao salvar o peso.'));
    } finally {
      clearDraft();
    }
  };

  const agentsList = useMemo(() => toArray(agentes), [agentes]);
  const domainEntries = useMemo(() => toArray(webchatDomains), [webchatDomains]);
  const registeredDomainEntries = useMemo(
    () => domainEntries.filter((item) => Boolean(normalizeDomain(item?.domain))),
    [domainEntries]
  );
  const hasRegisteredDomains = registeredDomainEntries.length > 0;

  const activeAgents = useMemo(
    () => agentsList.filter((agent) => Boolean(agent?.active)),
    [agentsList]
  );

  const projectsList = useMemo(() => {
    if (Array.isArray(emailProjects)) return emailProjects;
    if (Array.isArray(emailProjects?.items)) return emailProjects.items;
    return [];
  }, [emailProjects]);

  const goToWebchatDomainsSettings = () => {
    navigate('/settings/account-settings?tab=domains&domainTab=webchat');
  };

  const handleOpenCreate = () => {
    if (!hasRegisteredDomains) {
      setActionSuccess('');
      setActionError('Cadastre ao menos um domínio em Configurações > Conta & Domínios > Webchat antes de criar o webchat.');
      return;
    }
    setActionError('');
    setActionSuccess('');
    setFormMode('create');
    setFormData(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (chat) => {
    setActionError('');
    setActionSuccess('');
    setFormMode('edit');
    setFormData(chat);
    setFormOpen(true);
  };

  const handleOpenAdvanced = (chat) => {
    setActionError('');
    setActionSuccess('');
    setAdvancedData(chat);
    setAdvancedOpen(true);
  };

  const handleOpenAds = async (chat) => {
    if (!chat?.id) return;
    setActionError('');
    setActionSuccess('');
    setAdsError('');
    setAdsData(chat);
    setAdsConfig(createEmptyAdsConfig());
    setAdsEditor(null);
    setAdsOpen(true);
    setAdsLoading(true);
    try {
      const data = await get(`/webchats/${chat.id}/ads`);
      setAdsConfig(buildAdsConfigFromSource(data));
    } catch (err) {
      setAdsError(getErrorMessage(err, 'Falha ao carregar anúncios do webchat.'));
    } finally {
      setAdsLoading(false);
    }
  };

  const handleOpenBuilder = (chat) => {
    if (!chat?.id) return;
    navigate(`/webchat/webchats/${chat.id}/builder`);
  };

  const persistAdsConfig = async (nextConfig, successMessage = '') => {
    if (!adsData?.id) return null;
    setAdsError('');
    setAdsLoading(true);
    setActionError('');
    if (successMessage) {
      setActionSuccess('');
    }

    try {
      const payload = buildAdsPayloadFromConfig(nextConfig);
      const updated = await patch(`/webchats/${adsData.id}/ads`, payload);
      const normalized = buildAdsConfigFromSource(updated);
      setAdsConfig(normalized);
      if (successMessage) {
        setActionSuccess(successMessage);
      }
      return normalized;
    } catch (err) {
      setAdsError(getErrorMessage(err, 'Falha ao salvar anúncios.'));
      return null;
    } finally {
      setAdsLoading(false);
    }
  };

  const handleStartAddAd = () => {
    const defaultPosition = resolveNextCreatePosition(adsConfig);
    if (defaultPosition === 'entre-mensagens') {
      const between = toObject(adsConfig.entre_mensagens);
      const existingSequence = Array.isArray(between.sequence_ads) ? between.sequence_ads : [];
      if (existingSequence.length > 0) {
        setAdsEditor(
          createAdsEditor(
            'entre-mensagens',
            {
              ...between,
              sequence_ads: [...existingSequence, createSequenceAd()]
            },
            {
              mode: 'edit',
              originPosition: 'entre-mensagens',
              activeTab: existingSequence.length
            }
          )
        );
        return;
      }
    }

    setAdsEditor(
      createAdsEditor(defaultPosition, {}, { mode: 'create', originPosition: '' })
    );
  };

  const handleCancelAdsEditor = () => {
    setAdsEditor(null);
    setAdsError('');
  };

  const handleEditorPositionChange = (nextPositionRaw) => {
    const nextPosition = normalizeAdsPosition(nextPositionRaw);
    if (!nextPosition) return;

    setAdsEditor((current) => {
      if (!current) return current;
      if (nextPosition === current.position) return current;

      if (nextPosition === 'entre-mensagens') {
        const firstSimpleCode = String(current.codigo_tag || '').trim();
        return createAdsEditor(
          nextPosition,
          {
            ativo: current.ativo !== false,
            intervalo_mensagens: '1',
            sequence_ads: [
              createSequenceAd({
                codigo_tag: firstSimpleCode,
                gpt_slot: String(current.gpt_slot || '').trim(),
                gpt_div_id: String(current.gpt_div_id || '').trim(),
                anuncio_fixed: String(current.anuncio_fixed || '').trim(),
                gpt_sizes: current.gpt_sizes || defaultGptSizesByPosition('entre-mensagens'),
                rotulo: String(current.rotulo || 'PUBLICIDADE'),
                rotuloAtivo: current.rotuloAtivo !== false,
                ativo: current.ativo !== false
              })
            ]
          },
          {
            mode: current.mode,
            originPosition: current.originPosition,
            activeTab: 0,
            showAdvanced: current.show_advanced === true
          }
        );
      }

      if (current.position === 'entre-mensagens') {
        const firstItem =
          (Array.isArray(current.sequence_ads) ? current.sequence_ads : []).find((entry) =>
            hasAdCode(entry)
          ) ||
          (Array.isArray(current.sequence_ads) ? current.sequence_ads[0] : null) ||
          {};

        return createAdsEditor(
          nextPosition,
          {
            codigo_tag: firstItem.codigo_tag || '',
            gpt_slot: firstItem.gpt_slot || '',
            gpt_div_id: firstItem.gpt_div_id || '',
            anuncio_fixed: firstItem.anuncio_fixed || '',
            gpt_sizes: firstItem.gpt_sizes || defaultGptSizesByPosition(nextPosition),
            rotulo: firstItem.rotulo || 'PUBLICIDADE',
            rotuloAtivo: firstItem.rotuloAtivo !== false,
            ativo: firstItem.ativo !== false
          },
          {
            mode: current.mode,
            originPosition: current.originPosition,
            showAdvanced: current.show_advanced === true
          }
        );
      }

      return {
        ...current,
        position: nextPosition,
        gpt_sizes:
          String(current.gpt_sizes || '').trim() ||
          defaultGptSizesByPosition(nextPosition)
      };
    });
  };

  const handleEditorFieldChange = (field, value) => {
    setAdsEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        [field]: value
      };
    });
  };

  const handleEditorIntervalChange = (value) => {
    setAdsEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        intervalo_mensagens: value
      };
    });
  };

  const handleEditorSequenceChange = (sequenceId, patchData) => {
    setAdsEditor((current) => {
      if (!current || current.position !== 'entre-mensagens') return current;
      return {
        ...current,
        sequence_ads: current.sequence_ads.map((entry) =>
          entry.id === sequenceId ? { ...entry, ...patchData } : entry
        )
      };
    });
  };

  const handleEditorBetweenTabChange = (tabIndex) => {
    setAdsEditor((current) => {
      if (!current || current.position !== 'entre-mensagens') return current;
      const sequence = Array.isArray(current.sequence_ads) ? current.sequence_ads : [];
      const normalizedIndex = Number(tabIndex);
      const nextIndex =
        Number.isFinite(normalizedIndex) && normalizedIndex >= 0
          ? Math.min(Math.floor(normalizedIndex), Math.max(0, sequence.length - 1))
          : 0;
      return {
        ...current,
        active_tab: nextIndex
      };
    });
  };

  const saveAdsEditorDraft = async ({
    closeOnSuccess = false,
    successMessage = '',
    allowEmptyBetween = false,
    allowEmptySimple = false,
    editorOverride = null
  } = {}) => {
    const editorSnapshot = editorOverride || adsEditor;
    if (!editorSnapshot) return false;

    const position = normalizeAdsPosition(editorSnapshot.position);
    if (!position) {
      setAdsError('Selecione um posicionamento válido.');
      return false;
    }

    const originPosition = normalizeAdsPosition(editorSnapshot.originPosition);
    const nextConfig = cloneAdsConfig(adsConfig);

    if (originPosition && originPosition !== position) {
      if (originPosition === 'entre-mensagens') {
        nextConfig.entre_mensagens = null;
      } else if (SIMPLE_AD_POSITIONS.includes(originPosition)) {
        nextConfig[originPosition] = null;
      }
    }

    if (position === 'entre-mensagens') {
      const intervalRaw = Number(editorSnapshot.intervalo_mensagens);
      if (!Number.isFinite(intervalRaw) || intervalRaw <= 0) {
        setAdsError('Preencha "A cada quantas mensagens?" com um número maior que zero.');
        return false;
      }
      const interval = Math.floor(intervalRaw);
      const sequenceSource = Array.isArray(editorSnapshot.sequence_ads) ? editorSnapshot.sequence_ads : [];
      const sequenceAds = sequenceSource
        .map((entry, index) => {
          const normalized = normalizeAdContract(entry, 'entre-mensagens');
          if (!hasAdCode(normalized)) return null;
          return {
            id: String(entry.id || `seq_${index + 1}`),
            codigo_tag: normalized.codigo_tag,
            gpt_slot: normalized.gpt_slot || null,
            gpt_div_id: normalized.gpt_div_id || null,
            anuncio_fixed: normalized.anuncio_fixed || null,
            gpt_sizes: normalized.gpt_sizes,
            rotulo: normalized.rotulo,
            rotuloAtivo: normalized.rotuloAtivo !== false,
            ativo: entry.ativo !== false
          };
        })
        .filter(Boolean);

      if (sequenceAds.length === 0) {
        if (!allowEmptyBetween) {
          setAdsError('Adicione ao menos um anúncio para "Entre mensagens".');
          return false;
        }
        nextConfig.entre_mensagens = null;
      } else {
        nextConfig.entre_mensagens = {
          id: String(toObject(nextConfig.entre_mensagens).id || createAdsRowId()),
          ativo:
            typeof editorSnapshot.ativo === 'boolean'
              ? editorSnapshot.ativo
              : toObject(nextConfig.entre_mensagens).ativo !== false,
          intervalo_mensagens: String(interval),
          sequence_ads: sequenceAds
        };
      }
    } else {
      const normalized = normalizeAdContract(editorSnapshot, position);
      if (!hasAdCode(normalized)) {
        if (allowEmptySimple) return true;
        setAdsError('Preencha Código/Tag ou os campos avançados do anúncio.');
        return false;
      }

      nextConfig[position] = {
        id: String(toObject(nextConfig[position]).id || createAdsRowId()),
        codigo_tag: normalized.codigo_tag,
        gpt_slot: normalized.gpt_slot || null,
        gpt_div_id: normalized.gpt_div_id || null,
        anuncio_fixed: normalized.anuncio_fixed || null,
        gpt_sizes: normalized.gpt_sizes,
        rotulo: normalized.rotulo,
        rotuloAtivo: normalized.rotuloAtivo !== false,
        ativo:
          typeof editorSnapshot.ativo === 'boolean'
            ? editorSnapshot.ativo
            : toObject(nextConfig[position]).ativo !== false
      };
    }

    const saved = await persistAdsConfig(nextConfig, successMessage);
    if (saved) {
      if (closeOnSuccess) {
        setAdsEditor(null);
      }
      return true;
    }
    return false;
  };

  const handleEditorBetweenFieldBlur = async () => {
    if (normalizeAdsPosition(adsEditor?.position) !== 'entre-mensagens') return;
    await saveAdsEditorDraft({
      closeOnSuccess: false,
      successMessage: '',
      allowEmptyBetween: true
    });
  };

  const handleEditorCodeTagPaste = async () => {
    const position = normalizeAdsPosition(adsEditor?.position);
    if (!position) return;

    if (position === 'entre-mensagens') {
      await saveAdsEditorDraft({
        closeOnSuccess: false,
        successMessage: '',
        allowEmptyBetween: true
      });
      return;
    }

    await saveAdsEditorDraft({
      closeOnSuccess: false,
      successMessage: '',
      allowEmptyBetween: true,
      allowEmptySimple: false
    });
  };

  const handleEditorBetweenAddTab = async () => {
    if (normalizeAdsPosition(adsEditor?.position) !== 'entre-mensagens') return;
    const saved = await saveAdsEditorDraft({
      closeOnSuccess: false,
      successMessage: '',
      allowEmptyBetween: true
    });
    if (!saved) return;

    setAdsEditor((current) => {
      if (!current || current.position !== 'entre-mensagens') return current;
      const sequence = Array.isArray(current.sequence_ads) ? current.sequence_ads : [];
      return {
        ...current,
        sequence_ads: [...sequence, createSequenceAd()],
        active_tab: sequence.length
      };
    });
  };

  const handleEditorBetweenDeleteTab = async (tabIndex) => {
    let snapshotForPersist = null;
    setAdsEditor((current) => {
      if (!current || current.position !== 'entre-mensagens') return current;
      const sequence = Array.isArray(current.sequence_ads) ? current.sequence_ads : [];
      if (sequence.length === 0) return current;

      const rawIndex = Number(tabIndex);
      const index =
        Number.isFinite(rawIndex) && rawIndex >= 0
          ? Math.min(Math.floor(rawIndex), sequence.length - 1)
          : 0;
      const nextSequence = sequence.filter((_, entryIndex) => entryIndex !== index);
      const nextActiveTab =
        nextSequence.length > 0 ? Math.min(index, nextSequence.length - 1) : 0;

      snapshotForPersist = {
        ...current,
        sequence_ads: nextSequence,
        active_tab: nextActiveTab
      };

      if (nextSequence.length === 0) {
        return {
          ...current,
          sequence_ads: [createSequenceAd()],
          active_tab: 0
        };
      }

      return snapshotForPersist;
    });

    if (!snapshotForPersist) return;
    await saveAdsEditorDraft({
      closeOnSuccess: false,
      successMessage: 'Anúncio removido da sequência.',
      allowEmptyBetween: true,
      editorOverride: snapshotForPersist
    });
  };

  const handleSaveAdsEditor = async () => {
    if (adsLoading) return;
    const isBetween = normalizeAdsPosition(adsEditor?.position) === 'entre-mensagens';
    await saveAdsEditorDraft({
      closeOnSuccess: true,
      successMessage: isBetween ? 'Anúncios entre mensagens salvos com sucesso.' : 'Anúncio salvo com sucesso.',
      allowEmptyBetween: false,
      allowEmptySimple: false
    });
  };

  const handleEditSimpleAd = (position) => {
    const ad = toObject(adsConfig[position]);
    if (!hasAdCode(ad)) return;
    setAdsEditor(
      createAdsEditor(position, ad, { mode: 'edit', originPosition: position })
    );
    setAdsError('');
  };

  const handleDeleteSimpleAd = async (position) => {
    const nextConfig = cloneAdsConfig(adsConfig);
    nextConfig[position] = null;
    const saved = await persistAdsConfig(nextConfig, `Anúncio ${getAdsPositionLabel(position)} removido.`);
    if (saved && normalizeAdsPosition(adsEditor?.originPosition) === position) {
      setAdsEditor(null);
    }
  };

  const handleToggleSimpleAd = async (position, nextActive) => {
    const currentAd = toObject(adsConfig[position]);
    if (!hasAdCode(currentAd)) return;
    const nextConfig = cloneAdsConfig(adsConfig);
    nextConfig[position] = {
      ...currentAd,
      ativo: nextActive
    };
    await persistAdsConfig(nextConfig, 'Status do anúncio atualizado.');
  };

  const handleEditBetweenAd = (sequenceId = '') => {
    const between = toObject(adsConfig.entre_mensagens);
    const sequence = Array.isArray(between.sequence_ads) ? between.sequence_ads : [];
    if (sequence.length === 0) return;
    const selectedIndex = sequenceId
      ? sequence.findIndex((entry) => entry.id === sequenceId)
      : 0;

    setAdsEditor(
      createAdsEditor(
        'entre-mensagens',
        { ...between, sequence_ads: sequence },
        {
          mode: 'edit',
          originPosition: 'entre-mensagens',
          activeTab: selectedIndex >= 0 ? selectedIndex : 0
        }
      )
    );
    setAdsError('');
  };

  const handleDeleteBetweenAd = async () => {
    const nextConfig = cloneAdsConfig(adsConfig);
    nextConfig.entre_mensagens = null;
    const saved = await persistAdsConfig(nextConfig, 'Anúncios entre mensagens removidos.');
    if (saved && normalizeAdsPosition(adsEditor?.originPosition) === 'entre-mensagens') {
      setAdsEditor(null);
    }
  };

  const handleToggleBetweenAd = async (nextActive) => {
    const between = toObject(adsConfig.entre_mensagens);
    const sequence = Array.isArray(between.sequence_ads) ? between.sequence_ads : [];
    if (sequence.length === 0) return;

    const nextConfig = cloneAdsConfig(adsConfig);
    nextConfig.entre_mensagens = {
      ...between,
      ativo: nextActive,
      sequence_ads: sequence.map((entry) => ({ ...toObject(entry) }))
    };
    await persistAdsConfig(nextConfig, 'Status dos anúncios entre mensagens atualizado.');
  };

  const handleSubmit = async (payload) => {
    setActionLoading(true);
    setActionError('');
    setActionSuccess('');

    try {
      let nextAgentId = payload.agent_id;

      if (payload.agentMode === 'create') {
        const createdAgent = await post('/agentes', payload.newAgent);
        nextAgentId = createdAgent?.id;

        if (!nextAgentId) {
          throw new Error('Não foi possível recuperar o agente criado.');
        }
      }

      const webchatPayload = {
        name: payload.name,
        domain: payload.domain,
        agent_id: nextAgentId,
        email_project_id: payload.email_project_id,
        active: payload.active,
        settings: payload.settings,
        header_scripts: payload.header_scripts ?? null,
        // Webchat novo entra no split selecionado na aba atual.
        ...(formMode === 'create' && activeSplitId ? { split_id: activeSplitId } : {})
      };

      if (formMode === 'create') {
        await post('/webchats', webchatPayload);
      } else {
        await patch(`/webchats/${formData?.id}`, webchatPayload);
      }

      await Promise.all([mutate(), mutateAgentes(), loadSplits()]);
      setFormOpen(false);
      setActionSuccess(formMode === 'create' ? 'Webchat criado com sucesso.' : 'Webchat atualizado com sucesso.');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Falha ao salvar webchat.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete?.id) return;
    setActionLoading(true);
    setActionError('');
    setActionSuccess('');
    try {
      await remove(`/webchats/${pendingDelete.id}`);
      await mutate();
      setConfirmOpen(false);
      setPendingDelete(null);
      setActionSuccess('Webchat excluído com sucesso.');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Falha ao excluir webchat.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (chat, nextActive) => {
    if (!chat?.id) return;
    setActionLoading(true);
    setActionError('');
    setActionSuccess('');
    try {
      await patch(`/webchats/${chat.id}`, { active: nextActive });
      await mutate();
      setActionSuccess(nextActive ? 'Webchat ativado.' : 'Webchat inativado.');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Falha ao atualizar status do webchat.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPublic = (chat) => {
    const host = normalizeHost(chat?.domain);
    if (!host || !chat?.slug) return;
    const url = import.meta.env.DEV
      ? `${window.location.origin}/webchat/${chat.slug}?domain=${encodeURIComponent(host)}`
      : `https://${host}/webchat/${chat.slug}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getPublicLink = (chat) => {
    const host = normalizeHost(chat?.domain);
    if (!host || !chat?.slug) return '';
    if (import.meta.env.DEV) {
      return `${window.location.origin}/webchat/${chat.slug}?domain=${encodeURIComponent(host)}`;
    }
    return `https://${host}/webchat/${chat.slug}`;
  };

  const handleCopyPublic = async (chat) => {
    const url = getPublicLink(chat);
    if (!url) return;

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard indisponível no navegador.');
      }
      await navigator.clipboard.writeText(url);
      setActionError('');
      setActionSuccess('Link de teste copiado para a área de transferência.');
    } catch (err) {
      setActionSuccess('');
      setActionError(getErrorMessage(err, 'Não foi possível copiar o link.'));
    }
  };

  const handleSubmitAdvanced = async (payload) => {
    if (!advancedData?.id) return;
    setActionLoading(true);
    setActionError('');
    setActionSuccess('');
    try {
      await patch(`/webchats/${advancedData.id}`, payload);
      await mutate();
      setAdvancedOpen(false);
      setAdvancedData(null);
      setActionSuccess('Personalizações avançadas salvas com sucesso.');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Falha ao salvar personalizações avançadas.'));
    } finally {
      setActionLoading(false);
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
        <Box sx={{ px: 2, pt: 1.75, pb: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Tabs
            value={activeSplit ? activeSplitId : false}
            onChange={(_, v) => setActiveSplitId(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              flex: 1,
              minHeight: 0,
              '& .MuiTab-root': { minHeight: 0, textTransform: 'none', fontWeight: 800, py: 1 }
            }}
          >
            {splits.map((s) => (
              <Tab key={s.id} value={s.id} label={`${s.name} · ${s.webchats_count}`} />
            ))}
          </Tabs>
          <Button
            size="small"
            startIcon={<AddRoundedIcon />}
            onClick={() => setSplitDialog({ open: true, mode: 'create', id: null, name: '' })}
            sx={{ borderRadius: 2, fontWeight: 800 }}
          >
            Split
          </Button>
          {activeSplit ? (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Tooltip title="Copiar link do split">
                <span>
                  <IconButton size="small" onClick={() => handleCopySplitLink(activeSplit)} sx={{ borderRadius: 2 }}>
                    <ContentCopyRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Abrir link do split">
                <span>
                  <IconButton size="small" onClick={() => handleOpenSplitLink(activeSplit)} sx={{ borderRadius: 2 }}>
                    <OpenInNewRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Renomear split">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => setSplitDialog({ open: true, mode: 'edit', id: activeSplit.id, name: activeSplit.name })}
                    sx={{ borderRadius: 2 }}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              {!activeSplit.is_default ? (
                <Tooltip title="Apagar split">
                  <span>
                    <IconButton size="small" color="error" onClick={() => handleDeleteSplit(activeSplit)} sx={{ borderRadius: 2 }}>
                      <DeleteRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : null}
            </Stack>
          ) : null}
        </Box>

        <Divider />

        <Box
          sx={{
            px: 2,
            py: 1.75,
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            flexDirection: { xs: 'column', sm: 'row' }
          }}
        >
          <Box>
            <Typography variant="h4">{activeSplit ? activeSplit.name : 'Webchats'}</Typography>
            <Typography variant="body2" color="text.secondary">
              {filteredChats.length} no total
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Atualizar">
              <span>
                <IconButton
                  onClick={refresh}
                  disabled={isLoading || actionLoading}
                  size="small"
                  sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
                >
                  <RefreshRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              onClick={handleOpenCreate}
              variant="contained"
              color="secondary"
              startIcon={<AddRoundedIcon />}
              sx={{ borderRadius: 2, fontWeight: 900 }}
              disabled={actionLoading || !hasRegisteredDomains}
            >
              Novo webchat
            </Button>
          </Stack>
        </Box>

        <Divider />

        <Box sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            {error ? <Alert severity="error">{getErrorMessage(error, 'Falha ao carregar webchats.')}</Alert> : null}

            {webchatDomainsError ? (
              <Alert severity="warning">
                Não foi possível carregar os domínios de webchat. Verifique a aba Configurações &gt; Conta & Domínios &gt; Webchat.
              </Alert>
            ) : null}

            {!webchatDomainsError && !hasRegisteredDomains ? (
              <Alert
                severity="warning"
                action={
                  <Button size="small" color="inherit" onClick={goToWebchatDomainsSettings}>
                    Cadastrar domínio
                  </Button>
                }
              >
                Antes de criar um webchat, você precisa ter ao menos um domínio de webchat cadastrado.
              </Alert>
            ) : null}

            {!agentesLoading && activeAgents.length === 0 ? (
              <Alert severity="info">
                Não há agentes ativos. Ao criar um webchat, você pode criar e vincular o agente de IA no mesmo fluxo.
              </Alert>
            ) : null}

            {actionError ? (
              <Alert severity="error" onClose={() => setActionError('')}>
                {actionError}
              </Alert>
            ) : null}

            {actionSuccess ? (
              <Alert severity="success" onClose={() => setActionSuccess('')}>
                {actionSuccess}
              </Alert>
            ) : null}

            {isLoading ? (
              <WebchatsSkeleton />
            ) : filteredChats.length === 0 ? (
              <Box
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: '1px dashed',
                  borderColor: 'divider',
                  textAlign: 'center',
                  bgcolor: 'background.paper'
                }}
              >
                <Typography variant="h6" sx={{ mb: 0.5 }}>
                  Nenhum webchat cadastrado
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Crie seu primeiro webchat para publicar o chat por slug.
                </Typography>
                <Button
                  onClick={handleOpenCreate}
                  variant="contained"
                  color="secondary"
                  startIcon={<AddRoundedIcon />}
                  disabled={!hasRegisteredDomains}
                >
                  Criar webchat
                </Button>
                {!hasRegisteredDomains ? (
                  <Button onClick={goToWebchatDomainsSettings} sx={{ ml: 1 }}>
                    Ir para domínios
                  </Button>
                ) : null}
              </Box>
            ) : (
              <Stack spacing={1}>
                {filteredChats.map((chat) => (
                  <Box
                    key={chat.id}
                    sx={{
                      borderRadius: 2.5,
                      border: '1px solid',
                      borderColor: chat.active ? 'secondary.200' : 'divider',
                      bgcolor: 'background.paper',
                      p: 1.5
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 900 }} noWrap title={chat.name}>
                            {chat.name}
                          </Typography>
                          <Chip
                            size="small"
                            label={chat.active ? 'Ativo' : 'Inativo'}
                            color={chat.active ? 'secondary' : 'default'}
                            variant={chat.active ? 'filled' : 'outlined'}
                            sx={{ borderRadius: 2, fontWeight: 800 }}
                          />
                          {chat.email_project_id ? (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`Projeto: ${chat?.email_projects?.name || 'vinculado'}`}
                              sx={{ borderRadius: 2, fontWeight: 800 }}
                            />
                          ) : (
                            <Chip size="small" variant="outlined" label="Somente webchat_leads" sx={{ borderRadius: 2, fontWeight: 800 }} />
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" noWrap title={chat.domain}>
                          Domínio: {chat.domain}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap title={chat.slug}>
                          Slug: {chat.slug}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Tooltip title="Peso deste webchat no split (sorteio ponderado)">
                          <TextField
                            size="small"
                            type="number"
                            value={weightDraft[chat.id] ?? String(chat.split_weight ?? 100)}
                            onChange={(e) => handleWeightChange(chat.id, e.target.value)}
                            onBlur={() => handleWeightSave(chat)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                            disabled={actionLoading}
                            inputProps={{ min: 0, style: { textAlign: 'right' } }}
                            InputProps={{
                              endAdornment: (
                                <Typography variant="caption" color="text.secondary">
                                  %
                                </Typography>
                              )
                            }}
                            sx={{ width: 92 }}
                          />
                        </Tooltip>

                        <Tooltip title={chat.active ? 'Ativo' : 'Inativo'}>
                          <span>
                            <Switch
                              size="small"
                              color="secondary"
                              checked={Boolean(chat.active)}
                              disabled={actionLoading}
                              onChange={(e) => handleToggleActive(chat, e.target.checked)}
                            />
                          </span>
                        </Tooltip>

                        <Tooltip title="Abrir link de teste">
                          <span>
                            <IconButton size="small" onClick={() => handleOpenPublic(chat)} sx={{ borderRadius: 2 }}>
                              <OpenInNewRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title="Copiar link">
                          <span>
                            <IconButton size="small" onClick={() => handleCopyPublic(chat)} sx={{ borderRadius: 2 }}>
                              <ContentCopyRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title="Anúncios">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenAds(chat)}
                              disabled={actionLoading}
                              sx={{ borderRadius: 2 }}
                            >
                              <CampaignRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title="Builder visual">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenBuilder(chat)}
                              disabled={actionLoading}
                              sx={{ borderRadius: 2 }}
                            >
                              <DashboardCustomizeRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title="Personalizações avançadas">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenAdvanced(chat)}
                              disabled={actionLoading}
                              sx={{ borderRadius: 2 }}
                            >
                              <TuneRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title="Editar">
                          <span>
                            <IconButton size="small" onClick={() => handleOpenEdit(chat)} disabled={actionLoading} sx={{ borderRadius: 2 }}>
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title="Excluir">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setPendingDelete(chat);
                                setConfirmOpen(true);
                              }}
                              disabled={actionLoading}
                              sx={{ borderRadius: 2 }}
                            >
                              <DeleteRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </Box>
      </MainCard>

      <WebchatFormDialog
        open={formOpen}
        mode={formMode}
        initialData={formData}
        activeAgents={activeAgents}
        projects={projectsList}
        availableDomains={registeredDomainEntries}
        loading={actionLoading}
        error={actionError}
        onOpenDomainsSettings={goToWebchatDomainsSettings}
        onClose={() => (actionLoading ? null : setFormOpen(false))}
        onSubmit={handleSubmit}
      />

      <Dialog
        open={splitDialog.open}
        onClose={() => (actionLoading ? null : setSplitDialog({ open: false, mode: 'create', id: null, name: '' }))}
        maxWidth="xs"
        fullWidth
      >
        <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSubmitSplit(); }}>
          <DialogTitle>{splitDialog.mode === 'edit' ? 'Renomear split' : 'Novo split'}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              label="Nome do split"
              value={splitDialog.name}
              onChange={(e) => setSplitDialog((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ex.: Chats Fosoh"
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setSplitDialog({ open: false, mode: 'create', id: null, name: '' })}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={actionLoading || !String(splitDialog.name || '').trim()}>
              {splitDialog.mode === 'edit' ? 'Salvar' : 'Criar'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        open={Boolean(splitToDelete)}
        onClose={() => (actionLoading ? null : setSplitToDelete(null))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Apagar split</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            {actionError ? <Alert severity="error">{actionError}</Alert> : null}
            <Typography variant="body2">
              Apagar o split “{splitToDelete?.name}”? Esta ação não pode ser desfeita. Só é possível
              apagar splits sem webchats dentro.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSplitToDelete(null)} disabled={actionLoading}>
            Cancelar
          </Button>
          <Button color="error" variant="contained" onClick={confirmDeleteSplit} disabled={actionLoading}>
            Apagar
          </Button>
        </DialogActions>
      </Dialog>

      <WebchatAdvancedDialog
        open={advancedOpen}
        chat={advancedData}
        loading={actionLoading}
        error={actionError}
        onClose={() => {
          if (actionLoading) return null;
          setAdvancedOpen(false);
          setAdvancedData(null);
        }}
        onSubmit={handleSubmitAdvanced}
      />

      <WebchatAdsDialog
        open={adsOpen}
        chat={adsData}
        adsConfig={adsConfig}
        editor={adsEditor}
        loading={adsLoading}
        error={adsError}
        onStartAdd={handleStartAddAd}
        onCancelEditor={handleCancelAdsEditor}
        onSaveEditor={handleSaveAdsEditor}
        onEditorPositionChange={handleEditorPositionChange}
        onEditorFieldChange={handleEditorFieldChange}
        onEditorIntervalChange={handleEditorIntervalChange}
        onEditorSequenceChange={handleEditorSequenceChange}
        onEditorCodeTagPaste={handleEditorCodeTagPaste}
        onEditorBetweenFieldBlur={handleEditorBetweenFieldBlur}
        onEditorBetweenTabChange={handleEditorBetweenTabChange}
        onEditorBetweenAddTab={handleEditorBetweenAddTab}
        onEditorBetweenDeleteTab={handleEditorBetweenDeleteTab}
        onEditSimple={handleEditSimpleAd}
        onDeleteSimple={handleDeleteSimpleAd}
        onToggleSimple={handleToggleSimpleAd}
        onEditBetween={handleEditBetweenAd}
        onDeleteBetween={handleDeleteBetweenAd}
        onToggleBetween={handleToggleBetweenAd}
        onClose={() => {
          if (adsLoading) return null;
          setAdsOpen(false);
          setAdsData(null);
          setAdsConfig(createEmptyAdsConfig());
          setAdsEditor(null);
          setAdsError('');
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        loading={actionLoading}
        title="Excluir webchat?"
        description={`Tem certeza que deseja excluir o webchat "${pendingDelete?.name || ''}"?`}
        onClose={() => (actionLoading ? null : setConfirmOpen(false))}
        onConfirm={handleDelete}
      />
    </Box>
  );
}
