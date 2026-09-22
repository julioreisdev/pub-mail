import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SystemSettingsModule } from 'src/system-settings/system-settings.module';

import { EmailProjectsController } from './project/project.controller';
import { EmailProjectsService } from './project/project.service';
import { EmailTemplatesController } from './templates/templates.controller';
import { EmailTemplatesService } from './templates/templates.service';
import { EmailLeadsController } from './leads/leads.controller';
import { EmailLeadsService } from './leads/leads.service';
import { EmailImportController } from "./import/import.controller";
import { EmailImportService } from "./import/import.service";
import { EmailAssetsController } from "./assets/assets.controller";
import { EmailAssetsService } from "./assets/assets.service";
import { EmailProjectLeadsController } from "./project-leads/project-leads.controller";
import { EmailProjectLeadsService } from "./project-leads/project-leads.service";
import { EmailFlowsController } from "./flows/flows.controller";
import { EmailFlowsService } from "./flows/flows.service";
import { EmailFlowsRunner } from "./flows/flows-runner.service";
import { RecycleController } from "./recycle/recycle.controller";
import { RecycleService } from "./recycle/recycle.service";
import { EmailHygieneRunner } from "./hygiene/email-hygiene.service";



@Module({
  controllers: [EmailProjectsController, EmailTemplatesController, EmailLeadsController, EmailImportController, EmailAssetsController, EmailProjectLeadsController, EmailFlowsController, RecycleController],
  providers: [EmailProjectsService, EmailTemplatesService, EmailLeadsService, EmailImportService, EmailAssetsService, EmailProjectLeadsService, EmailFlowsService, EmailFlowsRunner, RecycleService, EmailHygieneRunner],
  imports: [PrismaModule, SystemSettingsModule]
})
export class EmailMarketingModule {}
