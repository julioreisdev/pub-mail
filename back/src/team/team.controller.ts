import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TeamService } from './team.service';
import { AddMembersDto, CreateDmDto, CreateGroupDto, EditTeamMessageDto, RenameGroupDto, SendTeamMessageDto, SetMemberRoleDto } from './dto/team.dto';

const MB = 1024 * 1024;
const me = (req: any) => ({ userId: String(req.user.userId), organizationId: String(req.user.organizationId), role: req.user.role });

// Chat interno da equipe (qualquer usuário logado da organização; caminho aberto no AccessInterceptor).
@ApiTags('Team')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get('users') users(@Req() req: any) { return this.team.users(req.user.organizationId, req.user.userId); }
  @Get('chats') list(@Req() req: any) { return this.team.list(req.user.organizationId, req.user.userId); }
  @Post('chats/dm') dm(@Req() req: any, @Body() dto: CreateDmDto) { return this.team.openDm(req.user.organizationId, req.user.userId, dto.user_id); }
  @Post('chats/groups') group(@Req() req: any, @Body() dto: CreateGroupDto) { return this.team.createGroup(req.user.organizationId, req.user.userId, dto.name, dto.member_ids); }
  @Get('chats/:id') get(@Req() req: any, @Param('id') id: string) { return this.team.get(req.user.organizationId, req.user.userId, id); }
  @Patch('chats/:id') rename(@Req() req: any, @Param('id') id: string, @Body() dto: RenameGroupDto) { return this.team.rename(req.user.organizationId, me(req), id, dto.name); }
  @Delete('chats/:id') removeGroup(@Req() req: any, @Param('id') id: string) { return this.team.deleteGroup(req.user.organizationId, me(req), id); }
  @Post('chats/:id/members') addMembers(@Req() req: any, @Param('id') id: string, @Body() dto: AddMembersDto) { return this.team.addMembers(req.user.organizationId, me(req), id, dto.user_ids); }
  @Patch('chats/:id/members/:userId') setRole(@Req() req: any, @Param('id') id: string, @Param('userId') userId: string, @Body() dto: SetMemberRoleDto) { return this.team.setRole(req.user.organizationId, me(req), id, userId, dto.role); }
  @Delete('chats/:id/members/:userId') removeMember(@Req() req: any, @Param('id') id: string, @Param('userId') userId: string) { return this.team.removeMember(req.user.organizationId, me(req), id, userId); }
  @Post('chats/:id/read') read(@Req() req: any, @Param('id') id: string) { return this.team.markRead(req.user.organizationId, req.user.userId, id); }
  @Get('chats/:id/messages') messages(@Req() req: any, @Param('id') id: string, @Query() q: any) { return this.team.messages(req.user.organizationId, req.user.userId, id, q || {}); }
  @Post('chats/:id/messages') @Throttle({ default: { limit: 120, ttl: 60_000 } }) send(@Req() req: any, @Param('id') id: string, @Body() dto: SendTeamMessageDto) { return this.team.send(req.user.organizationId, req.user.userId, id, dto); }
  @Patch('messages/:id') edit(@Req() req: any, @Param('id') id: string, @Body() dto: EditTeamMessageDto) { return this.team.edit(req.user.organizationId, req.user.userId, id, dto.text); }
  @Delete('messages/:id') remove(@Req() req: any, @Param('id') id: string) { return this.team.remove(req.user.organizationId, me(req), id); }

  @Post('media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 64 * MB } }))
  async upload(@Req() req: any, @UploadedFile() file: any, @Body() body: any) {
    if (!file?.buffer?.length) return { error: 'Arquivo vazio.' };
    const name = file.originalname ? Buffer.from(file.originalname, 'latin1').toString('utf8') : null;
    return this.team.upload(req.user.organizationId, file.buffer, String(file.mimetype || 'application/octet-stream'), name, body?.as_voice === '1');
  }
}
