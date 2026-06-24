import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
} from 'class-validator';

export class GenerateAvatarDto {
    @ApiProperty({ example: 'Um guerreiro cibernético com armadura neon' })
    @IsString()
    @IsNotEmpty()
    prompt: string;

    @ApiPropertyOptional({ example: ['neon pink', 'electric blue'] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    colors?: string[];

    @ApiPropertyOptional({ example: 'corajoso e misterioso' })
    @IsOptional()
    @IsString()
    personality?: string;

    @ApiPropertyOptional({ description: 'URL da foto original do usuário' })
    @IsOptional()
    @IsUrl()
    userReferenceImage?: string;

    @ApiPropertyOptional({
        description: 'URL da última imagem gerada (para modo edição)',
    })
    @IsOptional()
    @IsUrl()
    lastGeneratedImage?: string;

    @ApiPropertyOptional({
        example: true,
        description: 'Define se o estilo é realista',
    })
    @IsOptional()
    @IsBoolean()
    is_realistic?: boolean;
}
