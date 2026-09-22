// ============================================================================
// Validação e sanitização CANÔNICA de e-mail — fonte única da verdade.
// Usada em TODAS as portas de entrada (captação quiz/webchat, form/API,
// importação), no cron de higiene e no micro de e-mail.
//
// Motivo: a Resend rejeita o LOTE INTEIRO se um único `to` for inválido
// (ex.: "gmail..com" com ponto duplo). A regex frouxa `\S+@\S+\.\S+` que
// existia aceitava esses casos e deixava e-mails ruins entrarem. Aqui o
// validador é ESTRITO (rejeita pontos consecutivos, pontos nas pontas, etc.)
// e o sanitizador tenta CONSERTAR os erros comuns antes de descartar.
// ============================================================================

const MAX_LEN = 254;
// Estrito: 1 arroba, sem espaços, domínio com pelo menos um ponto e TLD >= 2.
const STRICT_RE =
  /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?)+$/;

// Normaliza SEM consertar agressivamente: tira espaços, <>, mailto:, minúsculo.
export function normalizeEmail(raw: string | null | undefined): string {
  let e = String(raw ?? '').trim();
  if (!e) return '';
  const angle = e.match(/<([^>]+)>/); // "Nome <email>" -> email
  if (angle) e = angle[1].trim();
  e = e.replace(/^mailto:/i, '');
  e = e.replace(/\s+/g, ''); // e-mail nunca tem espaço
  return e.toLowerCase().slice(0, MAX_LEN);
}

// Valida de forma ESTRITA (o que a Resend aceita).
export function isValidEmail(raw: string | null | undefined): boolean {
  const e = String(raw ?? '');
  if (!e || e.length > MAX_LEN) return false;
  if (e.includes('..')) return false; // pontos consecutivos (o bug do gmail..com)
  if (!STRICT_RE.test(e)) return false;
  const at = e.indexOf('@');
  const local = e.slice(0, at);
  if (local.startsWith('.') || local.endsWith('.')) return false; // ponto na ponta do local
  const domain = e.slice(at + 1);
  if (domain.length > 253) return false;
  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  if (tld.length < 2) return false;
  return true;
}

// Tenta CONSERTAR os erros mais comuns; retorna o candidato (pode ainda ser inválido).
export function sanitizeEmail(raw: string | null | undefined): string {
  let e = normalizeEmail(raw);
  if (!e) return '';
  e = e.replace(/,/g, '.'); // vírgula onde deveria ser ponto (erro de digitação comum)
  e = e.replace(/\.{2,}/g, '.'); // "gmail..com" -> "gmail.com"
  const at = e.indexOf('@');
  if (at > 0) {
    let local = e.slice(0, at).replace(/^\.+|\.+$/g, '');
    let domain = e
      .slice(at + 1)
      .replace(/^[.\-]+|[.\-]+$/g, '')
      .replace(/\.{2,}/g, '.');
    e = `${local}@${domain}`;
  }
  return e.slice(0, MAX_LEN);
}

// Sanitiza e valida: devolve o e-mail LIMPO e válido, ou null.
// É o atalho usado nas portas de entrada (conserta o que dá, descarta o resto).
export function cleanEmailOrNull(raw: string | null | undefined): string | null {
  const fixed = sanitizeEmail(raw);
  return isValidEmail(fixed) ? fixed : null;
}

export type EmailClassification =
  | { status: 'valid'; email: string } // já era válido (só normalizado)
  | { status: 'fixed'; email: string; original: string } // consertado -> válido
  | { status: 'invalid'; email: string }; // não dá pra consertar

// Classifica um endereço — usado pelo cron de higiene pra decidir consertar x remover.
export function classifyEmail(raw: string | null | undefined): EmailClassification {
  const norm = normalizeEmail(raw);
  if (isValidEmail(norm)) return { status: 'valid', email: norm };
  const fixed = sanitizeEmail(raw);
  if (isValidEmail(fixed)) {
    return fixed === norm
      ? { status: 'valid', email: fixed }
      : { status: 'fixed', email: fixed, original: norm };
  }
  return { status: 'invalid', email: norm };
}
