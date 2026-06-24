import { PartialType } from '@nestjs/mapped-types';
import { CreateAgenteDto } from './create-agente.dto';

export class UpdateAgenteDto extends PartialType(CreateAgenteDto) {}
