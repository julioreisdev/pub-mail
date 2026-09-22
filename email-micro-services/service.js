import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { Resend } from 'resend';
import axios from 'axios';
import Handlebars from 'handlebars';
import dotenv from 'dotenv';

dotenv.config();

const redisConnection = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    maxRetriesPerRequest: null,
});

const emailQueue = new Queue('email-dispatch', { connection: redisConnection });

async function sendWebhook(dispatchId, status, sentCount, extra = {}) {
    try {
        const url = `${process.env.NEST_WEBHOOK_URL}/schedule-sent/${dispatchId}`;
        await axios.post(
            url,
            { status, sent_for_leads: sentCount, ...extra },
            { headers: { 'x-api-key': process.env.EMAIL_SERVICE_KEY } }
        );
        console.log(`[Webhook] ${status} - ${sentCount} e-mails atualizados no NestJS.`);
    } catch (error) {
        console.error(`Erro ao enviar webhook para ${dispatchId}:`, error?.message);
    }
}

// Validador ESTRITO (mesma lógica do back em common/email.util) — defesa em
// profundidade: mesmo que um e-mail ruim escape do back, ele NÃO vai pro lote
// da Resend (que rejeita o lote inteiro se um único `to` for inválido).
const MICRO_EMAIL_RE =
    /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?)+$/;
function microIsValidEmail(raw) {
    const e = String(raw ?? '').trim().toLowerCase();
    if (!e || e.length > 254 || e.includes('..')) return false;
    if (!MICRO_EMAIL_RE.test(e)) return false;
    const at = e.indexOf('@');
    const local = e.slice(0, at);
    if (local.startsWith('.') || local.endsWith('.')) return false;
    const tld = e.slice(e.lastIndexOf('.') + 1);
    return tld.length >= 2;
}

const worker = new Worker('email-dispatch', async (job) => {
    const { dispatchId, project, template, leads, resend_api_key } = job.data;

    if (!resend_api_key || typeof resend_api_key !== 'string' || !resend_api_key.trim()) {
        const message = `Dispatch ${dispatchId} sem resend_api_key. Configure em Conta & Domínios > Integrações.`;
        console.error(`❌ ${message}`);
        await sendWebhook(dispatchId, 'FAILED', 0);
        throw new Error(message);
    }

    const resend = new Resend(resend_api_key.trim());

    const rawLeadsArray = leads.sample || [];

    // Pré-filtra e-mails inválidos ANTES de montar o lote — um único `to` ruim
    // faz a Resend rejeitar o lote INTEIRO (era a causa do "0/46").
    const leadsArray = rawLeadsArray.filter((l) => microIsValidEmail(l && l.email));
    const invalidCount = rawLeadsArray.length - leadsArray.length;
    if (invalidCount > 0) {
        console.warn(`⚠️ Dispatch ${dispatchId}: ${invalidCount} lead(s) com e-mail inválido ignorado(s).`);
    }
    const totalLeads = leadsArray.length;

    if (totalLeads === 0) {
        const message = invalidCount > 0
            ? `Nenhum e-mail válido (${invalidCount} inválido(s)).`
            : 'Nenhum lead para enviar.';
        console.log(`Dispatch ${dispatchId}: ${message}`);
        await sendWebhook(dispatchId, 'COMPLETED', 0, { invalid_count: invalidCount, error_message: message });
        return;
    }

    const compiledHtml = Handlebars.compile(template.body_html || '');
    const compiledSubject = Handlebars.compile(template.subject || '');

    const senderConfig = project.settings.sender;
    // From name por template (fallback: o cadastrado no projeto).
    const effectiveFromName =
        (template && typeof template.from_name === 'string' && template.from_name.trim())
            ? template.from_name.trim()
            : senderConfig.fromName;
    const fromFormatted = `${effectiveFromName} <${senderConfig.fromEmail}>`;
    const baseUrl = process.env.BASE_URL_API || '';

    console.log(`⏳ Iniciando disparo BATCH: ${dispatchId} | Total: ${totalLeads} leads`);

    // ✅ Tamanho máximo do lote permitido pela Resend é 100
    const CHUNK_SIZE = 100;
    let sentCount = 0;
    let failedCount = 0;
    let firstError = null;

    // Fatiando o array de leads de 100 em 100
    for (let i = 0; i < leadsArray.length; i += CHUNK_SIZE) {
        const chunk = leadsArray.slice(i, i + CHUNK_SIZE);

        // Mapeia os 100 leads gerando os HTMLs exclusivos, o Pixel e o Tracking de CTA de cada um
        const batchPayload = chunk.map(lead => {
            // 1. Rastreamento de Abertura (Pixel)
            const pixelUrl = `${baseUrl}/webhooks/email/schedule-sent/open-pixel/${project.id}/${dispatchId}/${lead.email}`;
            const pixelImg = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none;text-decoration:none;" />`;

            // 2. Rastreamento de Clique no CTA (URL Base)
            const ctaClickBaseUrl = `${baseUrl}/webhooks/email/cta-click/${project.id}/${dispatchId}/${lead.email}`;

            // Injeta as variáveis no template do Handlebars
            const viewData = {
                name: lead.name,
                email: lead.email,
                ...(lead.attributes || {}),
                open_email_pixel: new Handlebars.SafeString(pixelImg),
                base_webhook_cta_click: ctaClickBaseUrl // Handlebars vai substituir {{base_webhook_cta_click}} por isso aqui!
            };

            return {
                from: fromFormatted,
                to: lead.email,
                subject: compiledSubject(viewData),
                html: compiledHtml(viewData),
                reply_to: senderConfig.reply_to,
                // Marca o e-mail com o dispatchId — os webhooks do Resend
                // (entrega/bounce/reclamação) devolvem essa tag, permitindo
                // atribuir o evento ao disparo correto no NestJS.
                tags: [{ name: 'dispatch_id', value: String(dispatchId) }],
            };
        });

        try {
            // ✅ Usa a BATCH API enviando até 100 e-mails de uma vez
            const { data, error } = await resend.batch.send(batchPayload);

            if (error) {
                // A Resend rejeita o LOTE INTEIRO se UM item for problemático.
                // Fallback: reenvia um a um pra não perder os bons por causa de um ruim.
                console.error(`❌ Erro no lote (índice ${i}): ${error.message}. Reprocessando individualmente...`);
                if (!firstError) firstError = error.message;
                for (const single of batchPayload) {
                    try {
                        const r = await resend.emails.send(single);
                        if (r && r.error) {
                            failedCount++;
                            if (!firstError) firstError = r.error.message;
                            console.error(`  ✗ ${single.to}: ${r.error.message}`);
                        } else {
                            sentCount++;
                        }
                    } catch (e) {
                        failedCount++;
                        if (!firstError) firstError = e?.message || String(e);
                        console.error(`  ✗ ${single.to}: ${e?.message}`);
                    }
                    // respeita o rate-limit também no reenvio individual
                    await new Promise(resolve => setTimeout(resolve, 550));
                }
            } else {
                // Incrementa a quantidade de e-mails do lote que foi enviado
                sentCount += chunk.length;
                console.log(`🚀 Lote enviado! Total acumulado: ${sentCount}/${totalLeads}`);
            }

            // Atualiza o webhook no meio do caminho a cada lote disparado
            await sendWebhook(dispatchId, 'PROCESSING', sentCount);

        } catch (error) {
            console.error(`❌ Falha catastrófica ao enviar lote:`, error.message);
            if (!firstError) firstError = error?.message || String(error);
        }

        // ✅ Espera 550ms entre OS LOTES para não tomar Block de 429 da Resend (Máx 2 req/s)
        await new Promise(resolve => setTimeout(resolve, 550));
    }

    // Reporta o resultado final + diagnóstico (invalidos/falhas/erro) pro back
    // conseguir mostrar o motivo na tela e estornar token se 0 saiu.
    await sendWebhook(dispatchId, 'COMPLETED', sentCount, {
        invalid_count: invalidCount,
        failed_count: failedCount,
        error_message: sentCount === 0 ? (firstError || 'Nenhum e-mail enviado.') : (firstError || null),
    });
    console.log(`✅ Disparo BATCH concluído: ${dispatchId} | enviados=${sentCount} inválidos=${invalidCount} falhas=${failedCount}`);

}, {
    connection: redisConnection,
    // concurrency=1 de propósito: o rate-limit da Resend (550ms entre lotes) é
    // global; rodar jobs em paralelo estouraria o limite (429). Mantém serial.
    concurrency: 1,
});

export async function enqueueEmailJob(payload) {
    await emailQueue.add('dispatch', payload, {
        // Retry resiliente. O worker trata erro POR LOTE internamente (não relança
        // após envio parcial), então re-tentar só ocorre em falha ANTES de enviar
        // (ex.: sem api key) — seguro, sem risco de e-mail duplicado.
        attempts: 3,
        backoff: { type: 'exponential', delay: 15000 },
        // Não reter jobs pra sempre no Redis (evita crescimento de memória sob
        // tráfego pesado). Mantém as últimas p/ inspeção.
        removeOnComplete: 200,
        removeOnFail: 1000,
    });
}
