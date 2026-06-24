import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WebchatSplitsService } from './webchat-splits.service';
import { CreateWebchatSplitDto } from './dto/create-webchat-split.dto';
import { UpdateWebchatSplitDto } from './dto/update-webchat-split.dto';

@ApiTags('Webchat Splits')
@ApiBearerAuth()
@Controller('webchat-splits')
@UseGuards(JwtAuthGuard)
export class WebchatSplitsController {
  constructor(private readonly service: WebchatSplitsService) {}

  @Get()
  list(@Req() req: any) {
    return this.service.list(req.user.organizationId);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateWebchatSplitDto) {
    return this.service.create(req.user.organizationId, dto.name);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateWebchatSplitDto,
  ) {
    return this.service.update(req.user.organizationId, id, dto.name);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.organizationId, id);
  }
}
