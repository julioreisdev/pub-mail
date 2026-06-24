import { PartialType } from '@nestjs/mapped-types';
import { CreateOrganiztionDto } from './create-organiztion.dto';
import { ApiExtraModels } from '@nestjs/swagger';

@ApiExtraModels(CreateOrganiztionDto)
export class UpdateOrganiztionDto extends PartialType(CreateOrganiztionDto) {}
