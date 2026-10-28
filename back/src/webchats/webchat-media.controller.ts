import { Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MAX_WEBCHAT_VIDEO_BYTES, WebchatMediaService } from './webchat-media.service';

@ApiTags('Webchats - Mídia')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('webchats/media')
export class WebchatMediaController {
  constructor(private readonly service: WebchatMediaService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_WEBCHAT_VIDEO_BYTES } }))
  @ApiOperation({ summary: 'Sobe um vídeo público do webchat (mensagem "Vídeo" do funil/boas-vindas); vira MP4 H.264.' })
  upload(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.service.storeVideo(req.user.organizationId, file);
  }
}
