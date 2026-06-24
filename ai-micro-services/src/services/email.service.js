import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

export const generateEmailTemplate = async (userPrompt, apiKeys) => {
    if (!Array.isArray(apiKeys) || apiKeys.length === 0) {
        throw new Error("ERRO CRÍTICO: nenhuma chave da Groq recebida pelo backend.");
    }

    // 👇 PROMPT FINAL: CTA DE ALTA CURIOSIDADE COM TRACKING DE CLIQUE
    const systemInstruction = `Você é um Copywriter Especialista em Deliverability focado em e-mails informativos para a Caixa Principal. Seu forte é criar CTAs de ALTA CURIOSIDADE.

A REGRA DE OURO DA SUA IDENTIDADE:
Somos um PORTAL DE INFORMAÇÃO/CURADORIA. Não somos a instituição. Nunca fale como se fosse aprovar crédito ou vender o serviço final.

ESTRUTURA OBRIGATÓRIA A SEGUIR:
<h1>[Saudação local] {{name}}</h1>
<p>[Uma frase introdutória curta e provocativa sobre o assunto]</p>
<br>
<a href='{{base_webhook_cta_click}}?redirectUrl=SEU_LINK_AQUI' style='background:#000000; color:#ffffff; padding:10px 15px; text-decoration:none; font-weight:bold;'>[Texto do Botão Baseado em Curiosidade]</a>
<br><br><br>
[Texto informativo solto aqui. Frase 1 e Frase 2 no máximo.]
<br><br>
[Continuação do texto solto aqui. Frase 3 e Frase 4 no máximo.]
<br><br><br><br><br><br>
{{open_email_pixel}}
<a href='{{unsubscribe_link}}' style='font-size:12px; color:#666666;'>[Texto local para cancelar inscrição]</a>

REGRAS ESTRITAS DE HTML:
1. PROIBIDO TAGS SEMÂNTICAS: NUNCA use <!DOCTYPE html>, <html>, <head>, <body>, <table> ou <div>.
2. TEXTO SOLTO E CURTO: Corpo principal SEM <p>. O <p> vai APENAS na frase introdutória.
3. ASPAS SIMPLES: Use EXCLUSIVAMENTE aspas simples (') nos atributos.
4. ZERO IMAGENS: Nenhuma tag <img> extra.
5. RASTREAMENTO DO CTA (CRÍTICO): O atributo href do botão CTA deve OBRIGATORIAMENTE conter a tag de rastreamento no formato '{{base_webhook_cta_click}}?redirectUrl='. Se o usuário forneceu um link no prompt, coloque-o após o '=', caso contrário use 'SEU_LINK_AQUI'.

REGRAS DE COPYWRITING E BOTÃO (CTA) ATRAENTE:
1. O CTA DEVE SER CURIOSO E IRRESISTÍVEL: Proibido usar CTAs acadêmicos e chatos (NUNCA use "Ler artigo", "Ler texto", "Ver post").
2. FOCO NA DESCOBERTA: Use verbos que incitam curiosidade sobre a informação. 
   - EXEMPLOS BONS PARA O CTA: "Ver a lista completa", "Descobrir as opções de hoje", "Acessar o mapa completo", "Revelar as opções", "Ver como evitar juros", "Conhecer o método".
3. PROIBIDO VERBOS TRANSACIONAIS: NUNCA use "Solicitar", "Comprar", "Assinar", "Aprovar", "Contratar".
4. ZERO PROMESSAS: Não faça promessas financeiras ou de garantias no texto. Apenas apresente que existe uma informação valiosa a ser descoberta.
5. PARÁGRAFOS CURTOS: Quebre o texto com <br><br> a cada 1 ou 2 frases curtas. 
6. ANTI-PROMOÇÕES: Não use "Nós da empresa". Evite "Promoção", "Oferta", "Desconto".

FORMATO DE SAÍDA OBRIGATÓRIO EM JSON:
{
  "subject": "Assunto curto focando em curiosidade (Ex: 'A lista que você pediu', 'Sobre aquelas opções')",
  "html": "<h1>...estrutura rústica e espaçada baseada no molde...</h1>"
}`;

    let lastError = null;

    // 👇 LOOP DE RODÍZIO (FALLBACK)
    for (let i = 0; i < apiKeys.length; i++) {
        const currentKey = apiKeys[i];
        const groq = new Groq({ apiKey: currentKey });

        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: userPrompt }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.3,
                response_format: { type: "json_object" }
            });

            let jsonString = chatCompletion.choices[0]?.message?.content || "{}";
            jsonString = jsonString.replace(/[\u200B-\u200D\uFEFF]/g, '');

            // Se a requisição deu certo, retorna o resultado e sai imediatamente do loop e da função
            return JSON.parse(jsonString);

        } catch (error) {
            lastError = error;
            // Avisa no console do servidor qual chave falhou, mas não quebra a aplicação
            console.warn(`[Aviso Groq] Falha ao usar a chave ${i + 1} de ${apiKeys.length}. Motivo: ${error.message}`);

            // Se for a última chave do array, o loop vai terminar e estourar o erro final logo abaixo
            if (i === apiKeys.length - 1) {
                console.error('❌ Todas as chaves de API da Groq esgotaram ou falharam.');
            }
        }
    }

    // 👇 Se chegou aqui, é porque nenhuma chave do rodízio funcionou
    throw new Error('Falha ao gerar o template de e-mail com a IA após tentar todas as chaves: ' + lastError.message);
};