import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TelegramAssetsService } from './telegram-assets.service';

@ApiTags('Telegram - Flow Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telegram')
export class TelegramAssetsController {
  constructor(private readonly service: TelegramAssetsService) {}

  @Post('flow-assets')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Sobe mídia do fluxo (foto/vídeo/voz/documento) e devolve a URL pública.' })
  upload(@Body('type') type: string, @UploadedFile() file?: Express.Multer.File) {
    return this.service.save(file as any, type || 'document');
  }
}
