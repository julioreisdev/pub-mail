import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RecycleService } from './recycle.service';
import { RecycleDto } from './dto/recycle.dto';

@ApiTags('Email Marketing - Recycle')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('email/projects')
export class RecycleController {
  constructor(private readonly service: RecycleService) {}

  @Get(':id/cold-count')
  @ApiOperation({ summary: 'Contar leads frios de um projeto' })
  @ApiQuery({ name: 'criteria', enum: ['never', 'inactive'] })
  @ApiQuery({ name: 'days', required: false, type: Number })
  coldCount(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('criteria') criteria?: string,
    @Query('days') days?: string,
  ) {
    return this.service.coldCount(
      req.user.organizationId,
      id,
      criteria === 'inactive' ? 'inactive' : 'never',
      days ? Number(days) : 30,
    );
  }

  @Post(':id/recycle')
  @ApiOperation({ summary: 'Disparar reciclagem (win-back) para os leads frios' })
  recycle(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RecycleDto,
  ) {
    return this.service.recycle(req.user.organizationId, id, dto);
  }
}
