import { useEffect, useRef, useState } from 'react';
import { getSocket } from './socket';

/** Assina um evento do WebSocket enquanto o componente estiver montado. */
export function useRealtimeEvent(event, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket();
    const fn = (payload) => ref.current?.(payload);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
  }, [event]);
}

/**
 * Estado da conexão em tempo real. `onReconnect` roda quando a conexão volta depois de cair
 * (bom momento para buscar o que pode ter sido perdido).
 */
export function useRealtimeStatus(onReconnect) {
  const s = getSocket();
  const [connected, setConnected] = useState(s.connected);
  const cb = useRef(onReconnect);
  cb.current = onReconnect;
  useEffect(() => {
    const sock = getSocket();
    let wasDown = !sock.connected;
    const up = () => {
      setConnected(true);
      if (wasDown) cb.current?.();
      wasDown = false;
    };
    const down = () => {
      setConnected(false);
      wasDown = true;
    };
    sock.on('connect', up);
    sock.on('disconnect', down);
    setConnected(sock.connected);
    return () => {
      sock.off('connect', up);
      sock.off('disconnect', down);
    };
  }, []);
  return { connected };
}
