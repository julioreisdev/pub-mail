import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { keyframes } from '@mui/material/styles';

import { IconCopy, IconCheck, IconRefresh, IconShieldCheck, IconClock, IconAlertCircle } from '@tabler/icons-react';

import { get, post } from 'api/api';
import Logo from 'ui-component/Logo';
import { MODULE_DEFS, formatDate, planLabel } from './modules';

// Checkout PIX da ASSINATURA (acesso ao Pub Mail). Usado pela tela de bloqueio
// (conta pendente/vencida) e pelo modal de renovação antecipada.
// Fluxo: retoma cobrança PENDING (GET /access/me) ou cria (POST /access/charge)
// → QR + copia-e-cola + countdown 30 min → polling 5 s + botão "Validar"
// → PAID: tela de sucesso → onPaid() (recarrega /auth/me e o gate abre).

const pop = keyframes`
  0% { transform: scale(.6); opacity: 0 }
  60% { transform: scale(1.08); opacity: 1 }
  100% { transform: scale(1) }
`;

const POLL_MS = 5000;

const calcLeft = (expiresAt) => (expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : 0);

// Contador sincronizado com `expiresAt` já no render em que a cobrança muda
// (senão o 1º frame de um PIX novo mostraria "expirado").
function useCountdown(expiresAt) {
  const [st, setSt] = useState(() => ({ key: expiresAt, left: calcLeft(expiresAt) }));
  if (st.key !== expiresAt) setSt({ key: expiresAt, left: calcLeft(expiresAt) });
  useEffect(() => {
    if (!expiresAt) return undefined;
    const id = window.setInterval(() => setSt({ key: expiresAt, left: calcLeft(expiresAt) }), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  return st.key === expiresAt ? st.left : calcLeft(expiresAt);
}

const mmss = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

async function copyText(text) {
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
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function PixCheckoutCard({ access, mode = 'lock', onPaid }) {
  const [charge, setCharge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paid, setPaid] = useState(null); // objeto da cobrança paga
  const finishedRef = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const left = useCountdown(charge?.expires_at);
  // Expirado SÓ quando o servidor disser (relógio do cliente pode estar adiantado;
  // o back reaproveita o PENDING válido, então "gerar novo" devolveria o mesmo).
  const expired = charge?.status === 'EXPIRED' || charge?.status === 'FAILED';
  const confirming = charge?.status === 'PENDING' && left <= 0;

  const settle = useCallback(
    (row) => {
      if (row?.status === 'PAID' && !finishedRef.current) {
        finishedRef.current = true;
        setPaid(row);
        window.setTimeout(() => onPaidRef.current?.(row), 2200);
      }
      setCharge(row);
    },
    []
  );

  const createCharge = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const row = await post('/access/charge');
      settle(row);
    } catch (e) {
      setError(e?.response?.data?.message || 'Não foi possível gerar o PIX agora.');
    } finally {
      setLoading(false);
    }
  }, [settle]);

  // Boot: retoma PENDING válida ou cria.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await get('/access/me');
        if (!alive) return;
        if (me?.pending_charge?.status === 'PENDING') {
          setCharge(me.pending_charge);
          setLoading(false);
          return;
        }
      } catch {
        /* segue pra criar */
      }
      if (alive) createCharge();
    })();
    return () => {
      alive = false;
    };
  }, [createCharge]);

  // Polling enquanto PENDING (validação automática).
  useEffect(() => {
    if (!charge?.id || charge.status !== 'PENDING') return undefined;
    let alive = true;
    const id = window.setInterval(async () => {
      try {
        const row = await get(`/access/charge/${charge.id}`);
        if (alive) settle(row);
      } catch {
        /* rede instável — tenta no próximo tick */
      }
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [charge?.id, charge?.status, settle]);

  // Countdown zerou → confirma no servidor (pode ter pago no último segundo).
  const zeroCheckedRef = useRef('');
  useEffect(() => {
    if (!charge?.id || charge.status !== 'PENDING' || left > 0) return;
    if (zeroCheckedRef.current === charge.id) return;
    zeroCheckedRef.current = charge.id;
    post(`/access/charge/${charge.id}/check`).then(settle).catch(() => undefined);
  }, [charge?.id, charge?.status, left, settle]);

  const validate = async () => {
    if (!charge?.id || checking) return;
    setChecking(true);
    try {
      const row = await post(`/access/charge/${charge.id}/check`);
      settle(row);
      if (row?.status === 'PENDING') toast('Ainda não identificamos o pagamento. Se você acabou de pagar, aguarde alguns segundos.', { icon: '⏳' });
      else if (row?.status === 'EXPIRED') toast.error('Este PIX expirou. Gere um novo.');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Não foi possível validar agora.');
    } finally {
      window.setTimeout(() => setChecking(false), 1200);
    }
  };

  const copy = async () => {
    if (!charge?.pix_code) return;
    const ok = await copyText(charge.pix_code);
    if (ok) {
      setCopied(true);
      toast.success('Código PIX copiado!');
      window.setTimeout(() => setCopied(false), 2500);
    } else toast.error('Não foi possível copiar. Selecione o código manualmente.');
  };

  const modules = (access?.modules || []).map((k) => MODULE_DEFS[k]).filter(Boolean);
  const title = mode === 'renew' ? 'Renove seu acesso' : access?.status === 'EXPIRED' ? 'Seu acesso venceu' : 'Ative seu acesso';
  const subtitle =
    mode === 'renew'
      ? `Seu acesso vence em ${access?.days_left ?? 0} dia${access?.days_left === 1 ? '' : 's'}. Pague agora e continue sem interrupção.`
      : access?.status === 'EXPIRED'
        ? 'Renove o pagamento para voltar a usar a plataforma.'
        : 'Faça o pagamento via PIX para liberar a plataforma.';

  // ---------- sucesso ----------
  if (paid) {
    const until = access?.lifetime || paid.period_days == null ? null : new Date(Date.now() + paid.period_days * 86_400_000);
    return (
      <CardShell>
        <Stack alignItems="center" spacing={2} sx={{ py: 3, textAlign: 'center' }}>
          <Box
            sx={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              boxShadow: '0 16px 40px rgba(34,197,94,.35)',
              animation: `${pop} .6s cubic-bezier(.2,.9,.3,1.2) both`
            }}
          >
            <IconCheck size={46} stroke={2.4} />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em' }}>Pagamento confirmado!</Typography>
          <Typography sx={{ color: 'text.secondary', maxWidth: 360 }}>
            {until ? `Seu acesso está liberado até ${formatDate(until)}.` : 'Seu acesso vitalício está liberado.'} Entrando na plataforma…
          </Typography>
          <CircularProgress size={22} sx={{ mt: 1 }} />
        </Stack>
      </CardShell>
    );
  }

  return (
    <CardShell>
      {/* cabeçalho */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
        <Logo height={30} />
        <Chip
          size="small"
          icon={<IconShieldCheck size={15} />}
          label="Pagamento seguro via PIX"
          sx={{ fontWeight: 600, bgcolor: (t) => `rgba(${t.vars.palette.success.mainChannel} / 0.12)`, color: 'success.main', '& .MuiChip-icon': { color: 'inherit' } }}
        />
      </Stack>

      <Typography sx={{ fontWeight: 800, fontSize: { xs: 22, sm: 26 }, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{title}</Typography>
      <Typography sx={{ color: 'text.secondary', mt: 0.75 }}>{subtitle}</Typography>

      {/* resumo do plano */}
      <Box sx={{ mt: 2.5, p: 2, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={2} flexWrap="wrap" useFlexGap>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Seu plano
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 16, sm: 18 } }}>{planLabel(access)}</Typography>
        </Stack>
        {modules.length > 0 && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
            {modules.map((m) => (
              <Chip key={m.key} size="small" icon={<m.Icon size={14} />} label={m.label} variant="outlined" sx={{ fontWeight: 600, '& .MuiChip-icon': { color: m.color } }} />
            ))}
          </Stack>
        )}
      </Box>

      <Divider sx={{ my: 2.5 }} />

      {/* corpo: loading / erro / expirado / PIX */}
      {loading ? (
        <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
          <CircularProgress size={30} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Gerando seu PIX…
          </Typography>
        </Stack>
      ) : error ? (
        <Stack alignItems="center" spacing={1.5} sx={{ py: 3, textAlign: 'center' }}>
          <Box sx={{ color: 'warning.main' }}>
            <IconAlertCircle size={40} stroke={1.6} />
          </Box>
          <Typography sx={{ fontWeight: 600 }}>{error}</Typography>
          <Button variant="outlined" startIcon={<IconRefresh size={18} />} onClick={createCharge}>
            Tentar novamente
          </Button>
        </Stack>
      ) : expired ? (
        <Stack alignItems="center" spacing={1.5} sx={{ py: 3, textAlign: 'center' }}>
          <Box sx={{ color: 'text.secondary' }}>
            <IconClock size={40} stroke={1.6} />
          </Box>
          <Typography sx={{ fontWeight: 700 }}>Este PIX expirou</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            O código vale por 30 minutos. Gere um novo para continuar.
          </Typography>
          <Button variant="contained" disableElevation startIcon={<IconRefresh size={18} />} onClick={createCharge} sx={{ fontWeight: 700 }}>
            Gerar novo PIX
          </Button>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ xs: 'stretch', sm: 'flex-start' }} sx={{ minWidth: 0 }}>
            {charge?.qr_base64 ? (
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 2.5,
                  bgcolor: '#fff',
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: '0 8px 24px rgba(15,23,42,.08)',
                  flexShrink: 0,
                  alignSelf: 'center'
                }}
              >
                <img src={`data:image/png;base64,${charge.qr_base64}`} alt="QR Code PIX" width={176} height={176} style={{ display: 'block', imageRendering: 'pixelated' }} />
              </Box>
            ) : null}
            <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0, width: '100%' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                1. Escaneie o QR Code ou copie o código
              </Typography>
              <Box
                onClick={copy}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && copy()}
                sx={{
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 2,
                  border: '1px dashed',
                  borderColor: 'divider',
                  bgcolor: 'background.default',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 12,
                  color: 'text.secondary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  minWidth: 0,
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main', color: 'text.primary' }
                }}
                title="Clique para copiar"
              >
                {charge?.pix_code || '—'}
              </Box>
              <Button
                fullWidth
                variant={copied ? 'contained' : 'outlined'}
                color={copied ? 'success' : 'primary'}
                disableElevation
                startIcon={copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                onClick={copy}
                sx={{ fontWeight: 700, borderRadius: 2 }}
              >
                {copied ? 'Copiado!' : 'Copiar código PIX'}
              </Button>
              <Typography variant="body2" sx={{ fontWeight: 700, pt: 0.5 }}>
                2. Pague no app do seu banco
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                3. Confirme aqui
              </Typography>
              <Button
                fullWidth
                variant="contained"
                disableElevation
                disabled={checking}
                onClick={validate}
                startIcon={checking ? <CircularProgress size={16} color="inherit" /> : <IconShieldCheck size={18} />}
                sx={{ fontWeight: 700, borderRadius: 2, py: 1.1 }}
              >
                {checking ? 'Verificando…' : 'Já paguei — validar'}
              </Button>
            </Stack>
          </Stack>

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Validamos automaticamente em segundos após o pagamento.
            </Typography>
            <Chip
              size="small"
              icon={confirming ? <CircularProgress size={12} color="inherit" /> : <IconClock size={14} />}
              label={confirming ? 'Confirmando com o banco…' : `Expira em ${mmss(left)}`}
              variant="outlined"
              sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
            />
          </Stack>
        </Stack>
      )}
    </CardShell>
  );
}

PixCheckoutCard.propTypes = { access: PropTypes.object, mode: PropTypes.oneOf(['lock', 'renew']), onPaid: PropTypes.func };

function CardShell({ children }) {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 560,
        minWidth: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
        borderRadius: 4,
        p: { xs: 2.5, sm: 3.5 },
        bgcolor: 'background.paper',
        color: 'text.primary',
        boxShadow: '0 30px 80px rgba(2,6,23,.45)',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      {children}
    </Box>
  );
}
CardShell.propTypes = { children: PropTypes.node };
