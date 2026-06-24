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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AvatarsService } from './avatars.service';
import { CreateAvatarDto } from './dto/create-avatar.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';

@ApiTags('Avatars')
@ApiBearerAuth()
@Controller('avatars')
@UseGuards(JwtAuthGuard)
export class AvatarsController {
    constructor(private readonly avatarsService: AvatarsService) { }

    @Post()
    @ApiOperation({ summary: 'Salvar um novo avatar definitivo' })
    create(@Req() req: any, @Body() createAvatarDto: CreateAvatarDto) {
        return this.avatarsService.create(req.user.organizationId, createAvatarDto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todos os avatares da organização' })
    findAll(@Req() req: any) {
        return this.avatarsService.findAll(req.user.organizationId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Buscar detalhes de um avatar específico' })
    findOne(@Req() req: any, @Param('id') id: string) {
        return this.avatarsService.findOne(req.user.organizationId, id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Atualizar dados de um avatar' })
    update(
        @Req() req: any,
        @Param('id') id: string,
        @Body() updateAvatarDto: UpdateAvatarDto,
    ) {
        return this.avatarsService.update(
            req.user.organizationId,
            id,
            updateAvatarDto,
        );
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Deletar um avatar' })
    remove(@Req() req: any, @Param('id') id: string) {
        return this.avatarsService.remove(req.user.organizationId, id);
    }
}
