import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Req,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Ajuste o path se necessário
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiConsumes,
} from '@nestjs/swagger';

const DEFAULT_POSTS_MAX_FILES = 10;
const DEFAULT_POSTS_MAX_FILE_SIZE_BYTES = 2_000_000_000; // Mantém abaixo do limite de Int no banco por enquanto.

function parsePositiveInt(rawValue: string | undefined, fallback: number) {
    const parsed = Number.parseInt(String(rawValue ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const POSTS_MAX_FILES = parsePositiveInt(
    process.env.POSTS_MAX_FILES,
    DEFAULT_POSTS_MAX_FILES,
);
const POSTS_MAX_FILE_SIZE_BYTES = parsePositiveInt(
    process.env.POSTS_MAX_FILE_SIZE_BYTES || process.env.UPLOAD_MAX_FILE_SIZE_BYTES,
    DEFAULT_POSTS_MAX_FILE_SIZE_BYTES,
);

@ApiTags('Posts & Media')
@ApiBearerAuth()
@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
    constructor(private readonly postsService: PostsService) { }

    @Post()
    @ApiOperation({
        summary: 'Cria o post e faz upload das mídias debitando tokens',
    })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(
        FilesInterceptor('files', POSTS_MAX_FILES, {
            // Upload alto aplicado apenas para /posts.
            storage: diskStorage({
                destination: (req, file, cb) => {
                    const uploadPath = './uploads';
                    // Cria a pasta automaticamente se não existir!
                    if (!fs.existsSync(uploadPath)) {
                        fs.mkdirSync(uploadPath, { recursive: true });
                    }
                    cb(null, uploadPath);
                },
                filename: (req, file, cb) => {
                    const uniqueSuffix =
                        Date.now() + '-' + Math.round(Math.random() * 1e9);
                    cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
                },
            }),
            limits: {
                files: POSTS_MAX_FILES,
                fileSize: POSTS_MAX_FILE_SIZE_BYTES,
            },
        }),
    )
    create(
        @Req() req: any,
        @Body() createPostDto: CreatePostDto,
        @UploadedFiles() files: Array<Express.Multer.File>,
    ) {
        return this.postsService.create(
            req.user.organizationId,
            createPostDto,
            files,
        );
    }

    @Get()
    @ApiOperation({ summary: 'Lista todos os posts com suas mídias inclusas' })
    findAll(@Req() req: any) {
        return this.postsService.findAll(req.user.organizationId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Busca os detalhes de um post específico' })
    findOne(@Req() req: any, @Param('id') id: string) {
        return this.postsService.findOne(req.user.organizationId, id);
    }

    @Patch(':id')
    @ApiOperation({
        summary: 'Atualiza apenas as informações de texto/status do post',
    })
    update(
        @Req() req: any,
        @Param('id') id: string,
        @Body() updatePostDto: UpdatePostDto,
    ) {
        return this.postsService.update(req.user.organizationId, id, updatePostDto);
    }

    @Delete(':id')
    @ApiOperation({
        summary: 'Deleta o post e remove os arquivos físicos do servidor',
    })
    remove(@Req() req: any, @Param('id') id: string) {
        return this.postsService.remove(req.user.organizationId, id);
    }
}
