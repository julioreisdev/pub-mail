import { PartialType } from '@nestjs/swagger';
import { CreateEmailProjectScheduleDto } from './create-project_schedule.dto';

export class UpdateEmailProjectScheduleDto extends PartialType(CreateEmailProjectScheduleDto) {}
