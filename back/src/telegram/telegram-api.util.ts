// Helpers finos p/ a Bot API do Telegram. Sem dependência externa (usa fetch nativo do Node 20).
// Todas as chamadas são best-effort do ponto de vista de rede; o service decide o que fazer com o retorno.

const TG_API = 'https://api.telegram.org';

export type TgResult<T> = {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  /** true quando a falha indica token inválido/revogado (bot banido/apagado). */
  unauthorized?: boolean;
  /** true quando foi falha de rede/timeout (não conseguimos falar com o Telegram). */
  network_error?: boolean;
  /** parâmetros extras do Telegram (ex.: { retry_after } no 429 de flood). */
  parameters?: { retry_after?: number; migrate_to_chat_id?: number } & Record<string, any>;
};

export type TgMe = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
};

async function call<T>(token: string, method: string, body?: Record<string, any>): Promise<TgResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${TG_API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (json && json.ok) {
      return { ok: true, result: json.result as T };
    }
    const code = Number(json?.error_code || res.status);
    return {
      ok: false,
      error_code: code,
      description: String(json?.description || `HTTP ${res.status}`),
      unauthorized: code === 401 || code === 404,
      parameters: json?.parameters || undefined,
    };
  } catch (err: any) {
    return {
      ok: false,
      network_error: true,
      description: String(err?.message || err || 'Falha de rede ao contatar o Telegram.'),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function getMe(token: string): Promise<TgResult<TgMe>> {
  return call<TgMe>(token, 'getMe');
}

export function setWebhook(
  token: string,
  url: string,
  secretToken: string,
): Promise<TgResult<boolean>> {
  return call<boolean>(token, 'setWebhook', {
    url,
    secret_token: secretToken,
    max_connections: 40,
    drop_pending_updates: false,
    allowed_updates: [
      'message',
      'edited_message',
      'channel_post',
      'edited_channel_post',
      'callback_query',
      'chat_join_request',
      'chat_member',
      'my_chat_member',
    ],
  });
}

export function deleteWebhook(token: string): Promise<TgResult<boolean>> {
  return call<boolean>(token, 'deleteWebhook', { drop_pending_updates: false });
}

export function sendMessage(
  token: string,
  chatId: string | number,
  text: string,
  extra?: Record<string, any>,
): Promise<TgResult<any>> {
  return call<any>(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(extra || {}),
  });
}

// Edita o texto de uma mensagem já enviada pelo bot (usado na mensagem rotativa).
export function editMessageText(
  token: string,
  chatId: string | number,
  messageId: number,
  text: string,
  extra?: Record<string, any>,
): Promise<TgResult<any>> {
  return call<any>(token, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    disable_web_page_preview: true,
    ...(extra || {}),
  });
}

export function deleteMessage(token: string, chatId: string | number, messageId: number): Promise<TgResult<any>> {
  return call<any>(token, 'deleteMessage', { chat_id: chatId, message_id: messageId });
}

export function editMessageCaption(
  token: string,
  chatId: string | number,
  messageId: number,
  caption: string,
  extra?: Record<string, any>,
): Promise<TgResult<any>> {
  return call<any>(token, 'editMessageCaption', { chat_id: chatId, message_id: messageId, caption, ...(extra || {}) });
}

export function editMessageReplyMarkup(
  token: string,
  chatId: string | number,
  messageId: number,
  replyMarkup?: Record<string, any>,
): Promise<TgResult<any>> {
  return call<any>(token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: replyMarkup || { inline_keyboard: [] } });
}

export function answerCallbackQuery(token: string, callbackQueryId: string, text?: string): Promise<TgResult<any>> {
  return call<any>(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

export function sendChatAction(token: string, chatId: string | number, action = 'typing'): Promise<TgResult<any>> {
  return call<any>(token, 'sendChatAction', { chat_id: chatId, action });
}

// Envia mídia por URL pública (Telegram baixa a URL). caption + reply_markup via extra.
export function sendMediaUrl(
  token: string,
  chatId: string | number,
  type: string,
  url: string,
  caption?: string,
  extra?: Record<string, any>,
): Promise<TgResult<any>> {
  const method =
    { photo: 'sendPhoto', video: 'sendVideo', voice: 'sendVoice', audio: 'sendAudio', document: 'sendDocument' }[type] ||
    'sendDocument';
  const field = { photo: 'photo', video: 'video', voice: 'voice', audio: 'audio', document: 'document' }[type] || 'document';
  return call<any>(token, method, {
    chat_id: chatId,
    [field]: url,
    ...(caption ? { caption } : {}),
    ...(extra || {}),
  });
}

export function getUserProfilePhotos(token: string, userId: string | number): Promise<TgResult<any>> {
  return call<any>(token, 'getUserProfilePhotos', { user_id: userId, limit: 1 });
}

export function getChatMemberCount(token: string, chatId: string | number): Promise<TgResult<number>> {
  return call<number>(token, 'getChatMemberCount', { chat_id: chatId });
}

export function getChat(token: string, chatId: string | number): Promise<TgResult<any>> {
  return call<any>(token, 'getChat', { chat_id: chatId });
}

export function createChatInviteLink(
  token: string,
  chatId: string | number,
  name?: string,
  opts?: { member_limit?: number; expire_date?: number; creates_join_request?: boolean },
): Promise<TgResult<any>> {
  return call<any>(token, 'createChatInviteLink', { chat_id: chatId, ...(name ? { name } : {}), ...(opts || {}) });
}

export function leaveChat(token: string, chatId: string | number): Promise<TgResult<any>> {
  return call<any>(token, 'leaveChat', { chat_id: chatId });
}

// Remove um membro do grupo/canal (kick). unban logo em seguida = permite voltar depois.
export function banChatMember(token: string, chatId: string | number, userId: string | number): Promise<TgResult<any>> {
  return call<any>(token, 'banChatMember', { chat_id: chatId, user_id: userId });
}
export function unbanChatMember(token: string, chatId: string | number, userId: string | number): Promise<TgResult<any>> {
  return call<any>(token, 'unbanChatMember', { chat_id: chatId, user_id: userId, only_if_banned: true });
}

// ---- perfil do bot (setáveis via Bot API) ----
export function getMyName(token: string): Promise<TgResult<any>> {
  return call<any>(token, 'getMyName');
}
export function setMyName(token: string, name: string): Promise<TgResult<any>> {
  return call<any>(token, 'setMyName', { name });
}
export function getMyDescription(token: string): Promise<TgResult<any>> {
  return call<any>(token, 'getMyDescription');
}
export function setMyDescription(token: string, description: string): Promise<TgResult<any>> {
  return call<any>(token, 'setMyDescription', { description });
}
export function getMyShortDescription(token: string): Promise<TgResult<any>> {
  return call<any>(token, 'getMyShortDescription');
}
export function setMyShortDescription(token: string, short_description: string): Promise<TgResult<any>> {
  return call<any>(token, 'setMyShortDescription', { short_description });
}
export function getMyCommands(token: string): Promise<TgResult<any>> {
  return call<any>(token, 'getMyCommands');
}
export function setMyCommands(token: string, commands: { command: string; description: string }[]): Promise<TgResult<any>> {
  return call<any>(token, 'setMyCommands', { commands });
}

export function getFile(token: string, fileId: string): Promise<TgResult<any>> {
  return call<any>(token, 'getFile', { file_id: fileId });
}

// Baixa o binário de um arquivo do Telegram (o token fica no server — nunca vai pro browser).
export async function downloadFile(
  token: string,
  filePath: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${TG_API}/file/bot${token}/${filePath}`, { signal: controller.signal });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    return { buffer: Buffer.from(ab), contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Envia uma foto (multipart). caption opcional.
export async function sendPhoto(
  token: string,
  chatId: string | number,
  buffer: Buffer,
  filename: string,
  caption?: string,
  extra?: Record<string, any>,
): Promise<TgResult<any>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    if (caption) form.append('caption', caption);
    for (const [k, v] of Object.entries(extra || {})) {
      if (v === undefined || v === null) continue;
      form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    const uint = new Uint8Array(buffer);
    form.append('photo', new Blob([uint]), filename || 'photo.jpg');
    const res = await fetch(`${TG_API}/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form as any,
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (json && json.ok) return { ok: true, result: json.result };
    const code = Number(json?.error_code || res.status);
    return { ok: false, error_code: code, description: String(json?.description || `HTTP ${res.status}`), unauthorized: code === 401 || code === 404 };
  } catch (err: any) {
    return { ok: false, network_error: true, description: String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}
