import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { promises as fsp } from 'fs';
import { join, resolve } from 'path';
import { Public } from '../auth/public.decorator';
import { WebchatsService } from './webchat.service';

// HTML do webchat público com as metas da prévia do link (Open Graph/Twitter) do PRÓPRIO
// webchat. O nginx dos domínios de cliente proxia `/webchat/<slug>` para cá
// (`location ^~ /webchat/` → `/public/webchat-page/<slug>`): os robôs do WhatsApp/Telegram/
// Facebook não rodam JS, então o título/descrição/imagem têm que vir no HTML. Serve o MESMO
// `index.html` do build da SPA (lido do disco, cache por mtime) trocando só as metas; webchat
// desconhecido/inativo = index.html como está (a SPA continua funcionando igual).
type PageMeta = { title: string; description: string; image: string; image_w: number | null; image_h: number | null; url: string };

const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// tags que o index.html já traz e que vamos substituir
const STRIP_RE = /\n?[ \t]*<(?:title>[^<]*<\/title>|meta\s+(?:name|property)="(?:title|description|og:[a-z:_]+|twitter:[a-z:_]+)"[^>]*>)/gi;

@ApiTags('Public webchat page')
@Public()
@Controller('public/webchat-page')
export class PublicWebchatPageController {
  private cache: { path: string; mtimeMs: number; html: string } | null = null;

  constructor(private readonly webchats: WebchatsService) {}

  private async indexHtml(): Promise<string | null> {
    const path = resolve(String(process.env.WEBCHAT_FRONT_DIST || join(process.cwd(), '..', 'front', 'vite', 'dist')).trim(), 'index.html');
    try {
      const st = await fsp.stat(path);
      if (this.cache && this.cache.path === path && this.cache.mtimeMs === st.mtimeMs) return this.cache.html;
      const html = await fsp.readFile(path, 'utf8');
      this.cache = { path, mtimeMs: st.mtimeMs, html };
      return html;
    } catch {
      return null;
    }
  }

  private inject(html: string, m: PageMeta) {
    const tags = [
      `<title>${esc(m.title)}</title>`,
      `<meta name="title" content="${esc(m.title)}" />`,
      `<meta name="description" content="${esc(m.description)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:title" content="${esc(m.title)}" />`,
      `<meta property="og:description" content="${esc(m.description)}" />`,
      `<meta property="og:url" content="${esc(m.url)}" />`,
      `<meta property="og:locale" content="pt_BR" />`,
      m.image ? `<meta property="og:image" content="${esc(m.image)}" />` : '',
      m.image ? `<meta property="og:image:secure_url" content="${esc(m.image)}" />` : '',
      m.image && m.image_w ? `<meta property="og:image:width" content="${m.image_w}" />` : '',
      m.image && m.image_h ? `<meta property="og:image:height" content="${m.image_h}" />` : '',
      m.image ? `<meta property="og:image:alt" content="${esc(m.title)}" />` : '',
      `<meta name="twitter:card" content="${m.image ? 'summary_large_image' : 'summary'}" />`,
      `<meta name="twitter:title" content="${esc(m.title)}" />`,
      `<meta name="twitter:description" content="${esc(m.description)}" />`,
      m.image ? `<meta name="twitter:image" content="${esc(m.image)}" />` : '',
    ].filter(Boolean);
    const stripped = html.replace(STRIP_RE, '');
    return stripped.replace(/<head>/i, `<head>\n  ${tags.join('\n  ')}`);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'index.html da SPA com as metas de prévia (Open Graph) do webchat resolvido por Host + slug.' })
  async page(@Param('slug') slug: string, @Req() req: Request, @Res() res: Response) {
    const html = await this.indexHtml();
    if (!html) { res.status(503).type('text/plain').send('front indisponível'); return; }
    const host = String(req.hostname || req.headers.host || '').split(':')[0];
    let out = html;
    try {
      const meta = await this.webchats.getPublicPageMeta(slug, host);
      if (meta) out = this.inject(html, { ...meta, url: `https://${host}/webchat/${encodeURIComponent(slug)}` });
    } catch {
      /* webchat desconhecido/inativo: HTML padrão */
    }
    res.status(200).type('text/html; charset=utf-8').set('Cache-Control', 'no-cache').send(out);
  }
}
