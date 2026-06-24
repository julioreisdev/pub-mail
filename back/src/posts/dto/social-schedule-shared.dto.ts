export const SOCIAL_NETWORK_VALUES = ['TIKTOK', 'YOUTUBE', 'INSTAGRAM'] as const;
export type SocialNetworkValue = (typeof SOCIAL_NETWORK_VALUES)[number];

export const SOCIAL_SCHEDULE_STATUS_VALUES = [
  'SCHEDULED',
  'PROCESSING',
  'SENT',
  'FAILED',
  'CANCELED',
] as const;
export type SocialScheduleStatusValue =
  (typeof SOCIAL_SCHEDULE_STATUS_VALUES)[number];

export const SOCIAL_SCHEDULE_RUN_STATUS_VALUES = [
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELED',
] as const;
export type SocialScheduleRunStatusValue =
  (typeof SOCIAL_SCHEDULE_RUN_STATUS_VALUES)[number];
