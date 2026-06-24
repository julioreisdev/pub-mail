import { PartialType } from '@nestjs/swagger';
import { CreateProjectSchedulesSentDto } from './create-project-schedules-sent.dto';

export class UpdateProjectSchedulesSentDto extends PartialType(CreateProjectSchedulesSentDto) {}
