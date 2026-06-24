export const SOCIAL_POST_SCHEDULE_TOKENS_COST_ENV =
  'SOCIAL_POST_SCHEDULE_TOKENS_COST';

export const DEFAULT_SOCIAL_POST_SCHEDULE_TOKENS_COST = 1000;
export const SOCIAL_POST_SCHEDULES_TIMEZONE = 'America/Sao_Paulo';

export function getSocialPostScheduleTokensCost(): number {
  const rawValue = process.env[SOCIAL_POST_SCHEDULE_TOKENS_COST_ENV];
  const parsed = Number(rawValue);

  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.floor(parsed);
  }

  return DEFAULT_SOCIAL_POST_SCHEDULE_TOKENS_COST;
}
