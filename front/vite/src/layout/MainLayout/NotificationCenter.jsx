import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconBellRinging, IconX } from '@tabler/icons-react';

import { useRealtimeEvent } from 'realtime/useRealtime';
import { playSound, primeAudio, vibrate } from 'notifications/sounds';
import { syncPush } from 'pwa/pwa';
import { KIND_ICON } from 'views/pages/whatsapp/notifications/kinds';

// ============================================================================
// Central de avisos do painel: recebe `notify` pelo WebSocket (já filtrado pelas preferências
// do usuário no servidor) e mostra um toast com som e vibração. Também:
//  - destrava o áudio no 1º gesto (o navegador bloqueia som sem interação);
//  - sincroniza a inscrição do push ao abrir o painel e quando o service worker pede;
//  - repassa cada aviso em `window` ('pm:notify') para a tela de Notificações atualizar ao vivo.
// ============================================================================

export default function NotificationCenter() {
  const navigate = useNavigate();
  const seen = useRef(new Set());

  useEffect(() => {
    const prime = () => {
      primeAudio();
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
    window.addEventListener('pointerdown', prime);
    window.addEventListener('keydown', prime);
    const t = setTimeout(() => {
      syncPush().catch(() => undefined);
    }, 2500);
    const onSw = (ev) => {
      const d = ev?.data || {};
      if (d.type === 'pm:resubscribe') syncPush().catch(() => undefined);
      if (d.type === 'pm:push' && d.notification)
        window.dispatchEvent(new CustomEvent('pm:notify', { detail: { ...d.notification, via: 'push' } }));
    };
    navigator.serviceWorker?.addEventListener?.('message', onSw);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
      navigator.serviceWorker?.removeEventListener?.('message', onSw);
    };
  }, []);

  useRealtimeEvent('notify', (n) => {
    if (!n || !n.title) return;
    const key = n.id || `${n.tag}:${n.at}`;
    if (seen.current.has(key)) return;
    seen.current.add(key);
    if (seen.current.size > 500) seen.current.clear();
    window.dispatchEvent(new CustomEvent('pm:notify', { detail: { ...n, via: 'inapp' } }));
    playSound(n.sound);
    vibrate(n.vibrate);
    // aba do Pub Mail em segundo plano (outra aba/janela): aviso do sistema, local, pelo service worker
    if (document.visibilityState !== 'visible' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      navigator.serviceWorker
        ?.getRegistration?.('/')
        .then((reg) => {
          if (!reg) return;
          const opts = {
            body: n.body || '',
            icon: n.icon || '/pwa/icon-192.png',
            badge: '/pwa/badge-96.png',
            tag: n.tag || undefined,
            renotify: Boolean(n.tag),
            silent: n.sound === 'none',
            requireInteraction: Boolean(n.important),
            data: { url: n.url || '/dashboard', kind: n.kind, id: n.id }
          };
          if (Array.isArray(n.vibrate) && n.vibrate.length) opts.vibrate = n.vibrate;
          reg.showNotification(n.title, opts).catch(() => undefined);
        })
        .catch(() => undefined);
    }
    const Icon = KIND_ICON[n.kind] || IconBellRinging;
    const open = () => {
      if (n.url) {
        if (/^https?:\/\//.test(n.url)) window.open(n.url, '_blank', 'noopener');
        else navigate(n.url);
      }
    };
    toast.custom(
      (t) => (
        <Box
          role="button"
          tabIndex={0}
          onClick={() => {
            toast.dismiss(t.id);
            open();
          }}
          onKeyDown={(e) => e.key === 'Enter' && open()}
          sx={{
            display: 'flex',
            gap: 1.25,
            alignItems: 'flex-start',
            maxWidth: 360,
            minWidth: 260,
            p: 1.5,
            pr: 1,
            borderRadius: 3,
            cursor: n.url ? 'pointer' : 'default',
            bgcolor: 'background.paper',
            color: 'text.primary',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 12px 40px rgba(2,6,23,.22)',
            opacity: t.visible ? 1 : 0,
            transform: t.visible ? 'translateY(0)' : 'translateY(-8px)',
            transition: 'opacity .18s, transform .18s'
          }}
        >
          <Box
            sx={(th) => ({
              width: 38,
              height: 38,
              flexShrink: 0,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: `rgba(${th.vars.palette.primary.mainChannel} / 0.12)`
            })}
          >
            {n.icon ? (
              <Box
                component="img"
                src={n.icon}
                alt=""
                sx={{ width: 38, height: 38, borderRadius: 2.5, objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <Icon size={20} />
            )}
          </Box>
          <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25 }} noWrap>
              {n.title}
            </Typography>
            {n.body ? (
              <Typography
                sx={{
                  fontSize: 13,
                  color: 'text.secondary',
                  lineHeight: 1.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {n.body}
              </Typography>
            ) : null}
          </Stack>
          <IconButton
            size="small"
            aria-label="fechar"
            onClick={(e) => {
              e.stopPropagation();
              toast.dismiss(t.id);
            }}
            sx={{ mt: -0.5, color: 'text.secondary' }}
          >
            <IconX size={16} />
          </IconButton>
        </Box>
      ),
      { duration: n.important ? 12000 : 6000, position: 'top-right', id: n.tag || undefined }
    );
  });

  return null;
}
