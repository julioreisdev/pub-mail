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
  listOrganizations(@Req() req: any) {
    return this.admin.listOrganizations(req?.user?.organizationId);
  }

  @Post('organizations')
  createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.admin.createOrganization(dto);
  }

  @Patch('organizations/:id')
  updateOrganization(@Param('id') id: string, @Body() dto: UpdateOrganizationDto, @Req() req: any) {
    return this.admin.updateOrganization(id, dto, req?.user?.organizationId);
  }

  @Delete('organizations/:id')
  removeOrganization(@Param('id') id: string, @Req() req: any) {
    return this.admin.removeOrganization(id, req?.user?.organizationId);
  }

  // ===== Usuários =====
  @Get('users')
  listUsers(@Req() req: any) {
    return this.admin.listUsers(req?.user?.organizationId);
  }

  @Post('users')
  createUser(@Body() dto: CreateAdminUserDto, @Req() req: any) {
    return this.admin.createUser(dto, req?.user?.organizationId);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateAdminUserDto, @Req() req: any) {
    return this.admin.updateUser(id, dto, req?.user?.organizationId);
  }

  @Patch('users/:id/password')
  changePassword(@Param('id') id: string, @Body() dto: ChangePasswordDto, @Req() req: any) {
    return this.admin.changePassword(id, dto.password, req?.user?.organizationId);
  }

  @Delete('users/:id')
  removeUser(@Param('id') id: string, @Req() req: any) {
    return this.admin.removeUser(id, req?.user?.userId, req?.user?.organizationId);
  }
}
