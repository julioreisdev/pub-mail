import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { IconBarcode, IconCheck, IconCircleCheck, IconCopy, IconCreditCard, IconLock, IconQrcode, IconRefresh } from '@tabler/icons-react';

import { get, post } from 'api/api';

// ============================================================================
// Página pública de pagamento de uma cobrança do WhatsApp (Fase 4): /pay/:token.
// Visual fixo (não segue o tema do painel — quem abre é o cliente da empresa). O cartão é digitado na página
// segura do gateway (Asaas); aqui só o botão que leva até lá.
// Confere o pagamento sozinha com intervalo crescente (8 s → 20 s → 45 s) por até 15 min; depois fica só o
// botão "Já paguei — verificar". Uma resposta antiga nunca sobrescreve uma mais nova (sequência).
// ============================================================================

const C = {
  bg: '#f4f6fb',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  brand: '#16a34a',
  brandDark: '#15803d',
  soft: '#f8fafc'
};
const POLL_DELAYS_MS = [8000, 20000, 45000];
const POLL_MAX_MS = 15 * 60 * 1000;
const errMsg = (e, fb) => {
  const m = e?.response?.data?.message ?? e?.message;
  return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};
const brl = (c) => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Section({ icon: Icon, title, children }) {
  return (
    <Box sx={{ border: `1px solid ${C.border}`, borderRadius: 3, p: 2, bgcolor: C.card }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Icon size={20} color={C.brand} />
        <Typography sx={{ fontWeight: 800, color: C.text, fontSize: 16 }}>{title}</Typography>
      </Box>
      {children}
    </Box>
  );
}

function CopyButton({ text, label }) {
  const [ok, setOk] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* noop */
      }
      ta.remove();
    }
    setOk(true);
    window.setTimeout(() => setOk(false), 1800);
  };
  return (
    <Button
      fullWidth
      variant="contained"
      disableElevation
      onClick={copy}
      startIcon={ok ? <IconCheck size={18} /> : <IconCopy size={18} />}
      sx={{ bgcolor: C.brand, '&:hover': { bgcolor: C.brandDark }, fontWeight: 800, textTransform: 'none', borderRadius: 2, minHeight: 46 }}
    >
      {ok ? 'Copiado!' : label}
    </Button>
  );
}

/** Caixa de aviso neutra (cancelada / expirada / falhou / sem meio de pagamento). */
function Notice({ title, children }) {
  return (
    <Box sx={{ bgcolor: C.card, borderRadius: 3, p: 3, border: `1px solid ${C.border}`, textAlign: 'center' }}>
      <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{title}</Typography>
      <Typography sx={{ color: C.muted, mt: 0.5 }}>{children}</Typography>
    </Box>
  );
}

export default function PublicPay() {
  const { token } = useParams();
  const [d, setD] = useState(null);
  const [gone, setGone] = useState(''); // 404: link inválido/removido (sem "tentar de novo")
  const [loadErr, setLoadErr] = useState(''); // rede/5xx na carga inicial → botão "Tentar de novo"
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState(''); // resultado da verificação manual
  const [pollStopped, setPollStopped] = useState(false); // passou dos 15 min
  const [cardBusy, setCardBusy] = useState(false);
  const [cardErr, setCardErr] = useState('');
  const [inst, setInst] = useState(1);
  const seeded = useRef(false);
  const seqRef = useRef(0); // sequência das respostas (carga + verificações)
  const inFlightRef = useRef(false); // voo único das verificações
  const pollStartRef = useRef(0); // quando começou a vigiar a cobrança em aberto

  // aplica uma resposta só se nenhuma mais nova já chegou
  const apply = useCallback((seq, r) => {
    if (seq !== seqRef.current || !r) return;
    setD(r);
    if (!seeded.current && r.card) {
      seeded.current = true;
      setInst(r.card.installments || 1);
    }
  }, []);

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    setLoadErr('');
    try {
      const r = await get(`/public/pay/${encodeURIComponent(token)}`);
      apply(seq, r);
      if (seq === seqRef.current) setGone('');
    } catch (e) {
      if (seq !== seqRef.current) return;
      // só 404 = link que não existe; o resto (rede, servidor) pode ser tentado de novo
      if (e?.response?.status === 404) setGone(errMsg(e, 'Link de pagamento inválido.'));
      else setLoadErr(errMsg(e, 'Não foi possível carregar a cobrança.'));
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [token, apply]);
  useEffect(() => {
    document.title = 'Pagamento';
    load();
  }, [load]);

  const check = useCallback(
    async (silent) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const seq = ++seqRef.current;
      if (!silent) {
        setChecking(true);
        setFeedback('');
      }
      try {
        const r = await post(`/public/pay/${encodeURIComponent(token)}/check`);
        apply(seq, r);
        if (!silent && seq === seqRef.current && r?.status === 'PENDING')
          setFeedback('Ainda não consta pagamento. Se acabou de pagar, aguarde alguns segundos e verifique de novo.');
      } catch (e) {
        if (!silent && seq === seqRef.current) setFeedback(errMsg(e, 'Não foi possível verificar agora. Tente de novo em instantes.'));
      } finally {
        inFlightRef.current = false;
        if (!silent && seq === seqRef.current) setChecking(false);
      }
    },
    [token, apply]
  );

  // confere sozinho enquanto em aberto e com a aba visível: 8 s, 20 s e depois a cada 45 s, por até 15 min
  const status = d?.status;
  useEffect(() => {
    if (status !== 'PENDING') return undefined;
    if (!pollStartRef.current) pollStartRef.current = Date.now();
    let cancelled = false;
    let timer = 0;
    let n = 0;
    const delay = () => POLL_DELAYS_MS[Math.min(n, POLL_DELAYS_MS.length - 1)];
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - pollStartRef.current > POLL_MAX_MS) {
        setPollStopped(true);
        return;
      }
      if (document.visibilityState === 'visible') await check(true);
      if (cancelled) return;
      n += 1;
      timer = window.setTimeout(tick, delay());
    };
    timer = window.setTimeout(tick, delay());
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [status, check]);

  const payCard = async () => {
    setCardBusy(true);
    setCardErr('');
    try {
      const r = await post(`/public/pay/${encodeURIComponent(token)}/card`, { installments: inst });
      if (r?.url) window.location.href = r.url;
      else setCardErr('Não foi possível abrir o pagamento no cartão.');
    } catch (e) {
      setCardErr(errMsg(e, 'Não foi possível abrir o pagamento no cartão.'));
    } finally {
      setCardBusy(false);
    }
  };

  const wrap = (children) => (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: C.bg,
        color: C.text,
        px: 2,
        py: { xs: 3, sm: 6 },
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start'
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 460, display: 'grid', gap: 2 }}>{children}</Box>
    </Box>
  );

  if (gone)
    return wrap(
      <Box sx={{ bgcolor: C.card, borderRadius: 3, p: 3, textAlign: 'center', border: `1px solid ${C.border}` }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 1 }}>Link indisponível</Typography>
        <Typography sx={{ color: C.muted }}>{gone}</Typography>
      </Box>
    );
  if (!d && loadErr)
    return wrap(
      <Box sx={{ bgcolor: C.card, borderRadius: 3, p: 3, textAlign: 'center', border: `1px solid ${C.border}` }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 1 }}>Não foi possível carregar</Typography>
        <Typography sx={{ color: C.muted, mb: 2 }}>{loadErr}</Typography>
        <Button
          variant="contained"
          disableElevation
          onClick={load}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <IconRefresh size={18} />}
          sx={{
            bgcolor: C.brand,
            '&:hover': { bgcolor: C.brandDark },
            fontWeight: 800,
            textTransform: 'none',
            borderRadius: 2,
            minHeight: 44
          }}
        >
          Tentar de novo
        </Button>
      </Box>
    );
  if (!d)
    return wrap(
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress sx={{ color: C.brand }} />
      </Box>
    );

  const paid = d.status === 'PAID';
  const open = d.status === 'PENDING';
  const failed = d.status === 'FAILED';
  const hasMeans = Boolean(d.pix || d.boleto || d.card || d.auto_card);
  const maxInst = d.card?.installments_max || 1;

  return wrap(
    <>
      <Box sx={{ bgcolor: C.card, borderRadius: 3, p: 3, border: `1px solid ${C.border}`, textAlign: 'center' }}>
        {d.org ? (
          <Typography sx={{ color: C.muted, fontWeight: 700, fontSize: 13, letterSpacing: 0.3, textTransform: 'uppercase' }}>
            {d.org}
          </Typography>
        ) : null}
        <Typography sx={{ fontWeight: 900, fontSize: 34, mt: 0.5, color: C.text }}>{d.amount_label}</Typography>
        <Typography sx={{ color: C.text, fontWeight: 600, mt: 0.5, overflowWrap: 'anywhere' }}>{d.description}</Typography>
        <Typography sx={{ color: C.muted, fontSize: 14, mt: 0.5 }}>
          {d.customer_first_name ? `${d.customer_first_name} · ` : ''}vence em {d.due_label}
        </Typography>
      </Box>

      {paid ? (
        <Box sx={{ bgcolor: '#ecfdf5', borderRadius: 3, p: 3, border: '1px solid #a7f3d0', textAlign: 'center' }}>
          <IconCircleCheck size={44} color={C.brand} />
          <Typography sx={{ fontWeight: 900, fontSize: 20, mt: 1, color: '#065f46' }}>Pagamento confirmado</Typography>
          <Typography sx={{ color: '#047857', mt: 0.5 }}>Obrigado! O comprovante foi enviado no WhatsApp.</Typography>
        </Box>
      ) : null}

      {failed ? (
        <Notice title="Não foi possível gerar esta cobrança">
          Houve um problema ao emitir o pagamento. Fale com a empresa pelo WhatsApp para receber uma nova cobrança.
        </Notice>
      ) : null}

      {!paid && !open && !failed ? (
        <Notice title={d.status === 'CANCELED' ? 'Cobrança cancelada' : 'Cobrança expirada'}>
          Fale com a empresa pelo WhatsApp para receber uma nova.
        </Notice>
      ) : null}

      {open && !hasMeans ? (
        <Notice title="Pagamento indisponível no momento">
          Esta cobrança não tem meio de pagamento disponível no momento. Fale com a empresa pelo WhatsApp.
        </Notice>
      ) : null}

      {open && d.auto_card ? (
        <Box sx={{ bgcolor: '#eff6ff', borderRadius: 3, p: 2.5, border: '1px solid #bfdbfe' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <IconCreditCard size={20} color="#1d4ed8" />
            <Typography sx={{ fontWeight: 800, color: '#1e3a8a' }}>Débito automático no cartão</Typography>
          </Box>
          <Typography sx={{ color: '#1e40af', mt: 0.75, fontSize: 14 }}>
            Esta cobrança será debitada no cartão {d.auto_card.brand || ''} final {d.auto_card.last4 || '••••'} em {d.auto_card.date_label}.
            Não é preciso fazer nada.
          </Typography>
        </Box>
      ) : null}

      {open && d.pix ? (
        <Section icon={IconQrcode} title="PIX">
          {d.pix.qr_url ? (
            <Box sx={{ display: 'grid', placeItems: 'center', mb: 1.5 }}>
              <Box
                component="img"
                src={d.pix.qr_url}
                alt="QR Code do PIX"
                sx={{ width: 220, height: 220, borderRadius: 2, border: `1px solid ${C.border}`, bgcolor: '#fff' }}
              />
            </Box>
          ) : null}
          <Box
            sx={{
              bgcolor: C.soft,
              border: `1px dashed ${C.border}`,
              borderRadius: 2,
              p: 1.25,
              mb: 1.25,
              fontFamily: 'monospace',
              fontSize: 12,
              color: C.text,
              wordBreak: 'break-all',
              maxHeight: 96,
              overflow: 'auto'
            }}
          >
            {d.pix.code}
          </Box>
          <CopyButton text={d.pix.code} label="Copiar código PIX" />
          <Typography sx={{ color: C.muted, fontSize: 13, mt: 1 }}>
            Abra o app do seu banco, escolha PIX copia e cola e cole o código.
          </Typography>
        </Section>
      ) : null}

      {open && d.boleto ? (
        <Section icon={IconBarcode} title="Boleto">
          {d.boleto.digitable ? (
            <>
              <Box
                sx={{
                  bgcolor: C.soft,
                  border: `1px dashed ${C.border}`,
                  borderRadius: 2,
                  p: 1.25,
                  mb: 1.25,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  wordBreak: 'break-all'
                }}
              >
                {d.boleto.digitable}
              </Box>
              <CopyButton text={d.boleto.digitable} label="Copiar linha digitável" />
            </>
          ) : null}
          {d.boleto.url ? (
            <Button
              fullWidth
              variant="outlined"
              href={d.boleto.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ mt: 1, fontWeight: 800, textTransform: 'none', borderRadius: 2, minHeight: 44, color: C.text, borderColor: C.border }}
            >
              Abrir boleto (PDF)
            </Button>
          ) : null}
        </Section>
      ) : null}

      {open && d.card ? (
        <Section icon={IconCreditCard} title="Cartão de crédito">
          {maxInst > 1 ? (
            <TextField
              select
              size="small"
              fullWidth
              label="Parcelas"
              value={Math.min(inst, maxInst)}
              onChange={(e) => setInst(Number(e.target.value))}
              sx={{ mb: 1.25 }}
            >
              {Array.from({ length: maxInst }, (_, i) => i + 1).map((n) => (
                <MenuItem key={n} value={n}>
                  {n === 1 ? `À vista · ${d.amount_label}` : `${n}× de ${brl(Math.round(d.amount_cents / n))}`}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          <Button
            fullWidth
            variant="contained"
            disableElevation
            onClick={payCard}
            disabled={cardBusy}
            startIcon={cardBusy ? <CircularProgress size={16} color="inherit" /> : <IconLock size={18} />}
            sx={{
              bgcolor: '#1d4ed8',
              '&:hover': { bgcolor: '#1e40af' },
              fontWeight: 800,
              textTransform: 'none',
              borderRadius: 2,
              minHeight: 46
            }}
          >
            Pagar com cartão
          </Button>
          {cardErr ? <Typography sx={{ color: '#b91c1c', fontSize: 13, mt: 1 }}>{cardErr}</Typography> : null}
          <Typography sx={{ color: C.muted, fontSize: 13, mt: 1 }}>
            Você vai para a página segura do banco (Asaas) para digitar o cartão.
          </Typography>
          <Typography sx={{ color: C.muted, fontSize: 13, mt: 0.5 }}>
            O cartão fica salvo com segurança no banco para as próximas cobranças da empresa.
          </Typography>
        </Section>
      ) : null}

      {open && hasMeans ? (
        <Box sx={{ display: 'grid', justifyItems: 'center', gap: 0.5 }}>
          <Button
            variant="text"
            onClick={() => check(false)}
            disabled={checking}
            startIcon={checking ? <CircularProgress size={16} color="inherit" /> : <IconRefresh size={18} />}
            sx={{ color: C.muted, fontWeight: 700, textTransform: 'none' }}
          >
            Já paguei — verificar
          </Button>
          {feedback ? <Typography sx={{ color: C.muted, fontSize: 13, textAlign: 'center' }}>{feedback}</Typography> : null}
          {pollStopped && !feedback ? (
            <Typography sx={{ color: C.muted, fontSize: 13, textAlign: 'center' }}>
              A conferência automática parou. Depois de pagar, toque em "Já paguei — verificar".
            </Typography>
          ) : null}
        </Box>
      ) : null}
      <Typography sx={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>
        Pagamento processado com segurança pelo gateway da empresa.
      </Typography>
    </>
  );
}
