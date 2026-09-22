import { forwardRef, createElement } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  IconActivityHeartbeat,
  IconAdjustments,
  IconAlertCircle,
  IconAlignCenter,
  IconAlignJustified,
  IconAlignLeft,
  IconAlignRight,
  IconApi,
  IconArchive,
  IconArrowDown,
  IconArrowDownLeft,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowUpRight,
  IconArrowsShuffle,
  IconArrowsSplit2,
  IconArrowsVertical,
  IconArticle,
  IconBan,
  IconBold,
  IconBolt,
  IconBraces,
  IconBrandInstagram,
  IconBrandWhatsapp,
  IconBrandYoutube,
  IconBrush,
  IconCalendar,
  IconCalendarEvent,
  IconCalendarMonth,
  IconCalendarOff,
  IconCategory,
  IconChartDots,
  IconChartLine,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconClick,
  IconClock,
  IconCode,
  IconColumns,
  IconCopy,
  IconCreditCard,
  IconDeviceFloppy,
  IconDots,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconFileDescription,
  IconFileText,
  IconFileTypePdf,
  IconFileUpload,
  IconFlask,
  IconHandClick,
  IconHeading,
  IconHelp,
  IconHistory,
  IconHome,
  IconHourglass,
  IconInfoCircle,
  IconItalic,
  IconKey,
  IconLayoutDashboard,
  IconLink,
  IconListCheck,
  IconLogin,
  IconMail,
  IconMailForward,
  IconMailOpened,
  IconMenu2,
  IconMessageCircle,
  IconMinus,
  IconMoodSmile,
  IconNotes,
  IconPalette,
  IconPencil,
  IconPhoto,
  IconPlayerPlay,
  IconPlus,
  IconPointFilled,
  IconReceipt,
  IconRefresh,
  IconRestore,
  IconRobot,
  IconRocket,
  IconRosetteDiscountCheck,
  IconRoute,
  IconSchool,
  IconSearch,
  IconSend,
  IconServer,
  IconShare,
  IconShoppingBag,
  IconSitemap,
  IconSnowflake,
  IconSparkles,
  IconSpeakerphone,
  IconTable,
  IconTag,
  IconTrash,
  IconTrophy,
  IconTypography,
  IconUnderline,
  IconUpload,
  IconUserCircle,
  IconUserPlus,
  IconUsersGroup,
  IconVideo,
  IconWand,
  IconWorld,
  IconX
} from '@tabler/icons-react';

// ============================================================================
// Ícones modernos (Tabler) com API compatível com @mui/icons-material.
// Imports estáticos (tree-shakeable). Cada export <NomeMUI>Icon adapta
// fontSize/size/color/sx do MUI para o Tabler.
// ============================================================================

const SIZE = { small: 18, medium: 22, large: 26, inherit: '1em' };
const TOKENS = ['primary', 'secondary', 'error', 'warning', 'info', 'success'];

function resolveColor(theme, c) {
  if (!c) return undefined;
  if (c === 'inherit' || c === 'action' || c === 'disabled') return undefined;
  const pal = (theme.vars || theme).palette;
  if (TOKENS.includes(c)) return pal[c] && pal[c].main;
  if (typeof c === 'string' && c.includes('.')) {
    const [grp, key] = c.split('.');
    if (pal[grp] && pal[grp][key]) return pal[grp][key];
  }
  return c;
}

function mk(Comp) {
  const C = forwardRef(function Icon({ fontSize, size, stroke = 1.6, sx, style, color, ...rest }, ref) {
    const theme = useTheme();
    let s = size;
    if (s == null && sx && typeof sx === 'object' && typeof sx.fontSize === 'number') s = sx.fontSize;
    if (s == null) s = SIZE[fontSize] != null ? SIZE[fontSize] : 20;
    let col = resolveColor(theme, color);
    if (!col && sx && typeof sx === 'object' && sx.color) col = resolveColor(theme, sx.color);
    const st = { ...(style || {}) };
    if (sx && typeof sx === 'object') {
      if (sx.mr != null) st.marginRight = typeof sx.mr === 'number' ? sx.mr * 8 : sx.mr;
      if (sx.ml != null) st.marginLeft = typeof sx.ml === 'number' ? sx.ml * 8 : sx.ml;
    }
    const { titleAccess, ...clean } = rest;
    return createElement(Comp, { ref, size: s, stroke, ...(col ? { color: col } : {}), style: st, ...clean });
  });
  return C;
}

export const AcUnitRoundedIcon = mk(IconSnowflake);
export const AccessTimeRoundedIcon = mk(IconClock);
export const AccountCircleRoundedIcon = mk(IconUserCircle);
export const AccountTreeRoundedIcon = mk(IconSitemap);
export const AccountTreeTwoToneIcon = mk(IconSitemap);
export const AddRoundedIcon = mk(IconPlus);
export const AltRouteRoundedIcon = mk(IconArrowsSplit2);
export const ApiRoundedIcon = mk(IconApi);
export const ArchiveOutlinedIcon = mk(IconArchive);
export const ArrowBackRoundedIcon = mk(IconArrowLeft);
export const ArrowDownwardIcon = mk(IconArrowDown);
export const ArrowDownwardRoundedIcon = mk(IconArrowDown);
export const ArrowForwardRoundedIcon = mk(IconArrowRight);
export const ArrowUpwardIcon = mk(IconArrowUp);
export const ArrowUpwardRoundedIcon = mk(IconArrowUp);
export const ArticleRoundedIcon = mk(IconArticle);
export const AutoAwesomeIcon = mk(IconSparkles);
export const AutoFixHighRoundedIcon = mk(IconWand);
export const AutorenewRoundedIcon = mk(IconRefresh);
export const BlockRoundedIcon = mk(IconBan);
export const BoltRoundedIcon = mk(IconBolt);
export const BrushRoundedIcon = mk(IconBrush);
export const CalendarMonthOutlinedIcon = mk(IconCalendarMonth);
export const CalendarTodayTwoToneIcon = mk(IconCalendar);
export const CampaignRoundedIcon = mk(IconSpeakerphone);
export const ChatOutlinedIcon = mk(IconMessageCircle);
export const CheckCircleRoundedIcon = mk(IconCircleCheck);
export const CheckRoundedIcon = mk(IconCheck);
export const ChevronRightOutlinedIcon = mk(IconChevronRight);
export const CloseRoundedIcon = mk(IconX);
export const CodeIcon = mk(IconCode);
export const CodeRoundedIcon = mk(IconCode);
export const ContentCopyRoundedIcon = mk(IconCopy);
export const CreditCardRoundedIcon = mk(IconCreditCard);
export const DashboardCustomizeRoundedIcon = mk(IconLayoutDashboard);
export const DataObjectRoundedIcon = mk(IconBraces);
export const DeleteOutlineRoundedIcon = mk(IconTrash);
export const DeleteRoundedIcon = mk(IconTrash);
export const DescriptionRoundedIcon = mk(IconFileDescription);
export const DnsRoundedIcon = mk(IconServer);
export const DomainRoundedIcon = mk(IconWorld);
export const DownloadRoundedIcon = mk(IconDownload);
export const EditRoundedIcon = mk(IconPencil);
export const EmailOutlinedIcon = mk(IconMail);
export const EmailRoundedIcon = mk(IconMail);
export const EmojiEmotionsRoundedIcon = mk(IconMoodSmile);
export const EmojiEventsRoundedIcon = mk(IconTrophy);
export const ErrorOutlineRoundedIcon = mk(IconAlertCircle);
export const EventBusyRoundedIcon = mk(IconCalendarOff);
export const EventRoundedIcon = mk(IconCalendarEvent);
export const ExpandMoreIcon = mk(IconChevronDown);
export const ExpandMoreRoundedIcon = mk(IconChevronDown);
export const FiberManualRecordIcon = mk(IconPointFilled);
export const FileCopyOutlinedIcon = mk(IconCopy);
export const FileDownloadRoundedIcon = mk(IconDownload);
export const FileUploadRoundedIcon = mk(IconUpload);
export const FormatAlignCenterRoundedIcon = mk(IconAlignCenter);
export const FormatAlignLeftRoundedIcon = mk(IconAlignLeft);
export const FormatAlignRightRoundedIcon = mk(IconAlignRight);
export const FormatBoldIcon = mk(IconBold);
export const FormatBoldRoundedIcon = mk(IconBold);
export const FormatItalicIcon = mk(IconItalic);
export const FormatItalicRoundedIcon = mk(IconItalic);
export const FormatUnderlinedIcon = mk(IconUnderline);
export const FormatUnderlinedRoundedIcon = mk(IconUnderline);
export const ForwardToInboxRoundedIcon = mk(IconMailForward);
export const GetAppOutlinedIcon = mk(IconDownload);
export const GroupsRoundedIcon = mk(IconUsersGroup);
export const HeightRoundedIcon = mk(IconArrowsVertical);
export const HelpOutlineIcon = mk(IconHelp);
export const HelpOutlineRoundedIcon = mk(IconHelp);
export const HistoryRoundedIcon = mk(IconHistory);
export const HomeIcon = mk(IconHome);
export const HomeTwoToneIcon = mk(IconHome);
export const HorizontalRuleRoundedIcon = mk(IconMinus);
export const HourglassBottomRoundedIcon = mk(IconHourglass);
export const ImageIcon = mk(IconPhoto);
export const ImageOutlinedIcon = mk(IconPhoto);
export const ImageRoundedIcon = mk(IconPhoto);
export const InfoOutlinedIcon = mk(IconInfoCircle);
export const InsightsRoundedIcon = mk(IconChartLine);
export const InstagramIcon = mk(IconBrandInstagram);
export const KeyRoundedIcon = mk(IconKey);
export const KeyboardArrowDownOutlinedIcon = mk(IconChevronDown);
export const KeyboardArrowUpOutlinedIcon = mk(IconChevronUp);
export const LinkRoundedIcon = mk(IconLink);
export const LocalMallOutlinedIcon = mk(IconShoppingBag);
export const LoginRoundedIcon = mk(IconLogin);
export const MailOutlineRoundedIcon = mk(IconMail);
export const MailRoundedIcon = mk(IconMail);
export const MarkEmailReadRoundedIcon = mk(IconMailOpened);
export const MenuIcon = mk(IconMenu2);
export const MonitorHeartRoundedIcon = mk(IconActivityHeartbeat);
export const MoreHorizIcon = mk(IconDots);
export const MoreHorizOutlinedIcon = mk(IconDots);
export const NorthEastRoundedIcon = mk(IconArrowUpRight);
export const NotesRoundedIcon = mk(IconNotes);
export const OndemandVideoOutlinedIcon = mk(IconVideo);
export const OpenInNewRoundedIcon = mk(IconExternalLink);
export const PaletteRoundedIcon = mk(IconPalette);
export const PersonAddAlt1RoundedIcon = mk(IconUserPlus);
export const PictureAsPdfOutlinedIcon = mk(IconFileTypePdf);
export const PlayArrowIcon = mk(IconPlayerPlay);
export const PreviewRoundedIcon = mk(IconEye);
export const QueryStatsRoundedIcon = mk(IconChartDots);
export const QuizRoundedIcon = mk(IconListCheck);
export const ReceiptLongRoundedIcon = mk(IconReceipt);
export const RefreshRoundedIcon = mk(IconRefresh);
export const RemoveRedEyeIcon = mk(IconEye);
export const RestartAltRoundedIcon = mk(IconRestore);
export const RocketLaunchRoundedIcon = mk(IconRocket);
export const RouteRoundedIcon = mk(IconRoute);
export const SaveRoundedIcon = mk(IconDeviceFloppy);
export const ScheduleRoundedIcon = mk(IconClock);
export const SchoolOutlinedIcon = mk(IconSchool);
export const ScienceRoundedIcon = mk(IconFlask);
export const SearchIcon = mk(IconSearch);
export const SearchRoundedIcon = mk(IconSearch);
export const SellRoundedIcon = mk(IconTag);
export const SendRoundedIcon = mk(IconSend);
export const ShareRoundedIcon = mk(IconShare);
export const ShuffleRoundedIcon = mk(IconArrowsShuffle);
export const SmartButtonRoundedIcon = mk(IconClick);
export const SmartToyRoundedIcon = mk(IconRobot);
export const SouthWestRoundedIcon = mk(IconArrowDownLeft);
export const SubjectRoundedIcon = mk(IconAlignJustified);
export const SyncRoundedIcon = mk(IconRefresh);
export const TableChartOutlinedIcon = mk(IconTable);
export const TextFieldsRoundedIcon = mk(IconTypography);
export const TextSnippetRoundedIcon = mk(IconFileText);
export const TitleRoundedIcon = mk(IconHeading);
export const TodayRoundedIcon = mk(IconCalendar);
export const TouchAppRoundedIcon = mk(IconHandClick);
export const TuneRoundedIcon = mk(IconAdjustments);
export const UploadFileRoundedIcon = mk(IconFileUpload);
export const UploadRoundedIcon = mk(IconUpload);
export const VerifiedRoundedIcon = mk(IconRosetteDiscountCheck);
export const ViewColumnRoundedIcon = mk(IconColumns);
export const VisibilityIcon = mk(IconEye);
export const VisibilityOffIcon = mk(IconEyeOff);
export const VisibilityRoundedIcon = mk(IconEye);
export const VpnKeyRoundedIcon = mk(IconKey);
export const WhatsAppIcon = mk(IconBrandWhatsapp);
export const WorkspacesRoundedIcon = mk(IconCategory);
export const YouTubeIcon = mk(IconBrandYoutube);
