import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { Resend } from 'resend';
import axios from 'axios';
import Handlebars from 'handlebars';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const redisConnection = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    maxRetriesPerRequest: null,
});

const emailQueue = new Queue('email-dispatch', { connection: redisConnection });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Assinatura das URLs de rastreio (pixel + clique). Mesmo esquema do back
// (back/src/common/tracking-sign.util.ts): HMAC-SHA256(`${sentId}|${email}`)
// em hex truncado a 32 chars, chave = TRACKING_SIGN_SECRET (ou JWT_ACCESS_SECRET,
// que PRECISA ser o mesmo valor do back). Sem chave o e-mail sai sem assinatura
// e o back rejeita o rastreio dos envios feitos após o cutoff.
// ---------------------------------------------------------------------------
const TRACKING_SECRET = String(
    process.env.TRACKING_SIGN_SECRET || process.env.JWT_ACCESS_SECRET || '',
).trim();
if (!TRACKING_SECRET) {
    console.warn(
        '⚠️  TRACKING_SIGN_SECRET/JWT_ACCESS_SECRET não definido: as URLs de pixel/clique sairão SEM assinatura e o rastreio será rejeitado pelo back.',
    );
}
function signTracking(sentId, email) {
    if (!TRACKING_SECRET) return '';
    const key = String(email ?? '').trim().toLowerCase();
    return crypto
        .createHmac('sha256', TRACKING_SECRET)
        .update(`${String(sentId)}|${key}`)
        .digest('hex')
        .slice(0, 32);
}

// Callback pro NestJS com retry (3 tentativas, backoff 0/2s/5s). Devolve
// true se algum POST deu certo. Nunca lança.
async function sendWebhook(dispatchId, status, sentCount, extra = {}) {
    const url = `${process.env.NEST_WEBHOOK_URL}/schedule-sent/${dispatchId}`;
    const body = { status, sent_for_leads: sentCount, ...extra };
    const delays = [0, 2000, 5000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt]) await sleep(delays[attempt]);
        try {
            await axios.post(url, body, {
                headers: { 'x-api-key': process.env.EMAIL_SERVICE_KEY },
                timeout: 10000,
            });
            console.log(`[Webhook] ${status} - ${sentCount} e-mails atualizados no NestJS.`);
            return true;
        } catch (error) {
            console.error(
                `Erro ao enviar webhook ${status} para ${dispatchId} (tentativa ${attempt + 1}/${delays.length}):`,
                error?.message,
            );
        }
    }
    return false;
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

// Progresso persistido no job (checkpoint por lote). Na retomada após crash/
// deploy o worker continua do `nextIndex` em vez de reenviar tudo.
function readProgress(job) {
    const p = job && job.progress && typeof job.progress === 'object' ? job.progress : {};
    return {
        nextIndex: Math.max(0, Number(p.nextIndex) || 0),
        sentCount: Math.max(0, Number(p.sentCount) || 0),
        failedCount: Math.max(0, Number(p.failedCount) || 0),
    };
}

const worker = new Worker('email-dispatch', async (job) => {
    const { dispatchId, project, template, leads, resend_api_key } = job.data;

    if (!resend_api_key || typeof resend_api_key !== 'string' || !resend_api_key.trim()) {
        const message = `Dispatch ${dispatchId} sem resend_api_key. Configure em Conta & Domínios > Integrações.`;
        console.error(`❌ ${message}`);
        await sendWebhook(dispatchId, 'FAILED', 0, { error_message: message });
        throw new Error(message);
    }

    // Remetente validado LOGO NO INÍCIO: antes, `sender` undefined estourava fora
    // do try → o job falhava 3x sem nunca avisar o back (ficava PROCESSING).
    const senderConfig = project && project.settings ? project.settings.sender : null;
    if (!senderConfig || !senderConfig.fromEmail || !senderConfig.fromName) {
        const message = 'Remetente do projeto não configurado (fromName/fromEmail). Configure em Projetos > Remetente.';
        console.error(`❌ Dispatch ${dispatchId}: ${message}`);
        await sendWebhook(dispatchId, 'FAILED', 0, { error_message: message });
        return;
    }

    const resend = new Resend(resend_api_key.trim());

    const rawLeadsArray = (leads && leads.sample) || [];

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

    // Compilação do Handlebars DENTRO de try: template inválido = FAILED
    // reportado, não job travado.
    let compiledHtml;
    let compiledSubject;
    try {
        compiledHtml = Handlebars.compile((template && template.body_html) || '');
        compiledSubject = Handlebars.compile((template && template.subject) || '');
    } catch (e) {
        const message = `Template inválido (Handlebars): ${e?.message || e}`;
        console.error(`❌ Dispatch ${dispatchId}: ${message}`);
        await sendWebhook(dispatchId, 'FAILED', 0, { error_message: message.slice(0, 255) });
        return;
    }

    // From name por template (fallback: o cadastrado no projeto).
    const effectiveFromName =
        (template && typeof template.from_name === 'string' && template.from_name.trim())
            ? template.from_name.trim()
            : senderConfig.fromName;
    const fromFormatted = `${effectiveFromName} <${senderConfig.fromEmail}>`;
    const baseUrl = process.env.BASE_URL_API || '';

    // Retomada: se o job já rodou parte dos lotes (crash/deploy no meio),
    // continua de onde parou.
    const progress = readProgress(job);
    let sentCount = progress.sentCount;
    let failedCount = progress.failedCount;
    const startIndex = progress.nextIndex;
    if (startIndex > 0) {
        console.log(`↩️  Dispatch ${dispatchId}: retomando do índice ${startIndex} (já enviados=${sentCount}).`);
    }

    console.log(`⏳ Iniciando disparo BATCH: ${dispatchId} | Total: ${totalLeads} leads`);

    // ✅ Tamanho máximo do lote permitido pela Resend é 100
    const CHUNK_SIZE = 100;
    let firstError = null;

    // Monta o e-mail de UM lead (pixel assinado, base do CTA assinada,
    // headers de descadastro one-click). Lança se o Handlebars falhar no render.
    const buildEmail = (lead) => {
        const email = String(lead.email).trim();
        const sig = signTracking(dispatchId, email);
        const encEmail = encodeURIComponent(email);

        // 1. Rastreamento de Abertura (Pixel) — `?s=<assinatura>`
        const pixelUrl =
            `${baseUrl}/webhooks/email/schedule-sent/open-pixel/${project.id}/${dispatchId}/${encEmail}` +
            (sig ? `?s=${sig}` : '');
        const pixelImg = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none;text-decoration:none;" />`;

        // 2. Rastreamento de Clique no CTA (URL Base). A assinatura vai no PATH
        // (último segmento) porque o template concatena `?redirectUrl=` depois.
        const ctaClickBaseUrl =
            `${baseUrl}/webhooks/email/cta-click/${project.id}/${dispatchId}/${encEmail}` +
            (sig ? `/${sig}` : '');

        // 3. Descadastro one-click (RFC 8058) — os provedores fazem POST aqui.
        const oneClickUrl = `${baseUrl}/email/leads/unsubscribe-oneclick/${project.id}/${encEmail}`;

        // Injeta as variáveis no template do Handlebars
        const viewData = {
            name: lead.name,
            email: lead.email,
            ...(lead.attributes || {}),
            open_email_pixel: new Handlebars.SafeString(pixelImg),
            base_webhook_cta_click: ctaClickBaseUrl, // Handlebars vai substituir {{base_webhook_cta_click}} por isso aqui!
        };

        return {
            from: fromFormatted,
            to: lead.email,
            subject: compiledSubject(viewData),
            html: compiledHtml(viewData),
            reply_to: senderConfig.reply_to,
            headers: {
                'List-Unsubscribe': `<${oneClickUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
            // Marca o e-mail com o dispatchId — os webhooks do Resend
            // (entrega/bounce/reclamação) devolvem essa tag, permitindo
            // atribuir o evento ao disparo correto no NestJS.
            tags: [{ name: 'dispatch_id', value: String(dispatchId) }],
        };
    };

    // Fatiando o array de leads de 100 em 100
    for (let i = startIndex; i < leadsArray.length; i += CHUNK_SIZE) {
        const chunk = leadsArray.slice(i, i + CHUNK_SIZE);
        const batchIndex = Math.floor(i / CHUNK_SIZE);

        try {
            // Render por lead dentro do try: um HTML que quebra no Handlebars
            // (helper inexistente etc.) conta como falha daquele lead, não do job.
            const batchPayload = [];
            for (const lead of chunk) {
                try {
                    batchPayload.push(buildEmail(lead));
                } catch (e) {
                    failedCount++;
                    if (!firstError) firstError = `Render do template falhou: ${e?.message || e}`;
                    console.error(`  ✗ ${lead && lead.email}: render falhou: ${e?.message}`);
                }
            }

            if (batchPayload.length > 0) {
                // ✅ BATCH API (até 100 por chamada) com chave de idempotência por
                // lote: se o job for retomado e o lote já tiver ido, a Resend não
                // reenvia (resend ^6.9.2: batch.send(payload, { idempotencyKey })).
                const { error } = await resend.batch.send(batchPayload, {
                    idempotencyKey: `${dispatchId}-${batchIndex}`,
                });

                if (error) {
                    // A Resend rejeita o LOTE INTEIRO se UM item for problemático.
                    // Fallback: reenvia um a um pra não perder os bons por causa de um ruim.
                    console.error(`❌ Erro no lote (índice ${i}): ${error.message}. Reprocessando individualmente...`);
                    if (!firstError) firstError = error.message;
                    for (let j = 0; j < batchPayload.length; j++) {
                        const single = batchPayload[j];
                        try {
                            const r = await resend.emails.send(single, {
                                idempotencyKey: `${dispatchId}-${batchIndex}-${j}`,
                            });
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
                        await sleep(550);
                    }
                } else {
                    // Incrementa a quantidade de e-mails do lote que foi enviado
                    sentCount += batchPayload.length;
                    console.log(`🚀 Lote enviado! Total acumulado: ${sentCount}/${totalLeads}`);
                }
            }

            // Checkpoint: próximo índice + contadores (retomada sem reenvio)
            try {
                await job.updateProgress({ nextIndex: i + CHUNK_SIZE, sentCount, failedCount, invalidCount });
            } catch (e) {
                console.warn(`Não foi possível gravar o checkpoint do job ${dispatchId}: ${e?.message}`);
            }

            // Atualiza o webhook no meio do caminho a cada lote disparado
            await sendWebhook(dispatchId, 'PROCESSING', sentCount);

        } catch (error) {
            console.error(`❌ Falha catastrófica ao enviar lote:`, error.message);
            if (!firstError) firstError = error?.message || String(error);
        }

        // ✅ Espera 550ms entre OS LOTES para não tomar Block de 429 da Resend (Máx 2 req/s)
        await sleep(550);
    }

    // Reporta o resultado final + diagnóstico (invalidos/falhas/erro) pro back
    // conseguir mostrar o motivo na tela.
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

// Job que ESGOTOU as tentativas: garante o callback FAILED (antes ficava
// PROCESSING pra sempre). O sent_for_leads leva o que já saiu (checkpoint).
worker.on('failed', (job, err) => {
    if (!job || !job.data || !job.data.dispatchId) return;
    const attempts = Number(job.opts && job.opts.attempts) || 1;
    if (job.attemptsMade < attempts) return; // ainda vai re-tentar
    const progress = readProgress(job);
    const message = String(err?.message || err || 'Job falhou').slice(0, 255);
    console.error(`💀 Job ${job.data.dispatchId} esgotou as ${attempts} tentativas: ${message}`);
    sendWebhook(job.data.dispatchId, 'FAILED', progress.sentCount, {
        failed_count: progress.failedCount,
        error_message: message,
    }).catch(() => { });
});

worker.on('error', (err) => {
    console.error('Worker error:', err?.message || err);
});

export async function enqueueEmailJob(payload) {
    await emailQueue.add('dispatch', payload, {
        // Retry resiliente. O worker trata erro POR LOTE internamente e grava
        // checkpoint (job.progress) após cada lote — uma re-tentativa retoma do
        // próximo lote, e a idempotencyKey por lote evita duplicar na Resend.
        attempts: 3,
        backoff: { type: 'exponential', delay: 15000 },
        // Não reter jobs pra sempre no Redis (evita crescimento de memória sob
        // tráfego pesado). Mantém as últimas p/ inspeção.
        removeOnComplete: 200,
        removeOnFail: 1000,
    });
}
