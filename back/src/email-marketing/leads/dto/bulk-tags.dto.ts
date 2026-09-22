import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class BulkTagsDto {
  @ApiProperty({ type: [String], description: 'IDs dos leads (email_leads.id).' })
  @IsArray()
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  lead_ids: string[];

  @ApiProperty({ type: [String], description: 'Tags a adicionar.' })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  add: string[];
}
