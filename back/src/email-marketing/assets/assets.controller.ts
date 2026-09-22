import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { EmailAssetsService } from './assets.service';
import { UploadEmailAssetDto } from './dto/upload-asset.dto';

@ApiTags('Email Marketing - Assets')
@ApiBearerAuth()
@Controller('email/assets')
@UseGuards(JwtAuthGuard)
export class EmailAssetsController {
  constructor(private readonly service: EmailAssetsService) {}

  @Post()
  @ApiOperation({ summary: 'Upload de imagem do builder de e-mail (hospeda e retorna URL pública).' })
  upload(@Body() dto: UploadEmailAssetDto) {
    return this.service.saveDataUrl(dto.dataUrl);
  }
}
