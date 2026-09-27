// ============================================================================
// Encoda o destino dos CTAs rastreados (`{{base_webhook_cta_click}}?redirectUrl=`)
// antes de salvar HTML de e-mail. Sem isso, uma URL com UTMs (`?a=1&b=2`) é
// truncada no `&` pelo parser de query no clique. Fonte única — usada por
// templates, passos do fluxo inicial e reciclagem (auditoria A-63).
// ============================================================================
export function encodeWebhookUrls(html: string): string {
  if (!html) return html;

  // Captura: 1. Prefixo (href="..." ou href='...') | 2. A URL original | 3. A aspa de fechamento
  const regex =
    /(href=['"]\{\{base_webhook_cta_click\}\}\?redirectUrl=)([^'"]+)(['"])/g;

  return html.replace(regex, (_match, prefix, urlOriginal, suffix) => {
    let encodedUrl = urlOriginal;
    try {
      // Decodifica primeiro pra evitar "duplo encoding" caso o cliente
      // cole uma URL que já tem %20, %3D, etc.
      const decoded = decodeURIComponent(urlOriginal);
      encodedUrl = encodeURIComponent(decoded);
    } catch {
      // URL malformada: encoda direto
      encodedUrl = encodeURIComponent(urlOriginal);
    }
    return `${prefix}${encodedUrl}${suffix}`;
  });
}
