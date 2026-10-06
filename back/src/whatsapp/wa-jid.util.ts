// Utilitários de JID do WhatsApp (sem dependências — pode ser importado por qualquer serviço
// sem criar import circular entre serviços).
// `wa_id` = jid (`<digitos>@c.us` ou `<id>@lid`); `phone` = só dígitos quando conhecido.
export const digitsOf = (v: unknown) => String(v || '').replace(/\D/g, '');
export const jidFromPhone = (phone: string) => `${digitsOf(phone)}@c.us`;
export const phoneFromJid = (jid: string) => (/@c\.us$|@s\.whatsapp\.net$/.test(String(jid || '')) ? digitsOf(String(jid).split('@')[0]) : '');
export const isGroupJid = (jid: string) => /@g\.us$/.test(String(jid || ''));
export const isLidJid = (jid: string) => /@lid$/.test(String(jid || ''));
/** "Nome" que na verdade é um id (lid/telefone só com dígitos) — o gateway manda isso quando não há nome. */
export const isIdLikeName = (name: unknown) => /^\+?\d{8,}$/.test(String(name || '').trim());
// Remove o sufixo de dispositivo (`5511…:30@c.us` / `123…:30@lid`) — mensagens de sistema do próprio aparelho.
export const normJid = (jid: string) => String(jid || '').replace(/:\d+@/, '@');
export const hasDeviceSuffix = (jid: string) => /:\d+@/.test(String(jid || ''));
