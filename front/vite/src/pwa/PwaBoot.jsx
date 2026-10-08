import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';

import { useColorScheme } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  IconBellRinging,
  IconBolt,
  IconCheck,
  IconChecklist,
  IconCoin,
  IconMessage,
  IconDeviceMobile,
  IconDotsVertical,
  IconDownload,
  IconShare2,
  IconSquarePlus,
  IconX
} from '@tabler/icons-react';

import {
  closePwaDialog,
  enableNotifications,
  initPwa,
  isAndroid,
  isIOS,
  isIOSSafari,
  openPwaDialog,
  promptInstall,
  syncThemeColor,
  pwaState,
  usePwa
} from './pwa';

const ASKED_KEY = 'pm-pwa-notify-asked';
const safeGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* modo privado */
  }
};

// ------------------------------------------------------------------ peças visuais
function Header({ title, subtitle, onClose, variant = 'app' }) {
  const bell = variant === 'bell';
  return (
    <Box
      sx={{
        position: 'relative',
        px: 3,
        pt: 4,
        pb: 3.25,
        color: '#fff',
        textAlign: 'center',
        overflow: 'hidden',
        background:
          'radial-gradient(560px 300px at 12% -30%, #2f6fe0 0%, transparent 62%), radial-gradient(420px 240px at 100% 120%, rgba(47,111,224,.45) 0%, transparent 60%), linear-gradient(160deg, #101c38 0%, #0b1120 100%)',
        // grade sutil ao fundo, como no login
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(closest-side at 50% 45%, #000 20%, transparent 100%)',
          pointerEvents: 'none'
        }
      }}
    >
      <IconButton
        onClick={onClose}
        aria-label="fechar"
        size="small"
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1,
          color: 'rgba(255,255,255,.7)',
          '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,.08)' }
        }}
      >
        <IconX size={18} />
      </IconButton>

      {/* ícone com halo pulsante */}
      <Box sx={{ position: 'relative', width: 88, height: 88, mx: 'auto', display: 'grid', placeItems: 'center' }}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '1.5px solid rgba(96,150,245,.55)',
            animation: 'pm-halo 2.4s ease-out infinite',
            '@keyframes pm-halo': { '0%': { transform: 'scale(.72)', opacity: 0.9 }, '100%': { transform: 'scale(1.55)', opacity: 0 } },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.35 }
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '1.5px solid rgba(96,150,245,.55)',
            animation: 'pm-halo 2.4s ease-out 1.2s infinite',
            '@media (prefers-reduced-motion: reduce)': { display: 'none' }
          }}
        />
        {bell ? (
          <Box
            sx={{
              position: 'relative',
              width: 72,
              height: 72,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              background: 'linear-gradient(145deg, #4f90f7 0%, #1b55bd 100%)',
              boxShadow: '0 14px 40px rgba(55,126,240,.5), inset 0 1px 0 rgba(255,255,255,.25)'
            }}
          >
            <IconBellRinging size={34} stroke={1.8} />
            {/* bolinha de "1 novo aviso" */}
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                minWidth: 20,
                height: 20,
                px: 0.6,
                borderRadius: 10,
                bgcolor: '#ef4444',
                color: '#fff',
                fontSize: 11,
                fontWeight: 800,
                display: 'grid',
                placeItems: 'center',
                border: '2px solid #0f1a33',
                boxShadow: '0 2px 8px rgba(0,0,0,.35)'
              }}
            >
              1
            </Box>
          </Box>
        ) : (
          <Box
            component="img"
            src="/pwa/icon-192.png"
            alt=""
            sx={{
              position: 'relative',
              width: 72,
              height: 72,
              borderRadius: '18px',
              boxShadow: '0 14px 40px rgba(55,126,240,.5)',
              display: 'block'
            }}
          />
        )}
      </Box>

      <Typography sx={{ position: 'relative', mt: 2.25, fontSize: 21, fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography sx={{ position: 'relative', mt: 0.5, fontSize: 14, color: 'rgba(226,232,240,.78)' }}>{subtitle}</Typography>
      ) : null}
    </Box>
  );
}
Header.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  onClose: PropTypes.func,
  variant: PropTypes.oneOf(['app', 'bell'])
};

function IconBadge({ children, tone = 'primary' }) {
  return (
    <Box
      sx={(t) => ({
        width: 38,
        height: 38,
        flexShrink: 0,
        borderRadius: 2.5,
        display: 'grid',
        placeItems: 'center',
        color: `${tone}.main`,
        bgcolor: `rgba(${t.vars.palette[tone].mainChannel} / 0.12)`
      })}
    >
      {children}
    </Box>
  );
}
IconBadge.propTypes = { children: PropTypes.node, tone: PropTypes.string };

function Row({ icon, title, text, step, tone = 'primary' }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box sx={{ position: 'relative' }}>
        <IconBadge tone={tone}>{icon}</IconBadge>
        {step ? (
          <Box
            sx={{
              position: 'absolute',
              top: -6,
              left: -6,
              width: 18,
              height: 18,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              display: 'grid',
              placeItems: 'center',
              border: '2px solid',
              borderColor: 'background.paper'
            }}
          >
            {step}
          </Box>
        ) : null}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, color: 'text.primary' }}>{title}</Typography>
        {text ? <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.4 }}>{text}</Typography> : null}
      </Box>
    </Stack>
  );
}
Row.propTypes = { icon: PropTypes.node, title: PropTypes.node, text: PropTypes.node, step: PropTypes.number, tone: PropTypes.string };

function deniedHelp(standalone) {
  if (isIOS) return 'Para liberar: Ajustes do iPhone/iPad → Notificações → Pub Mail → Permitir Notificações.';
  if (standalone && isAndroid) return 'Para liberar: mantenha o dedo no ícone do Pub Mail → Informações do app → Notificações.';
  return 'Para liberar: toque no cadeado ao lado do endereço do site → Notificações → Permitir.';
}

/** Situação das notificações + botão para ativar. Usado nos dois diálogos. */
function NotifyBlock({ permission, standalone, busy, onEnable, pwa }) {
  if (permission === 'granted') {
    // permissão ok, mas a inscrição do push neste aparelho falhou → mostra o motivo e deixa tentar de novo
    if (pwa?.pushSupported && pwa.pushSubscribed === false) {
      return (
        <Stack spacing={1}>
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            Permissão concedida, mas este aparelho ainda não ficou inscrito no push{pwa.pushError ? ` (${pwa.pushError})` : ''}.
          </Alert>
          <Button
            variant="contained"
            disabled={busy}
            onClick={onEnable}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <IconBellRinging size={18} />}
            sx={{ borderRadius: 2.5, fontWeight: 700 }}
          >
            Tentar de novo
          </Button>
        </Stack>
      );
    }
    if (pwa?.pushSupported && pwa.pushSubscribed === null) {
      return (
        <Alert severity="info" icon={<CircularProgress size={18} />} sx={{ borderRadius: 2 }}>
          Permissão concedida. Inscrevendo este aparelho no push…
        </Alert>
      );
    }
    return (
      <Alert severity="success" icon={<IconCheck size={20} />} sx={{ borderRadius: 2 }}>
        Notificações ativadas. Você vai receber os avisos do Pub Mail mesmo com o app fechado.
      </Alert>
    );
  }
  if (permission === 'denied') {
    return (
      <Alert severity="warning" sx={{ borderRadius: 2 }}>
        As notificações estão bloqueadas. {deniedHelp(standalone)}
      </Alert>
    );
  }
  if (permission === 'unsupported') {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        {isIOS
          ? 'No iPhone e no iPad as notificações funcionam no app instalado (iOS 16.4 ou mais novo). Abra o Pub Mail pelo ícone da tela de início.'
          : 'Este navegador não oferece notificações.'}
      </Alert>
    );
  }
  return (
    <Button
      fullWidth
      size="large"
      variant="contained"
      disabled={busy}
      onClick={onEnable}
      startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <IconBellRinging size={20} />}
      sx={{ py: 1.4, borderRadius: 2.5, fontWeight: 700 }}
    >
      Ativar notificações
    </Button>
  );
}
NotifyBlock.propTypes = {
  permission: PropTypes.string,
  standalone: PropTypes.bool,
  busy: PropTypes.bool,
  onEnable: PropTypes.func,
  pwa: PropTypes.object
};

// p: 0 — o tema põe 12px de padding em todo Dialog (apareceria uma faixa clara acima do cabeçalho escuro)
const paperSx = {
  p: 0,
  borderRadius: 4,
  overflow: 'hidden',
  m: 2,
  width: 'calc(100% - 32px)',
  maxWidth: 420,
  boxShadow: '0 24px 80px rgba(2,6,23,.45)'
};

// ------------------------------------------------------------------ instalar
function InstallDialog({ pwa }) {
  const [step, setStep] = useState('intro'); // intro | installed
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const close = () => {
    closePwaDialog();
    setTimeout(() => {
      setStep('intro');
      setNote('');
    }, 250);
  };

  const ask = async () => {
    setBusy(true);
    await enableNotifications();
    setBusy(false);
  };

  const install = async () => {
    setBusy(true);
    setNote('');
    const outcome = await promptInstall();
    setBusy(false);
    if (outcome === 'accepted') {
      setStep('installed');
      // já pede a permissão; se o navegador exigir um toque, fica o botão
      await ask();
    } else if (outcome === 'dismissed') {
      setNote('Instalação cancelada. Você pode instalar quando quiser.');
    } else {
      setNote('O navegador não liberou a instalação agora. Recarregue a página e tente de novo.');
    }
  };

  let body;
  if (step === 'installed') {
    body = (
      <Stack spacing={2}>
        <Row icon={<IconCheck size={20} />} title="Pub Mail instalado" text="O ícone já está na sua tela inicial." />
        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
          Ative as notificações para saber na hora quando chegar mensagem nova, tarefa ou pagamento.
        </Typography>
        <NotifyBlock permission={pwa.permission} standalone={pwa.standalone} busy={busy} onEnable={ask} pwa={pwa} />
        <Button onClick={close} color="inherit" sx={{ color: 'text.secondary' }}>
          Fechar
        </Button>
      </Stack>
    );
  } else if (pwa.mode === 'ios') {
    body = (
      <Stack spacing={2.25}>
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No iPhone e no iPad a Apple não deixa instalar por um botão: é feito em 3 toques, pelo próprio navegador.
        </Alert>
        <Row
          step={1}
          icon={<IconShare2 size={20} />}
          title="Toque em Compartilhar"
          text={
            isIOSSafari ? 'O ícone fica na barra de baixo do Safari (no iPad, no alto).' : 'No Chrome, o ícone fica na barra de endereço.'
          }
        />
        <Row
          step={2}
          icon={<IconSquarePlus size={20} />}
          title="Escolha “Adicionar à Tela de Início”"
          text="Role a lista se a opção não aparecer de cara."
        />
        <Row
          step={3}
          icon={<IconBellRinging size={20} />}
          title="Abra o Pub Mail pelo ícone"
          text="Na primeira vez ele pede para ativar as notificações (iOS 16.4 ou mais novo)."
        />
        <Button fullWidth size="large" variant="contained" onClick={close} sx={{ py: 1.3, borderRadius: 2.5, fontWeight: 700 }}>
          Entendi
        </Button>
      </Stack>
    );
  } else if (pwa.mode === 'manual') {
    body = (
      <Stack spacing={2.25}>
        <Row step={1} icon={<IconDotsVertical size={20} />} title="Abra o menu do navegador" text="Os três pontinhos, no canto da tela." />
        <Row
          step={2}
          icon={<IconSquarePlus size={20} />}
          title="Toque em “Instalar app”"
          text="Em alguns navegadores aparece como “Adicionar à tela inicial”."
        />
        <Row
          step={3}
          icon={<IconBellRinging size={20} />}
          title="Abra o Pub Mail pelo ícone"
          text="Na primeira vez ele pede para ativar as notificações."
        />
        <Button fullWidth size="large" variant="contained" onClick={close} sx={{ py: 1.3, borderRadius: 2.5, fontWeight: 700 }}>
          Entendi
        </Button>
      </Stack>
    );
  } else {
    body = (
      <Stack spacing={2.25}>
        <Row
          icon={<IconDeviceMobile size={20} />}
          title="Tela cheia, como um aplicativo"
          text="Sem barra do navegador, direto da tela inicial."
        />
        <Row icon={<IconBellRinging size={20} />} title="Notificações" text="Mensagens novas, tarefas e pagamentos avisam na hora." />
        <Row
          icon={<IconBolt size={20} />}
          title="Leve e sempre atualizado"
          text="Não ocupa espaço de app de loja; cada melhoria chega sozinha."
        />
        {note ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            {note}
          </Alert>
        ) : null}
        <Button
          fullWidth
          size="large"
          variant="contained"
          disabled={busy}
          onClick={install}
          startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <IconDownload size={20} />}
          sx={{ py: 1.4, borderRadius: 2.5, fontWeight: 700 }}
        >
          Instalar app
        </Button>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>
          Depois de instalar, vamos pedir permissão para as notificações.
        </Typography>
      </Stack>
    );
  }

  return (
    <Dialog open={pwa.dialog === 'install'} onClose={close} PaperProps={{ sx: paperSx }}>
      <Header
        title={step === 'installed' ? 'Tudo pronto!' : 'Instale o Pub Mail'}
        subtitle={step === 'installed' ? 'Falta só ativar as notificações.' : 'No celular, tablet ou computador.'}
        onClose={close}
      />
      <Box sx={{ p: 3 }}>{body}</Box>
    </Dialog>
  );
}
InstallDialog.propTypes = { pwa: PropTypes.object };

// ------------------------------------------------------------------ notificações (app instalado)
function NotifyDialog({ pwa }) {
  const [busy, setBusy] = useState(false);
  const close = () => {
    safeSet(ASKED_KEY, String(Date.now()));
    closePwaDialog();
  };
  const ask = async () => {
    setBusy(true);
    const p = await enableNotifications();
    setBusy(false);
    safeSet(ASKED_KEY, String(Date.now()));
    // só fecha sozinho quando deu certo de ponta a ponta (permissão + inscrição); senão fica o aviso com "Tentar de novo"
    const st = pwaState();
    if (p === 'granted' && (st.pushSubscribed === true || !st.pushSupported)) setTimeout(closePwaDialog, 1600);
  };
  return (
    <Dialog open={pwa.dialog === 'notify'} onClose={close} PaperProps={{ sx: paperSx }}>
      <Header variant="bell" title="Ative as notificações" subtitle="Saiba na hora o que chega no Pub Mail." onClose={close} />
      <Box sx={{ p: 3, pt: 2.75 }}>
        <Stack spacing={2.5}>
          <Stack spacing={1.75}>
            <Row
              tone="success"
              icon={<IconMessage size={20} />}
              title="Mensagem nova no WhatsApp"
              text="Mesmo com o app fechado ou o celular na mesa."
            />
            <Row
              tone="warning"
              icon={<IconChecklist size={20} />}
              title="Tarefa vencendo"
              text="Um lembrete antes do prazo, sem precisar abrir o painel."
            />
            <Row
              tone="primary"
              icon={<IconCoin size={20} />}
              title="Pagamento confirmado"
              text="PIX de cliente caiu? Você fica sabendo na hora."
            />
          </Stack>
          <NotifyBlock permission={pwa.permission} standalone={pwa.standalone} busy={busy} onEnable={ask} pwa={pwa} />
          {pwa.permission === 'default' ? (
            <Button onClick={close} color="inherit" size="small" sx={{ color: 'text.secondary', alignSelf: 'center', px: 2 }}>
              Agora não
            </Button>
          ) : (
            <Button onClick={closePwaDialog} variant="outlined" sx={{ borderRadius: 2.5 }}>
              Fechar
            </Button>
          )}
        </Stack>
      </Box>
    </Dialog>
  );
}
NotifyDialog.propTypes = { pwa: PropTypes.object };

// ------------------------------------------------------------------ montagem (fica no MainLayout)
export default function PwaBoot() {
  const pwa = usePwa();
  const { mode, systemMode } = useColorScheme();
  const dark = (mode === 'system' ? systemMode : mode) === 'dark';

  useEffect(() => {
    initPwa();
  }, []);

  useEffect(() => {
    syncThemeColor(dark);
  }, [dark]);

  // 1ª abertura do app instalado (o caminho do iPhone/iPad): pede as notificações uma vez
  useEffect(() => {
    if (!pwa.standalone || pwa.permission !== 'default' || safeGet(ASKED_KEY)) return undefined;
    const t = setTimeout(() => openPwaDialog('notify'), 1500);
    return () => clearTimeout(t);
  }, [pwa.standalone, pwa.permission]);

  return (
    <>
      <InstallDialog pwa={pwa} />
      <NotifyDialog pwa={pwa} />
    </>
  );
}
