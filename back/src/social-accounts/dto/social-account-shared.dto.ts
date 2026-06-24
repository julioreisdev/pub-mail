export const SOCIAL_NETWORK_VALUES = ['TIKTOK', 'YOUTUBE', 'INSTAGRAM'] as const;
export type SocialNetworkValue = (typeof SOCIAL_NETWORK_VALUES)[number];

export const SOCIAL_ACCOUNT_STATUS_VALUES = [
  'ACTIVE',
  'DISCONNECTED',
] as const;
export type SocialAccountStatusValue =
  (typeof SOCIAL_ACCOUNT_STATUS_VALUES)[number];
