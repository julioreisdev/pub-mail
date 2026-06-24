import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { WebchatSplitsService } from './webchat-splits.service';

@ApiTags('Public Webchat Splits')
@Public()
@Controller('public/webchat-splits')
export class PublicWebchatSplitsController {
  constructor(private readonly service: WebchatSplitsService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Resolver split público por slug (membros + pesos)' })
  resolve(@Param('slug') slug: string) {
    return this.service.getPublicSplitBySlug(slug);
  }
}
