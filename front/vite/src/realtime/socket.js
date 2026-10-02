import { io } from 'socket.io-client';
import { api, getAccessToken, refreshAccessToken } from 'api/api';

// Cliente único do WebSocket do painel (Socket.IO em <API>/realtime).
// - autentica com o access token no handshake (lido a cada tentativa → pega o token renovado);
// - token expirado: o servidor recusa com "unauthorized" → renova pelo api.js e reconecta;
// - conecta sob demanda (a 1ª tela que usar um evento abre a conexão).
let socket = null;
let retryTimer = null;
let authFailures = 0;

function scheduleReconnect(ms) {
  if (retryTimer) return;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    if (socket && !socket.connected && getAccessToken()) socket.connect();
  }, ms);
}

export function getSocket() {
  if (socket) return socket;
  const base = String(api.defaults.baseURL || '').replace(/\/+$/, '');
  socket = io(base, {
    path: '/realtime',
    transports: ['websocket', 'polling'],
    auth: (cb) => cb({ token: getAccessToken() }),
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 15000
  });
  socket.on('connect', () => {
    authFailures = 0;
  });
  socket.on('connect_error', async (err) => {
    // erro do middleware (token inválido/expirado) não reconecta sozinho
    if (String(err?.message || '') !== 'unauthorized') return;
    authFailures += 1;
    if (!getAccessToken() || authFailures > 5) return;
    try {
      await refreshAccessToken();
    } catch {
      return; // sessão acabou — o api.js leva ao login
    }
    scheduleReconnect(Math.min(15000, 1000 * authFailures));
  });
  return socket;
}

export function disconnectSocket() {
  if (retryTimer) window.clearTimeout(retryTimer);
  retryTimer = null;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  socket = null;
}
