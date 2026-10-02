// Cartão de contato do WhatsApp: o texto da mensagem é um ou mais vCards
// (BEGIN:VCARD … END:VCARD). Lê nome, empresa e telefones. Função pura.

const unescape = (v) =>
  String(v || '')
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;:\\])/g, '$1')
    .trim();

// "N:Sobrenome;Nome;Meio;Prefixo;Sufixo" → "Prefixo Nome Meio Sobrenome Sufixo"
function nameFromN(v) {
  const [family, given, middle, prefix, suffix] = String(v || '')
    .split(';')
    .map(unescape);
  return [prefix, given, middle, family, suffix].filter(Boolean).join(' ').trim();
}

export function parseVCards(raw) {
  const text = String(raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n[ \t]/g, ''); // linhas dobradas (RFC 6350)
  const cards = [];
  const re = /BEGIN:VCARD([\s\S]*?)END:VCARD/gi;
  let m;
  while ((m = re.exec(text)) && cards.length < 50) {
    const c = { name: '', org: '', phones: [] };
    let fromN = '';
    let biz = '';
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i < 1) continue;
      const params = line.slice(0, i).split(';');
      const prop = params[0].toUpperCase().replace(/^ITEM\d+\./, '');
      const value = line.slice(i + 1);
      if (prop === 'FN') c.name = c.name || unescape(value);
      else if (prop === 'N') fromN = fromN || nameFromN(value);
      else if (prop === 'X-WA-BIZ-NAME') biz = biz || unescape(value);
      else if (prop === 'ORG') c.org = c.org || unescape(value).split(';').filter(Boolean).join(' · ');
      else if (prop === 'TEL') {
        const waid = params.find((p) => /^waid=/i.test(p));
        const digits = (waid ? waid.split('=')[1] : value).replace(/\D/g, '');
        if (digits && !c.phones.includes(digits)) c.phones.push(digits);
      }
    }
    c.name = c.name || fromN || biz || c.org;
    if (biz && biz !== c.name && !c.org) c.org = biz;
    cards.push(c);
  }
  return cards;
}

// Contato estruturado (evento ao vivo) ou vCard no texto → lista de { name, org, phones[] }.
export function contactsOfMessage(msg) {
  const raw = msg?.extra?.contact;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out = [];
  for (const c of list) {
    if (c && typeof c === 'object' && (c.vcard || c.vCard)) out.push(...parseVCards(c.vcard || c.vCard));
    else if (c && typeof c === 'object') {
      const phones = [c.phone, c.number, ...(Array.isArray(c.phones) ? c.phones : [])]
        .map((p) => String(p || '').replace(/\D/g, ''))
        .filter(Boolean);
      out.push({
        name: String(c.name || c.displayName || c.display_name || c.formattedName || '').trim(),
        org: '',
        phones: [...new Set(phones)]
      });
    }
  }
  if (!out.length) out.push(...parseVCards(msg?.body));
  return out;
}
