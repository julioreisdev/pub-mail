export declare const avatar_status: {
    readonly ACTIVE: "ACTIVE";
    readonly ARCHIVED: "ARCHIVED";
};
export type avatar_status = (typeof avatar_status)[keyof typeof avatar_status];
export declare const wallets_status: {
    readonly ACTIVE: "ACTIVE";
    readonly FROZEN: "FROZEN";
};
export type wallets_status = (typeof wallets_status)[keyof typeof wallets_status];
export declare const users_role: {
    readonly OWNER: "OWNER";
    readonly ADMIN: "ADMIN";
    readonly MEMBER: "MEMBER";
};
export type users_role = (typeof users_role)[keyof typeof users_role];
export declare const email_leads_global_status: {
    readonly ACTIVE: "ACTIVE";
    readonly BOUNCED: "BOUNCED";
    readonly COMPLAINED: "COMPLAINED";
};
export type email_leads_global_status = (typeof email_leads_global_status)[keyof typeof email_leads_global_status];
export declare const email_project_leads_status: {
    readonly SUBSCRIBED: "SUBSCRIBED";
    readonly UNSUBSCRIBED: "UNSUBSCRIBED";
};
export type email_project_leads_status = (typeof email_project_leads_status)[keyof typeof email_project_leads_status];
export declare const domain_status: {
    readonly PENDING: "PENDING";
    readonly VERIFIED: "VERIFIED";
    readonly FAILED: "FAILED";
};
export type domain_status = (typeof domain_status)[keyof typeof domain_status];
export declare const schedule_sent_status: {
    readonly PROCESSING: "PROCESSING";
    readonly COMPLETED: "COMPLETED";
    readonly PARTIAL: "PARTIAL";
    readonly FAILED: "FAILED";
};
export type schedule_sent_status = (typeof schedule_sent_status)[keyof typeof schedule_sent_status];
export declare const post_type: {
    readonly SINGLE_IMAGE: "SINGLE_IMAGE";
    readonly SINGLE_VIDEO: "SINGLE_VIDEO";
    readonly CAROUSEL: "CAROUSEL";
};
export type post_type = (typeof post_type)[keyof typeof post_type];
export declare const media_type: {
    readonly IMAGE: "IMAGE";
    readonly VIDEO: "VIDEO";
};
export type media_type = (typeof media_type)[keyof typeof media_type];
export declare const post_status: {
    readonly ACTIVE: "ACTIVE";
    readonly ARCHIVED: "ARCHIVED";
};
export type post_status = (typeof post_status)[keyof typeof post_status];
export declare const social_network: {
    readonly TIKTOK: "TIKTOK";
    readonly YOUTUBE: "YOUTUBE";
    readonly INSTAGRAM: "INSTAGRAM";
};
export type social_network = (typeof social_network)[keyof typeof social_network];
export declare const social_account_status: {
    readonly ACTIVE: "ACTIVE";
    readonly DISCONNECTED: "DISCONNECTED";
};
export type social_account_status = (typeof social_account_status)[keyof typeof social_account_status];
export declare const social_schedule_status: {
    readonly SCHEDULED: "SCHEDULED";
    readonly PROCESSING: "PROCESSING";
    readonly SENT: "SENT";
    readonly FAILED: "FAILED";
    readonly CANCELED: "CANCELED";
};
export type social_schedule_status = (typeof social_schedule_status)[keyof typeof social_schedule_status];
export declare const social_schedule_run_status: {
    readonly PROCESSING: "PROCESSING";
    readonly COMPLETED: "COMPLETED";
    readonly FAILED: "FAILED";
    readonly CANCELED: "CANCELED";
};
export type social_schedule_run_status = (typeof social_schedule_run_status)[keyof typeof social_schedule_run_status];
