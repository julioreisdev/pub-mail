import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { TgCard } from 'views/pages/telegram/ui';
import { CollapsibleSection } from 'views/pages/whatsapp/crm/crmKit';
import { API_BASE, CodeBlock, EVENT_GROUPS, MESSAGE_EVENT, monoSx } from './apiKit';

// ============================================================================
// Aba "Documentação": referência estática da API pública (/api/v1/whatsapp) e
// do formato dos webhooks. Mantém em sincronia com docs/whatsapp-assinaturas-contrato.md §8.
// ============================================================================

const KEY = 'pm_SUACHAVE';
const METHOD_COLOR = { GET: 'info', POST: 'success', PUT: 'warning', DELETE: 'error' };

const curl = (method, path, body) => {
  const lines = [`curl -X ${method} "${API_BASE}${path}"`, `  -H "Authorization: Bearer ${KEY}"`];
  if (body) {
    lines.push('  -H "Content-Type: application/json"');
    lines.push(`  -d '${JSON.stringify(body)}'`);
  }
  return lines.join(' \\\n');
};

const SECTIONS = [
  {
    title: 'Produtos',
    items: [{ m: 'GET', p: '/products', scope: 'products:read', d: 'Catálogo (nome, preço, cobrança, regras de acesso).' }]
  },
  {
    title: 'Clientes',
    items: [
      {
        m: 'GET',
        p: '/customers?q=maria&page=1&page_size=50',
        scope: 'customers:read',
        d: 'Lista e busca. Filtros: q (nome/telefone), doc (CPF/CNPJ), code, phone.'
      },
      { m: 'GET', p: '/customers/:id', scope: 'customers:read', d: 'Um cliente com números, assinaturas e campos personalizados.' },
      {
        m: 'POST',
        p: '/customers',
        scope: 'customers:write',
        d: 'Cria um cliente. O telefone vira o WhatsApp principal dele.',
        body: { name: 'Maria Souza', phone: '5511999998888', doc: '12345678909', email: 'maria@exemplo.com', code: 'A-102' }
      },
      { m: 'PUT', p: '/customers/:id', scope: 'customers:write', d: 'Altera os dados do cliente.', body: { email: 'novo@exemplo.com' } }
    ]
  },
  {
    title: 'Assinaturas',
    items: [
      {
        m: 'GET',
        p: '/subscriptions?customer_id=:id&status=active',
        scope: 'subscriptions:read',
        d: 'Lista (status: active, overdue, paused, canceled).'
      },
      { m: 'GET', p: '/subscriptions/:id', scope: 'subscriptions:read', d: 'Uma assinatura (valor, próximo vencimento, situação).' },
      {
        m: 'POST',
        p: '/customers/:id/subscriptions',
        scope: 'subscriptions:write',
        d: 'Assina um produto. A 1ª cobrança segue as regras do produto; charge_now:true cobra na hora.',
        body: { product_id: 'uuid-do-produto', due_day: 10, coupon: 'BEMVINDO', charge_now: false, external_id: 'pedido-123' }
      },
      {
        m: 'POST',
        p: '/subscriptions/:id/cancel',
        scope: 'subscriptions:write',
        d: 'Cancela (policy: immediate ou end_of_cycle; padrão = a do produto).',
        body: { policy: 'end_of_cycle', reason: 'Pedido do cliente' }
      },
      { m: 'POST', p: '/subscriptions/:id/pause', scope: 'subscriptions:write', d: 'Pausa até uma data.', body: { until: '2026-12-01' } },
      { m: 'POST', p: '/subscriptions/:id/resume', scope: 'subscriptions:write', d: 'Retoma uma assinatura pausada.' },
      {
        m: 'POST',
        p: '/subscriptions/:id/change-plan',
        scope: 'subscriptions:write',
        d: 'Troca de plano (com crédito proporcional quando há).',
        body: { product_id: 'uuid-do-novo-produto' }
      }
    ]
  },
  {
    title: 'Cobranças',
    items: [
      { m: 'GET', p: '/charges?customer_id=:id&status=pending', scope: 'charges:read', d: 'Lista as cobranças (PIX, boleto, cartão).' },
      { m: 'GET', p: '/charges/:id', scope: 'charges:read', d: 'Uma cobrança com PIX copia e cola, linha do boleto e link.' },
      {
        m: 'POST',
        p: '/charges',
        scope: 'charges:write',
        d: 'Cria uma cobrança avulsa (send:true manda pelo WhatsApp).',
        body: { customer_id: 'uuid-do-cliente', amount_cents: 9900, description: 'Consulta', due_at: '2026-10-20', kind: 'pix', send: true }
      },
      {
        m: 'POST',
        p: '/charges/:id/resend',
        scope: 'charges:write',
        d: 'Reenvia a cobrança no WhatsApp (kind: pix, boleto ou card).',
        body: { kind: 'pix' }
      },
      { m: 'POST', p: '/charges/:id/cancel', scope: 'charges:write', d: 'Cancela a cobrança.' }
    ]
  },
  {
    title: 'Mensagens e contatos',
    items: [
      {
        m: 'POST',
        p: '/messages',
        scope: 'messages:send',
        d: 'Põe a mensagem na fila (respeita o ritmo do número). Resposta: { id, status: "queued" }. Contato que pediu para sair → 409 OPTED_OUT.',
        body: { to: '5511999998888', text: 'Olá! Seu pedido foi aprovado.' }
      },
      { m: 'GET', p: '/messages/:id', scope: 'messages:send', d: 'Situação da mensagem na fila (queued, sent, failed).' },
      {
        m: 'POST',
        p: '/contacts/opt-out',
        scope: 'contacts:write',
        d: 'Descadastra (ou reativa) um contato dos disparos — LGPD.',
        body: { phone: '5511999998888', opted_out: true }
      }
    ]
  },
  {
    title: 'Acessos liberados',
    items: [
      {
        m: 'GET',
        p: '/entitlements?customer_id=:id',
        scope: 'entitlements:read',
        d: 'O que cada assinatura libera (grupo, etiqueta, arquivo, integração) e a situação (active, suspended, revoked, failed).'
      }
    ]
  }
];

const WEBHOOK_EXAMPLE = JSON.stringify(
  {
    id: '6f1c2a9e-0b7d-4c1e-9a55-2f3e8d1b7c40',
    event: 'subscription.paid',
    created_at: '2026-10-13T14:05:12.000Z',
    organization_id: 'uuid-da-sua-organizacao',
    data: {
      id: 'uuid-da-assinatura',
      customer_id: 'uuid-do-cliente',
      product_name: 'Plano Premium',
      price_cents: 9900,
      status: 'active',
      next_due_at: '2026-11-10'
    }
  },
  null,
  2
);

const VERIFY_NODE = `const crypto = require('crypto');
const express = require('express');
const app = express();

// use o corpo CRU (bytes exatos que o Pub Mail enviou) para conferir a assinatura
app.post('/webhooks/pubmail', express.raw({ type: 'application/json' }), (req, res) => {
  const ts = req.get('X-PubMail-Timestamp');
  const sig = req.get('X-PubMail-Signature') || ''; // "sha256=<hex>"
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.PUBMAIL_WEBHOOK_SECRET)
    .update(ts + '.' + req.body)
    .digest('hex');
  const ok = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  const fresh = Math.abs(Date.now() / 1000 - Number(ts)) < 300; // recusa reenvios com mais de 5 min
  if (!ok || !fresh) return res.status(401).end();

  const evt = JSON.parse(req.body);
  // evt.id (= X-PubMail-Delivery) se repete numa nova tentativa: guarde e ignore duplicados
  console.log(evt.event, evt.data);
  res.status(200).end(); // responda 2xx em até 10 s (processe o resto em segundo plano)
});`;

const HEADERS = [
  ['Content-Type', 'application/json'],
  ['User-Agent', 'PubMail-Webhooks/1.0'],
  ['X-PubMail-Event', 'nome do evento (ex.: charge.paid)'],
  ['X-PubMail-Delivery', 'id da entrega — use para não processar duas vezes'],
  ['X-PubMail-Timestamp', 'segundos desde 1970 (unix)'],
  ['X-PubMail-Signature', 'sha256=<hex do HMAC-SHA256(segredo, "<timestamp>.<corpo>")>']
];

function H({ children }) {
  return (
    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
      {children}
    </Typography>
  );
}

function Endpoint({ it }) {
  return (
    <CollapsibleSection
      title={
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }} component="span">
          <Chip
            component="span"
            size="small"
            label={it.m}
            color={METHOD_COLOR[it.m] || 'default'}
            sx={{ height: 20, fontSize: 11, fontWeight: 800, borderRadius: 1, minWidth: 52 }}
          />
          <Box component="span" sx={{ ...monoSx, fontSize: 13, minWidth: 0, overflowWrap: 'anywhere' }}>
            {it.p}
          </Box>
        </Stack>
      }
      summary={`${it.d} · escopo ${it.scope}`}
    >
      <Stack spacing={1}>
        <Typography variant="body2">{it.d}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Escopo exigido:{' '}
          <Box component="span" sx={{ ...monoSx, fontWeight: 700 }}>
            {it.scope}
          </Box>
        </Typography>
        <CodeBlock code={curl(it.m, it.p, it.body)} />
      </Stack>
    </CollapsibleSection>
  );
}

export default function ApiDocsTab() {
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 960 }}>
      <TgCard hover={false} sx={{ p: 2, minWidth: 0 }}>
        <H>Como chamar</H>
        <Stack spacing={1.25}>
          <Typography variant="body2">
            Endereço base (todas as rotas abaixo começam aqui). Crie uma chave em <strong>Chaves de API</strong> com as permissões que o seu
            sistema precisa e mande em todo pedido:
          </Typography>
          <CodeBlock code={API_BASE} maxHeight={60} />
          <CodeBlock code={`Authorization: Bearer ${KEY}\n# ou\nX-Api-Key: ${KEY}`} maxHeight={120} />
          <Typography variant="body2" component="div">
            Respostas em JSON. Erros: <code>{'{ statusCode, message, code? }'}</code>.
            <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
              <li>
                <strong>401</strong> — chave errada ou revogada.
              </li>
              <li>
                <strong>402</strong> <code>PAYMENT_REQUIRED</code> — a assinatura do Pub Mail da sua empresa está vencida.
              </li>
              <li>
                <strong>403</strong> <code>SCOPE_MISSING</code> — a chave não tem a permissão da rota (vem em <code>scope</code>).
              </li>
              <li>
                <strong>429</strong> — mais de 600 pedidos por minuto na mesma chave.
              </li>
            </Box>
          </Typography>
        </Stack>
      </TgCard>

      {SECTIONS.map((s) => (
        <Box key={s.title}>
          <H>{s.title}</H>
          <Stack spacing={0.75}>
            {s.items.map((it) => (
              <Endpoint key={`${it.m} ${it.p}`} it={it} />
            ))}
          </Stack>
        </Box>
      ))}

      <TgCard hover={false} sx={{ p: 2, minWidth: 0 }}>
        <H>Webhooks: o que chega no seu sistema</H>
        <Stack spacing={1.5}>
          <Typography variant="body2">
            Um <code>POST</code> no endereço cadastrado em <strong>Webhooks</strong>, com este corpo (<code>data</code> tem o mesmo formato
            das rotas de leitura acima):
          </Typography>
          <CodeBlock code={WEBHOOK_EXAMPLE} />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Cabeçalhos
          </Typography>
          <Stack spacing={0.5}>
            {HEADERS.map(([k, v]) => (
              <Stack key={k} direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0, sm: 1.5 }} sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ ...monoSx, fontWeight: 700, minWidth: { sm: 190 }, flexShrink: 0 }}>
                  {k}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
                  {v}
                </Typography>
              </Stack>
            ))}
          </Stack>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Conferir a assinatura (Node.js)
          </Typography>
          <CodeBlock code={VERIFY_NODE} maxHeight={480} />
          <Typography variant="body2" component="div">
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              <li>Responda 2xx em até 10 segundos. Outro código, erro ou demora = nova tentativa em 1 min, 5 min, 30 min, 2 h e 6 h.</li>
              <li>A mesma entrega pode chegar mais de uma vez: use o id para ignorar repetidas.</li>
              <li>
                Com 100 tentativas seguidas falhando, ou 24 h sem nenhuma entrega certa, o webhook é desativado (reative na lista e use
                Reenviar nas entregas). Um endereço lento ou fora do ar é pausado alguns minutos sem atrapalhar os outros.
              </li>
            </Box>
          </Typography>
        </Stack>
      </TgCard>

      <TgCard hover={false} sx={{ p: 2, minWidth: 0 }}>
        <H>Eventos</H>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
          {EVENT_GROUPS.map((g) => (
            <Box key={g.label} sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5 }}>
                {g.label}
              </Typography>
              {g.events.map((e) => (
                <Typography key={e.value} variant="body2" sx={{ color: 'text.secondary' }}>
                  <Box component="span" sx={{ ...monoSx, color: 'text.primary', fontSize: 12.5 }}>
                    {e.value}
                  </Box>{' '}
                  — {e.label.toLowerCase()}
                </Typography>
              ))}
            </Box>
          ))}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5 }}>
              Mensagens
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ ...monoSx, color: 'text.primary', fontSize: 12.5 }}>
                {MESSAGE_EVENT}
              </Box>{' '}
              — texto recebido numa conversa individual. Fora do “Todos”: marque à parte.
            </Typography>
          </Box>
        </Box>
      </TgCard>
    </Stack>
  );
}
