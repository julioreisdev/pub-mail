import { PartialType } from '@nestjs/mapped-types';
import { CreateWebchatDto } from './create-webchat.dto';

export class UpdateWebchatDto extends PartialType(CreateWebchatDto) {}
