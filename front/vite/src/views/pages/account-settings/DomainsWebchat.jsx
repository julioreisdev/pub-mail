import { useEffect, useMemo, useState } from 'react';
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
  IconButton,
  InputAdornment,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import HourglassBottomRoundedIcon from '@mui/icons-material/HourglassBottomRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';

import { patch, post, remove } from '../../../api/api';
import useWebchatDomains from '../../../hooks/useWebchatDomains';

const getErrorMessage = (err, fallback = 'Ocorreu um erro') =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

const normalizeDomain = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');

const isValidDomain = (domain) => {
  const normalized = normalizeDomain(domain);
  const re = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
  return re.test(normalized);
};

const toList = (input) => {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.items)) return input.items;
  return [];
};

const formatDateTime = (iso) => {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
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

function DomainsSkeleton({ rows = 4 }) {
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

function StatusChip({ status }) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'VERIFIED') {
    return (
      <Chip
        size="small"
        color="secondary"
        variant="filled"
        icon={<VerifiedRoundedIcon sx={{ fontSize: 16 }} />}
        label="Verificado"
        sx={{ borderRadius: 2, fontWeight: 900 }}
      />
    );
  }
  if (normalized === 'FAILED') {
    return <Chip size="small" color="error" variant="filled" label="Falhou" sx={{ borderRadius: 2, fontWeight: 900 }} />;
  }
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={<HourglassBottomRoundedIcon sx={{ fontSize: 16 }} />}
      label="Pendente"
      sx={{ borderRadius: 2, fontWeight: 900 }}
    />
  );
}

function DnsRow({ type, name, value, onCopy }) {
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
        <Chip
          size="small"
          variant="outlined"
          label={`Registro obrigatório (${type || '-'})`}
          sx={{ borderRadius: 2, fontWeight: 900, width: 'fit-content' }}
        />

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

// Validação soft do conteúdo do ads.txt: lê linhas, ignora vazias/comentários,
// retorna lista de números de linhas suspeitas (não casam com formato IAB básico).
function findInvalidAdsTxtLines(rawText) {
  const lines = String(rawText || '').split('\n');
  const invalid = [];
  // formato IAB: dominio , account_id , RELATIONSHIP [ , tag_id ]
  // linhas começando com # são comentários; linhas com VAR=VAL são variáveis IAB válidas.
  const ipPattern = /^[a-z][a-z0-9.\-_]*=.+$/i;
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    if (line.startsWith('#')) return;
    if (ipPattern.test(line)) return; // variável IAB (CONTACT=, SUBDOMAIN=, etc)
    const parts = line.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) {
      invalid.push(idx + 1);
      return;
    }
    const relationship = String(parts[2] || '').toUpperCase();
    if (relationship !== 'DIRECT' && relationship !== 'RESELLER') {
      invalid.push(idx + 1);
    }
  });
  return invalid;
}

function AdsTxtDialog({ open, domain, onClose, onSaved, onSnack }) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setContent(String(domain?.ads_txt || ''));
      setError('');
    }
  }, [open, domain?.id, domain?.ads_txt]);

  const publicUrl = useMemo(() => {
    const d = String(domain?.domain || '').trim();
    return d ? `https://${d}/ads.txt` : '';
  }, [domain?.domain]);

  const invalidLines = useMemo(() => findInvalidAdsTxtLines(content), [content]);
  const bytes = useMemo(() => new TextEncoder().encode(content).length, [content]);

  const handleSave = async () => {
    if (!domain?.id) return;
    setSaving(true);
    setError('');
    try {
      await patch(`/webchat-domains/${domain.id}/ads-txt`, { ads_txt: content });
      onSnack?.({ open: true, msg: 'ads.txt salvo. Pode levar até 5min para propagar pelo Cloudflare.', severity: 'success' });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Falha ao salvar ads.txt.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!publicUrl) return;
    const ok = await copyToClipboard(publicUrl);
    onSnack?.({ open: true, msg: ok ? 'URL copiada!' : 'Não foi possível copiar.', severity: ok ? 'success' : 'error' });
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose?.()} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 900 }}>
        Editar ads.txt — {domain?.domain || ''}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Cole aqui o conteúdo fornecido pela ADX. Cada linha segue o padrão IAB:{' '}
            <Box component="code" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              dominio, account_id, DIRECT|RESELLER, tag_id
            </Box>
            . Comentários começam com <Box component="code">#</Box>. Limite 64KB.
          </Alert>

          {publicUrl ? (
            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <LinkRoundedIcon fontSize="small" />
              <Typography
                sx={{
                  flex: 1,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {publicUrl}
              </Typography>
              <Tooltip title="Copiar URL">
                <span>
                  <IconButton size="small" onClick={handleCopyUrl} sx={{ borderRadius: 2 }}>
                    <ContentCopyRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Abrir em nova aba">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => window.open(publicUrl, '_blank', 'noopener')}
                    sx={{ borderRadius: 2 }}
                  >
                    <OpenInNewRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          ) : null}

          <TextField
            value={content}
            onChange={(e) => setContent(e.target.value)}
            multiline
            minRows={12}
            maxRows={24}
            fullWidth
            placeholder={'sendwebpush.com, 69af34985522c, DIRECT\ngoogle.com, pub-9597097359230576, RESELLER, f08c47fec0942fa0\ngoogle.com, pub-1463105128959706, DIRECT, f08c47fec0942fa0'}
            InputProps={{
              sx: {
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 13,
                lineHeight: 1.55
              }
            }}
            disabled={saving}
          />

          <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {bytes.toLocaleString('pt-BR')} bytes / 65.536
            </Typography>
            {invalidLines.length > 0 ? (
              <Chip
                size="small"
                color="warning"
                label={`Linhas suspeitas: ${invalidLines.slice(0, 8).join(', ')}${invalidLines.length > 8 ? '…' : ''}`}
                sx={{ borderRadius: 2, fontWeight: 800 }}
              />
            ) : (
              <Chip
                size="small"
                color="success"
                variant="outlined"
                label="Formato OK"
                sx={{ borderRadius: 2, fontWeight: 800 }}
              />
            )}
          </Stack>

          {invalidLines.length > 0 ? (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              {invalidLines.length} linha(s) não seguem o formato IAB padrão (
              <code>dominio, conta, DIRECT|RESELLER[, tag]</code>). Comentários (<code>#</code>) e variáveis (
              <code>CONTACT=</code>, <code>SUBDOMAIN=</code>) são aceitos. Você ainda pode salvar — a validação é só um aviso.
            </Alert>
          ) : null}

          {error ? (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ fontWeight: 800, textTransform: 'none' }}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ fontWeight: 900, textTransform: 'none', borderRadius: 2 }}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DomainCard({ domain, loading, onDelete, onVerify, onCopyValue, onEditAdsTxt }) {
  const status = String(domain?.status || '').toUpperCase();
  const isVerified = status === 'VERIFIED';
  const requiredRecord = domain?.instructions?.required_record || {};
  const recordType = String(requiredRecord?.type || domain?.expected_type || 'A').toUpperCase();
  const recordName = requiredRecord?.name || domain?.domain || '-';
  const recordValue = requiredRecord?.value || domain?.expected_value || '-';

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
        <StatusChip status={status} />

        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 950, lineHeight: 1.1 }} noWrap title={domain?.domain}>
            {domain?.domain || '-'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            DNS check: {domain?.last_checked_at ? formatDateTime(domain.last_checked_at) : 'ainda não executado'}
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        <Button
          size="small"
          variant="outlined"
          color="primary"
          disabled={loading}
          onClick={() => onEditAdsTxt(domain)}
          startIcon={<DescriptionRoundedIcon />}
          sx={{ borderRadius: 2, fontWeight: 900, textTransform: 'none' }}
        >
          ads.txt
        </Button>

        <Tooltip title="Excluir domínio">
          <span>
            <IconButton size="small" color="error" disabled={loading} onClick={() => onDelete(domain)} sx={{ borderRadius: 2 }}>
              <DeleteRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Divider sx={{ my: 1.25 }} />

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <DnsRoundedIcon fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
          Instruções de linkagem
        </Typography>
      </Stack>

      <Stack spacing={1}>
        <DnsRow type={recordType} name={recordName} value={recordValue} onCopy={onCopyValue} />

        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.default'
          }}
        >
          <Stack spacing={0.75}>
            <Typography variant="body2" color="text.secondary">
              1. No Cloudflare (DNS), crie um registro <b>{recordType}</b> para <b>{recordName}</b> apontando para <b>{recordValue}</b>.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              2. Deixe o proxy do Cloudflare em <b>Proxied</b>.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              3. Aguarde a propagação DNS por alguns minutos.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              4. Clique em <b>Verificar DNS e liberar domínio</b> para executar o check automático.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              5. Após verificar, o domínio fica liberado para seleção no wizard de webchat.
            </Typography>
          </Stack>
        </Box>

        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Recomendação Cloudflare: mantenha o proxy em <b>Proxied</b> e SSL/TLS em <b>Full</b> ou <b>Full (strict)</b>.
        </Alert>

        {domain?.last_check_error ? (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            Último erro de verificação: {domain.last_check_error}
          </Alert>
        ) : null}
      </Stack>

      {!isVerified ? (
        <Stack direction={{ xs: 'column', sm: 'column' }} spacing={1} justifyContent="flex-end" sx={{ mt: 1.25 }}>
          <Button
            onClick={() => onVerify(domain)}
            variant="contained"
            color="secondary"
            disabled={loading}
            sx={{ borderRadius: 2, fontWeight: 900 }}
          >
            Verificar DNS
          </Button>
          <Typography variant="caption" color="text.secondary">
            Após ficar verificado, o domínio aparece no wizard de webchat.
          </Typography>
        </Stack>
      ) : null}
    </Box>
  );
}

export default function DomainsWebchat() {
  const { webchatDomains, isLoading, error, refresh } = useWebchatDomains();
  const list = useMemo(() => toList(webchatDomains), [webchatDomains]);

  const [domainInput, setDomainInput] = useState('');
  const [domainError, setDomainError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [adsTxtDomain, setAdsTxtDomain] = useState(null);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  useEffect(() => {
    const normalized = normalizeDomain(domainInput);
    if (!normalized) {
      setDomainError('');
      return;
    }
    setDomainError(isValidDomain(normalized) ? '' : 'Digite um domínio válido (ex: chat.suaempresa.com)');
  }, [domainInput]);

  const canCreate = useMemo(() => {
    const normalized = normalizeDomain(domainInput);
    return Boolean(normalized) && !domainError && isValidDomain(normalized) && !actionLoading;
  }, [domainInput, domainError, actionLoading]);

  const handleCreate = async (e) => {
    e?.preventDefault?.();
    const normalized = normalizeDomain(domainInput);
    if (!isValidDomain(normalized)) {
      setDomainError('Digite um domínio válido (ex: chat.suaempresa.com)');
      return;
    }

    setActionLoading(true);
    setActionError('');

    try {
      await post('/webchat-domains', { domain: normalized });
      setDomainInput('');
      await refresh();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Falha ao cadastrar domínio de webchat.'));
    } finally {
      setActionLoading(false);
    }
  };

  const doDelete = async () => {
    if (!pendingDelete?.id) return;
    setActionLoading(true);
    setActionError('');
    try {
      await remove(`/webchat-domains/${pendingDelete.id}`);
      setConfirmOpen(false);
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Falha ao excluir domínio.'));
    } finally {
      setActionLoading(false);
    }
  };

  const doVerify = async (item) => {
    if (!item?.id) return;
    setActionLoading(true);
    setActionError('');
    try {
      await patch(`/webchat-domains/${item.id}/verify`, {});
      await refresh();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Falha ao verificar domínio de webchat.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyValue = async (value) => {
    const ok = await copyToClipboard(String(value || ''));
    setSnack({
      open: true,
      msg: ok ? 'Valor copiado!' : 'Não foi possível copiar.',
      severity: ok ? 'success' : 'error'
    });
  };

  return (
    <>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
        >
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Fluxo: 1) cadastre o domínio, 2) crie o registro DNS com o IP exibido no card, 3) mantenha Cloudflare em
            Proxied, 4) clique em Verificar DNS e liberar domínio.
          </Alert>

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
                placeholder="chat.empresa.com"
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
              />

              <Button
                type="submit"
                variant="contained"
                color="secondary"
                startIcon={actionLoading ? <CircularProgress size={16} /> : <AddRoundedIcon />}
                disabled={!canCreate}
                sx={{ borderRadius: 2, fontWeight: 900, height: 44, whiteSpace: 'nowrap', marginBottom: '1.5rem !important' }}
              >
                Cadastrar
              </Button>
            </Stack>
          </Box>
        </Box>

        {error ? (
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            {getErrorMessage(error, 'Falha ao carregar domínios de webchat.')}
          </Alert>
        ) : null}

        {actionError ? (
          <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setActionError('')}>
            {actionError}
          </Alert>
        ) : null}

        {isLoading ? (
          <DomainsSkeleton rows={4} />
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
              Nenhum domínio de webchat cadastrado
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cadastre e verifique um domínio para disponibilizar no wizard de webchat.
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
              {list.map((item) => (
                <DomainCard
                  key={item.id}
                  domain={item}
                  loading={actionLoading}
                  onDelete={(domain) => {
                    setPendingDelete(domain);
                    setConfirmOpen(true);
                  }}
                  onVerify={doVerify}
                  onCopyValue={handleCopyValue}
                  onEditAdsTxt={(domain) => setAdsTxtDomain(domain)}
                />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>

      <ConfirmDialog
        open={confirmOpen}
        title="Excluir domínio de webchat?"
        description={`Tem certeza que deseja excluir o domínio "${pendingDelete?.domain || ''}"?`}
        loading={actionLoading}
        onClose={() => (actionLoading ? null : setConfirmOpen(false))}
        onConfirm={doDelete}
      />

      <AdsTxtDialog
        open={Boolean(adsTxtDomain)}
        domain={adsTxtDomain}
        onClose={() => setAdsTxtDomain(null)}
        onSaved={() => refresh()}
        onSnack={setSnack}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={2200}
        onClose={() => setSnack((state) => ({ ...state, open: false }))}
        message={snack.msg}
      />
    </>
  );
}
