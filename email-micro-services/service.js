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

async function sendWebhook(dispatchId, status, sentCount) {
    try {
        const url = `${process.env.NEST_WEBHOOK_URL}/schedule-sent/${dispatchId}`;
        await axios.post(
            url,
            { status, sent_for_leads: sentCount },
            { headers: { 'x-api-key': process.env.EMAIL_SERVICE_KEY } }
        );
        console.log(`[Webhook] ${status} - ${sentCount} e-mails atualizados no NestJS.`);
    } catch (error) {
        console.error(`Erro ao enviar webhook para ${dispatchId}:`, error?.message);
    }
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

    const leadsArray = leads.sample || [];
    const totalLeads = leads.count || leadsArray.length;

    if (totalLeads === 0) {
        console.log(`Dispatch ${dispatchId} não tem leads. Ignorando.`);
        return;
    }

    const compiledHtml = Handlebars.compile(template.body_html || '');
    const compiledSubject = Handlebars.compile(template.subject || '');

    const senderConfig = project.settings.sender;
    const fromFormatted = `${senderConfig.fromName} <${senderConfig.fromEmail}>`;
    const baseUrl = process.env.BASE_URL_API || '';

    console.log(`⏳ Iniciando disparo BATCH: ${dispatchId} | Total: ${totalLeads} leads`);

    // ✅ Tamanho máximo do lote permitido pela Resend é 100
    const CHUNK_SIZE = 100;
    let sentCount = 0;

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
            };
        });

        try {
            // ✅ Usa a BATCH API enviando até 100 e-mails de uma vez
            const { data, error } = await resend.batch.send(batchPayload);

            if (error) {
                console.error(`❌ Erro no lote (índice ${i}):`, error.message);
            } else {
                // Incrementa a quantidade de e-mails do lote que foi enviado
                sentCount += chunk.length;
                console.log(`🚀 Lote enviado! Total acumulado: ${sentCount}/${totalLeads}`);
            }

            // Atualiza o webhook no meio do caminho a cada lote disparado
            await sendWebhook(dispatchId, 'PROCESSING', sentCount);

        } catch (error) {
            console.error(`❌ Falha catastrófica ao enviar lote:`, error.message);
        }

        // ✅ Espera 550ms entre OS LOTES para não tomar Block de 429 da Resend (Máx 2 req/s)
        await new Promise(resolve => setTimeout(resolve, 550));
    }

    await sendWebhook(dispatchId, 'COMPLETED', sentCount);
    console.log(`✅ Disparo BATCH concluído: ${dispatchId}`);

}, { connection: redisConnection });

export async function enqueueEmailJob(payload) {
    await emailQueue.add('dispatch', payload);
}
