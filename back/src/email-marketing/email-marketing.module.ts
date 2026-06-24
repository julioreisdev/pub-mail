import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';

import { EmailProjectsController } from './project/project.controller';
import { EmailProjectsService } from './project/project.service';
import { EmailTemplatesController } from './templates/templates.controller';
import { EmailTemplatesService } from './templates/templates.service';
import { EmailLeadsController } from './leads/leads.controller';
import { EmailLeadsService } from './leads/leads.service';
import { EmailImportController } from "./import/import.controller";
import { EmailImportService } from "./import/import.service";



@Module({
  controllers: [EmailProjectsController, EmailTemplatesController, EmailLeadsController, EmailImportController],
  providers: [EmailProjectsService, EmailTemplatesService, EmailLeadsService, EmailImportService],
  imports: [PrismaModule]
})
export class EmailMarketingModule {}
