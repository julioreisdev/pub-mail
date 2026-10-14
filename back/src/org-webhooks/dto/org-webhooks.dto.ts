import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { WEBHOOK_EVENTS } from '../webhook-sign.util';

const EVENTS = ['*', ...WEBHOOK_EVENTS];

export class CreateOrgWebhookDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  @IsString() @MinLength(8) @MaxLength(500) url: string;
  @IsOptional() @IsArray() @ArrayMaxSize(EVENTS.length) @IsIn(EVENTS, { each: true }) events?: string[];
}
export class UpdateOrgWebhookDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(500) url?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(EVENTS.length) @IsIn(EVENTS, { each: true }) events?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}
