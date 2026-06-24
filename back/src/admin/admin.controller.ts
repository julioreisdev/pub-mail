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
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ===== Organizações =====
  @Get('organizations')
  listOrganizations() {
    return this.admin.listOrganizations();
  }

  @Post('organizations')
  createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.admin.createOrganization(dto);
  }

  @Patch('organizations/:id')
  updateOrganization(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.admin.updateOrganization(id, dto);
  }

  @Delete('organizations/:id')
  removeOrganization(@Param('id') id: string) {
    return this.admin.removeOrganization(id);
  }

  // ===== Usuários =====
  @Get('users')
  listUsers() {
    return this.admin.listUsers();
  }

  @Post('users')
  createUser(@Body() dto: CreateAdminUserDto) {
    return this.admin.createUser(dto);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.admin.updateUser(id, dto);
  }

  @Patch('users/:id/password')
  changePassword(@Param('id') id: string, @Body() dto: ChangePasswordDto) {
    return this.admin.changePassword(id, dto.password);
  }

  @Delete('users/:id')
  removeUser(@Param('id') id: string, @Req() req: any) {
    return this.admin.removeUser(id, req?.user?.userId);
  }
}
