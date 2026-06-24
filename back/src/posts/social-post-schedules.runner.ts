import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SocialPostSchedulesService } from './social-post-schedules.service';

@Injectable()
export class SocialPostSchedulesRunner {
  private readonly logger = new Logger(SocialPostSchedulesRunner.name);

  constructor(
    private readonly socialPostSchedulesService: SocialPostSchedulesService,
  ) {}

  @Cron('0 0 * * * *')
  async handleCron() {
    const now = new Date();
    const runAtHour = new Date(now);
    runAtHour.setMinutes(0, 0, 0);

    this.logger.debug(`[tick-social] runAtHour=${runAtHour.toISOString()}`);
    await this.socialPostSchedulesService.processDueSchedules(runAtHour);
  }

  @Cron('30 * * * * *')
  async handleTikTokStatusPollingCron() {
    await this.socialPostSchedulesService.processTikTokPendingRunsStatus();
  }
}
