import {
  IconAt,
  IconBellRinging,
  IconBrandWhatsapp,
  IconCalendarDue,
  IconChecklist,
  IconCoin,
  IconFlask,
  IconHeadset,
  IconLayoutKanban,
  IconMessage,
  IconPlugConnected,
  IconPlugConnectedX,
  IconReceipt2,
  IconRobot,
  IconSpeakerphone,
  IconStar,
  IconTrophy,
  IconUserCheck,
  IconUsers,
  IconUsersGroup,
  IconArrowsExchange,
  IconSparkles
} from '@tabler/icons-react';

// Ícone por tipo de notificação (mesmas chaves do catálogo do back: /notifications/catalog).
export const KIND_ICON = {
  message: IconMessage,
  message_group: IconUsersGroup,
  mention: IconAt,
  queue: IconHeadset,
  assigned: IconUserCheck,
  transferred: IconArrowsExchange,
  handoff: IconRobot,
  task_due: IconCalendarDue,
  task_assigned: IconChecklist,
  charge_paid: IconCoin,
  charge_overdue: IconReceipt2,
  pipeline_moved: IconLayoutKanban,
  pipeline_won: IconTrophy,
  session_disconnected: IconPlugConnectedX,
  session_connected: IconPlugConnected,
  rating: IconStar,
  broadcast_done: IconSpeakerphone,
  team_message: IconUsers,
  custom: IconSparkles,
  test: IconFlask
};

export const GROUP_ICON = {
  messages: IconBrandWhatsapp,
  attendance: IconHeadset,
  tasks: IconChecklist,
  billing: IconCoin,
  pipeline: IconLayoutKanban,
  connection: IconPlugConnected,
  other: IconBellRinging
};

// cor do ícone por grupo (tokens do tema → funciona no claro e no escuro)
export const GROUP_TONE = {
  messages: 'success',
  attendance: 'info',
  tasks: 'warning',
  billing: 'primary',
  pipeline: 'secondary',
  connection: 'error',
  other: 'primary'
};

export const KIND_GROUP = {
  message: 'messages',
  message_group: 'messages',
  mention: 'messages',
  queue: 'attendance',
  assigned: 'attendance',
  transferred: 'attendance',
  handoff: 'attendance',
  task_due: 'tasks',
  task_assigned: 'tasks',
  charge_paid: 'billing',
  charge_overdue: 'billing',
  pipeline_moved: 'pipeline',
  pipeline_won: 'pipeline',
  session_disconnected: 'connection',
  session_connected: 'connection',
  rating: 'other',
  broadcast_done: 'other',
  team_message: 'other',
  custom: 'other',
  test: 'other'
};
