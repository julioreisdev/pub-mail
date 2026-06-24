import { ApiExtraModels } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';
import { CreateProfileDto } from './create-profile.dto';

@ApiExtraModels(CreateProfileDto)
export class UpdateProfileDto extends PartialType(CreateProfileDto) {}
