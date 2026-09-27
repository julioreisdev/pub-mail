import {
  Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiBearerAuth, ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { MAX_VIDEO_BYTES, WebchatAssetsService } from './webchat-assets.service';

// Multer grava direto no disco (vídeo de 500 MB não cabe em memória). A pasta é
// resolvida por org a partir do JWT (req.user) — o interceptor roda depois do guard.
const storage = diskStorage({
  destination: (req: any, _file, cb) => {
    try {
      cb(null, WebchatAssetsService.orgDir(String(req.user?.organizationId || 'unknown')));
    } catch (e) {
      cb(e as Error, '');
    }
  },
  filename: (_req, file, cb) => cb(null, WebchatAssetsService.fileName(file.originalname)),
});

@ApiTags('Webchat - Arquivos de produto')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('webchat-assets')
export class WebchatAssetsController {
  constructor(private readonly service: WebchatAssetsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage, limits: { fileSize: MAX_VIDEO_BYTES } }))
  @ApiOperation({ summary: 'Sobe um arquivo de produto (PDF/vídeo/zip…) — privado, só liberado após pagamento.' })
  upload(@Req() req: any, @UploadedFile() file: Express.Multer.File, @Query('webchat_id') webchatId?: string) {
    return this.service.register(req.user.organizationId, file, webchatId || null);
  }

  @Get()
  list(@Req() req: any, @Query('webchat_id') webchatId?: string) {
    return this.service.list(req.user.organizationId, webchatId || undefined);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(req.user.organizationId, id);
  }
}

// Download público por URL ASSINADA (emitida só depois do PAID). Suporta Range
// (vídeo faz seek) via res.sendFile.
@ApiExcludeController()
@Controller('public/webchat-assets')
export class PublicWebchatAssetsController {
  constructor(private readonly service: WebchatAssetsService) {}

  @Public()
  @Get(':id')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('e') exp: string,
    @Query('s') sig: string,
    @Query('dl') dl: string,
    @Query('fn') fn: string,
    @Res() res: Response,
  ) {
    const { row, abs } = await this.service.findForDownload(id, exp, sig);
    // Nome que o lead vê ao salvar: o "nome exibido" configurado no funil (fn)
    // ou o nome original. Mantém a extensão original pro SO abrir certo.
    const ext = (row.name.match(/\.[a-z0-9]{1,8}$/i) || [''])[0];
    let display = String(fn || '').replace(/[\u0000-\u001f\/\\:*?"<>|]/g, '').trim().slice(0, 150);
    if (display && ext && !display.toLowerCase().endsWith(ext.toLowerCase())) display += ext;
    const safeName = encodeURIComponent(display || row.name).replace(/['()]/g, escape);
    // PDF/imagem/vídeo/áudio abrem INLINE (no iOS o attachment vira uma aba em
    // branco com barra de download; inline mostra o visualizador com "salvar").
    // dl=1 força download; outros formatos (zip, doc…) sempre baixam.
    const inlineOk = /^(application\/pdf|image\/|video\/|audio\/|text\/plain)/i.test(row.mime);
    const disposition = dl === '1' || !inlineOk ? 'attachment' : 'inline';
    res.sendFile(abs, {
      headers: {
        'Content-Type': row.mime,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${safeName}`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
      acceptRanges: true,
    });
  }
}
