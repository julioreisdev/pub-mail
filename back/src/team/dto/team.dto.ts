import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDmDto {
  @IsString() user_id: string;
}
export class CreateGroupDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) member_ids: string[];
}
export class RenameGroupDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
}
export class AddMembersDto {
  @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) user_ids: string[];
}
export class SetMemberRoleDto {
  @IsIn(['admin', 'member']) role: string;
}
export class SendTeamMessageDto {
  @IsOptional() @IsString() @MaxLength(20000) text?: string;
  @IsOptional() @IsString() media_id?: string;
  @IsOptional() @IsString() quoted_id?: string;
}
export class EditTeamMessageDto {
  @IsString() @MinLength(1) @MaxLength(20000) text: string;
}
