// ============================================================================
// Importação de templates via planilha (.xlsx / .csv) gerada pelo Claude.
// Colunas PLANAS (fáceis de gerar) -> convertidas no builder_model do editor
// (via emailBuilderCore) -> ficam editáveis no construtor e geram HTML limpo.
// ============================================================================

import { createBlock, createDefaultBody, normalizeModel, modelToHtml } from './emailBuilderCore';

// HTML de pré-visualização: substitui as variáveis por valores de exemplo e
// "desfaz" o wrapper de tracking do CTA pra mostrar o link real.
const PREVIEW_VARS = {
  '{{name}}': 'Maria',
  '{{email}}': 'maria@exemplo.com',
  '{{phone}}': '(11) 98888-7777',
  '{{unsubscribe_link}}': '#',
  '{{open_email_pixel}}': ''
};
export function previewHtml(model) {
  let h = modelToHtml(model);
  h = h.replace(/\{\{base_webhook_cta_click\}\}\?redirectUrl=([^"']+)/g, (_m, u) => {
    try { return decodeURIComponent(u); } catch { return '#'; }
  });
  for (const [k, v] of Object.entries(PREVIEW_VARS)) h = h.split(k).join(v);
  return h;
}

export const TEMPLATE_COLUMNS = [
  'name', 'from_name', 'subject', 'preheader', 'heading', 'intro', 'image_url',
  'bullets', 'body', 'cta_text', 'cta_url', 'ps', 'accent_color'
];

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// normaliza as chaves da linha (case-insensitive) e pega o 1º campo não-vazio
const normRow = (row) => {
  const o = {};
  for (const k in row) o[String(k).trim().toLowerCase()] = row[k];
  return o;
};
const pick = (r, ...names) => {
  for (const n of names) {
    const v = r[n];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

// Uma linha da planilha -> { name, subject, model, valid }
export function rowToTemplate(rawRow) {
  const r = normRow(rawRow);

  const name = pick(r, 'name', 'nome') || 'Template importado';
  const fromName = pick(r, 'from_name', 'remetente', 'de');
  const subject = pick(r, 'subject', 'assunto') || name;
  const preheader = pick(r, 'preheader', 'previa', 'prévia', 'preview');
  const heading = pick(r, 'heading', 'titulo', 'título');
  const intro = pick(r, 'intro', 'introducao', 'introdução');
  const imageUrl = pick(r, 'image_url', 'imagem', 'image');
  const bullets = pick(r, 'bullets', 'topicos', 'tópicos');
  const body = pick(r, 'body', 'corpo', 'texto');
  const ctaText = pick(r, 'cta_text', 'cta', 'botao', 'botão');
  const ctaUrl = pick(r, 'cta_url', 'link', 'url');
  const ps = pick(r, 'ps', 'p.s.');
  const accent = pick(r, 'accent_color', 'cor', 'accent') || '#4f46e5';

  const blocks = [];
  if (heading) blocks.push({ ...createBlock('heading'), html: esc(heading), align: 'center', color: accent });
  if (intro) blocks.push({ ...createBlock('text'), html: esc(intro) });
  if (imageUrl) blocks.push({ ...createBlock('image'), src: imageUrl });
  if (bullets) {
    const html = bullets.split('|').map((b) => b.trim()).filter(Boolean).map((b) => `• ${esc(b)}`).join('<br>');
    if (html) blocks.push({ ...createBlock('text'), html });
  }
  if (body) blocks.push({ ...createBlock('text'), html: esc(body) });
  if (ctaText && ctaUrl) blocks.push({ ...createBlock('button'), text: ctaText, href: ctaUrl, tracked: true, bg: accent });
  if (ps) blocks.push({ ...createBlock('text'), html: `<i>${esc(ps)}</i>`, fontSize: 13, color: '#6b7280' });

  blocks.push(createBlock('divider'));
  blocks.push({
    ...createBlock('text'),
    html: 'Se não quiser mais receber estes e-mails, <a href="{{unsubscribe_link}}">descadastre-se aqui</a>.',
    fontSize: 12, color: '#9ca3af', align: 'center'
  });

  const model = normalizeModel({ body: createDefaultBody(), blocks, preheader, from_name: fromName });
  const valid = Boolean(heading || intro || body || bullets);
  return { name, subject, model, valid };
}

// Lê o arquivo (xlsx ou csv) -> array de templates { name, subject, model, valid }
// xlsx é carregado sob demanda (dynamic import) pra não pesar o bundle inicial.
export async function parseTemplatesFile(file) {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name || '') || /csv/i.test(file.type || '');
  let wb;
  if (isCsv) {
    // Decodifica como UTF-8 explicitamente (evita acentos quebrados no CSV).
    const text = new TextDecoder('utf-8').decode(buf).replace(/^﻿/, '');
    wb = XLSX.read(text, { type: 'string', raw: true });
  } else {
    wb = XLSX.read(buf, { type: 'array' });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return rows.map(rowToTemplate);
}

// CSV de exemplo pra baixar (referência de formato)
export function exampleCsv() {
  const header = TEMPLATE_COLUMNS.join(',');
  const row1 = [
    'Boas-vindas — dor',
    'Equipe SuperSim',
    'Bem-vindo(a), {{name}}!',
    'Seu primeiro passo começa agora — veja como',
    'Que bom te ver aqui, {{name}} 👋',
    'Você deu o primeiro passo pra resolver [problema]. Deixa eu te mostrar como.',
    '',
    'Resultados já na 1ª semana|Suporte humano de verdade|Cancele quando quiser',
    'Milhares de pessoas já usam pra [benefício]. Bora começar o seu?',
    'Quero começar agora',
    'https://seusite.com/comecar',
    'P.S.: a oferta de boas-vindas vale só hoje.',
    '#4f46e5'
  ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
  return `${header}\n${row1}\n`;
}

// O prompt completo que o usuário copia e cola no Claude.
export function buildClaudePrompt() {
  return `Você é um especialista em copywriting de e-mail marketing de resposta direta (foco em CONVERSÃO). Vou te usar para criar VÁRIOS templates de e-mail de uma vez. Sua entrega final é UM arquivo de planilha (.csv ou .xlsx) que eu vou baixar e importar na minha plataforma de e-mail marketing.

## Como você deve agir
- Fale comigo de forma DIRETA e OBJETIVA, na minha língua. Nada de rodeios.
- ANTES de gerar qualquer coisa, me faça poucas perguntas certeiras para entender:
  1. Nicho/mercado e público-alvo.
  2. Produto/serviço/oferta e a principal proposta de valor.
  3. Objetivo (vender, agendar, reativar, nutrir...) e a ação desejada (CTA).
  4. Os LINKS de destino dos botões (CTA) — pode ser 1 link geral ou 1 por e-mail.
  5. Quantos templates você quer.
  6. Tom de voz (formal, descontraído, urgente...) e palavras-chave/temas.
  7. Detalhes da oferta (preço, prazo, bônus, garantia, prova social).
- Se eu já tiver te dado algo, não pergunte de novo. Assim que tiver o essencial, gere o arquivo.

## O que a plataforma faz por você (NÃO se preocupe com isto)
- O HTML final é gerado pela PLATAFORMA — de propósito é SIMPLES e "arcaico" (sem tabelas, sem CSS complexo). Isso é INTENCIONAL: e-mail simples cai na CAIXA DE ENTRADA e tem ótima entregabilidade. Então você NÃO escreve HTML: só preenche os textos.
- Personalização automática — use estas variáveis no texto quando fizer sentido:
  - {{name}} = primeiro nome do lead
  - {{email}} = e-mail do lead
  - {{phone}} = telefone do lead
  Não invente outras variáveis.
- O rastreamento de clique e o link de descadastro são adicionados AUTOMATICAMENTE. Você só me dá a URL real do botão (coluna cta_url). NÃO inclua rodapé de descadastro nem HTML.

## Foco: CONVERSÃO (a copy tem que vender de verdade)
- Assunto curto e magnético (ideal < 60 caracteres).
- Gancho forte na abertura, benefícios (não features), prova/urgência quando couber, e UM CTA principal e óbvio.
- Texto escaneável: frases e parágrafos curtos. Use {{name}} para personalizar.
- Se eu pedir vários templates, VARIE os ângulos (dor, desejo, prova social, urgência, objeção, história) pra eu ter opções boas.

## ENTREGABILIDADE — CAIR NA CAIXA DE ENTRADA (regra de OURO, não negociável)
O objetivo nº1 é o e-mail chegar na CAIXA DE ENTRADA — não na aba Promoções nem no spam. Copys anteriores caíram em Promoções; NÃO repita os erros abaixo:
- Escreva como um HUMANO escreveria para OUTRO humano (1 para 1), não como uma loja em promoção. Tom pessoal, conversa direta.
- NADA de linguagem de "loja/varejo": evite "OFERTA", "PROMOÇÃO", "DESCONTO", "COMPRE AGORA", "IMPERDÍVEL", "%OFF", preços gigantes, contagem regressiva agressiva.
- SEM palavras/sinais de spam: "GRÁTIS", "GANHE DINHEIRO", "100% grátis", "clique aqui", "$$$", "R$$$", CAPS LOCK em frase inteira, excesso de "!!!", excesso de emoji (no máx. 1–2 e só se natural).
- Assunto e preheader NUNCA parecendo anúncio. Prefira curiosidade/benefício pessoal a "MEGA OFERTA".
- Proporção saudável de TEXTO. E-mail só com imagem grande + botão = cara de propaganda → Promoções. Priorize texto real; imagem é complemento, opcional.
- UM CTA principal. Muitos links/botões = cara de newsletter promocional.
- Personalize com {{name}} e fale de algo relevante pro leitor, não do "produto em oferta".
- Regra prática: se o e-mail parece um panfleto/anúncio, reescreva pra parecer uma mensagem pessoal útil.

## Formato do arquivo (MUITO IMPORTANTE)
Gere uma planilha com UMA LINHA por template e EXATAMENTE estas colunas (cabeçalho na 1ª linha, em inglês, minúsculas):

name, from_name, subject, preheader, heading, intro, image_url, bullets, body, cta_text, cta_url, ps, accent_color

O que vai em cada coluna:
- name — nome interno do template (só pra eu identificar). Ex.: "Boas-vindas — dor"
- from_name — (opcional) o NOME DO REMETENTE que aparece na caixa de entrada SÓ desse e-mail (ex.: "João da Equipe", "Ana | Suporte"). Um nome de PESSOA (não de loja) ajuda MUITO a cair na caixa de entrada e a abrir. Se vazio, a plataforma usa o remetente padrão do projeto. Preencha quando um nome pessoal fizer a copy soar mais 1-a-1.
- subject — o assunto do e-mail (o que aparece na caixa de entrada).
- preheader — o texto de pré-visualização (aparece ao lado do assunto na caixa de entrada, some no corpo). Curto, complementa o assunto e aumenta a abertura. Pode usar {{name}}.
- heading — título grande no topo (a chamada principal). Pode usar {{name}}.
- intro — primeiro parágrafo (o gancho). Pode usar {{name}}.
- image_url — (opcional) URL de uma imagem. Vazio se não houver. LEMBRE: e-mail sem texto e só imagem cai em Promoções — use imagem só como apoio.
- bullets — (opcional) benefícios/tópicos separados por | (barra vertical). Ex.: "Economize tempo|Resultados em 7 dias|Suporte humano"
- body — (opcional) parágrafo aprofundando a oferta (depois da imagem/bullets).
- cta_text — texto do botão. Ex.: "Quero começar agora" (evite "COMPRE AGORA"/"CLIQUE AQUI").
- cta_url — URL de destino do botão (o link que eu te passei).
- ps — (opcional) um P.S. curto (ótimo pra reforço/urgência).
- accent_color — (opcional) cor do botão/título em hex (ex.: #4f46e5). Vazio = padrão.

Regras do arquivo:
- Sempre inclua a linha de cabeçalho exatamente com esses nomes (na ordem acima).
- name e subject são obrigatórios; pelo menos um entre heading/intro/body deve ter conteúdo.
- NÃO coloque HTML nas colunas — só texto puro (pode usar {{name}} etc.).
- Se gerar CSV: UTF-8, separado por vírgula, e coloque entre aspas qualquer campo com vírgula/aspas/quebra de linha (escape aspas internas dobrando-as: ""). Se puder, prefira .xlsx (mais seguro).

## Depois de importar (contexto — a plataforma tem um construtor visual)
Depois que eu importo, cada template abre num CONSTRUTOR VISUAL onde eu posso deixar mais bonito com blocos simples que continuam caindo na caixa de entrada: barra de cor no topo, cards com ícone (checklist/aviso), duas colunas (logo + selo), botão de largura total. Você NÃO precisa gerar isso — só entregue a copy nas colunas acima que eu refino visualmente. Foque em copy que CONVERTE e que CAI NA CAIXA DE ENTRADA.

Quando terminarmos de acertar tudo, gere o arquivo PRONTO para download. Comece agora me perguntando só o essencial.`;
}
