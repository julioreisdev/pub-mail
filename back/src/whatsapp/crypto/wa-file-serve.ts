import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { Request, Response } from 'express';
import { waKeyring } from './wa-keyring';

/** Pasta para arquivos temporários com conteúdo aberto: memória (/dev/shm) quando existe. */
export function plainTmpDir() {
  return existsSync('/dev/shm') ? '/dev/shm' : tmpdir();
}

/**
 * Entrega um arquivo de mídia do WhatsApp ao navegador, cifrado ou não.
 * Cifrado: decifra só os blocos do trecho pedido (Range), então áudio e vídeo continuam
 * pulando para qualquer ponto sem baixar o arquivo inteiro. Em claro: res.sendFile de sempre.
 * Os cabeçalhos de tipo/cache/nome ficam por conta de quem chama.
 */
export async function serveWaFile(abs: string, req: Request, res: Response) {
  let f: Awaited<ReturnType<ReturnType<typeof waKeyring>['openFile']>>;
  try {
    f = await waKeyring().openFile(abs);
  } catch (e: any) {
    if (!res.headersSent) res.status(e?.code === 'ENOENT' ? 404 : 500).end();
    return;
  }
  if (!f) {
    res.sendFile(abs, { acceptRanges: true, dotfiles: 'deny' }, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
    return;
  }
  const file = f;
  try {
    const size = file.size;
    let a = 0;
    let b = size - 1;
    let partial = false;
    const range = String(req.headers.range || '');
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m && size > 0 && (m[1] || m[2])) {
      if (m[1] === '') {
        a = Math.max(0, size - Number(m[2]));
      } else {
        a = Number(m[1]);
        b = m[2] === '' ? size - 1 : Math.min(size - 1, Number(m[2]));
      }
      if (a > b || a >= size) {
        res.status(416).setHeader('Content-Range', `bytes */${size}`);
        res.end();
        return;
      }
      partial = true;
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(size === 0 ? 0 : b - a + 1));
    if (partial) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${a}-${b}/${size}`);
    } else res.status(200);
    if (req.method === 'HEAD' || size === 0) {
      res.end();
      return;
    }
    for await (const part of file.read(a, b)) {
      if (res.destroyed) break;
      // cliente fechou no meio (pulou o vídeo, trocou de conversa): para de ler
      if (!res.write(part)) await new Promise((r) => { res.once('drain', r); res.once('close', r); });
    }
    res.end();
  } catch {
    if (!res.headersSent) res.status(500).end();
    else res.destroy();
  } finally {
    await file.close().catch(() => undefined);
  }
}
