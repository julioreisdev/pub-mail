import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    IsUrl,
} from 'class-validator';

export class CreateAvatarDto {
    @ApiProperty({ example: 'Avatar Suporte Premium' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'URL definitiva da imagem do avatar' })
    @IsUrl()
    @IsNotEmpty()
    avatar_image_url: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    is_realistic?: boolean;

    @ApiPropertyOptional({ example: ['#FF0000', '#000000'] })
    @IsOptional()
    @IsArray()
    default_colors?: any[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsUrl()
    inspiration_image_url?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    user_prompt?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    system_prompt?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    personality?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    technical_metadata?: Record<string, any>;

    @ApiPropertyOptional({ enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE' })
    @IsOptional()
    @IsEnum(['ACTIVE', 'ARCHIVED'])
    status?: 'ACTIVE' | 'ARCHIVED';
}
