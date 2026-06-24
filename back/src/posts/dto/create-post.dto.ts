import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Definimos localmente para não depender do gerador do Prisma
export enum PostTypeEnum {
    SINGLE_IMAGE = 'SINGLE_IMAGE',
    SINGLE_VIDEO = 'SINGLE_VIDEO',
    CAROUSEL = 'CAROUSEL',
}

export class CreatePostDto {
    @ApiProperty({
        description: 'Nome interno do post para o painel',
        example: 'Promoção de Inverno',
    })
    @IsNotEmpty({ message: 'O nome interno é obrigatório.' })
    @IsString()
    internal_name: string;

    @ApiProperty({
        enum: PostTypeEnum,
        description: 'Tipo do post: SINGLE_VIDEO, SINGLE_IMAGE, CAROUSEL',
    })
    @IsNotEmpty()
    @IsEnum(PostTypeEnum)
    post_type: PostTypeEnum;

    @ApiPropertyOptional({
        description: 'Título padrão, obrigatório para YouTube Shorts',
    })
    @IsOptional()
    @IsString()
    default_title?: string;

    @ApiPropertyOptional({
        description: 'Legenda padrão para Instagram e TikTok',
    })
    @IsOptional()
    @IsString()
    default_caption?: string;

    @ApiPropertyOptional({
        description: 'Hashtags em formato string JSON',
        example: '["#saas", "#vendas"]',
    })
    @IsOptional()
    @IsString()
    tags?: string;
}
