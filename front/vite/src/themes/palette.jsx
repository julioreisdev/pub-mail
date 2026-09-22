// project imports
import { extendPaletteWithChannels } from 'utils/colorUtils';

// assets
import defaultColor from './theme/default';

// ==============================|| DEFAULT THEME - PALETTE (light + dark) ||============================== //

export function buildPalette(presetColor) {
  let colors;
  switch (presetColor) {
    case 'default':
    default:
      colors = defaultColor;
  }

  // ---------------------------------------------------------------- LIGHT
  const lightColors = {
    primary: {
      light: colors.primaryLight,
      main: colors.primaryMain,
      dark: colors.primaryDark,
      200: colors.primary200,
      800: colors.primary800
    },
    secondary: {
      light: colors.secondaryLight,
      main: colors.secondaryMain,
      dark: colors.secondaryDark,
      200: colors.secondary200,
      800: colors.secondary800
    },
    error: {
      light: colors.errorLight,
      main: colors.errorMain,
      dark: colors.errorDark
    },
    orange: {
      light: colors.orangeLight,
      main: colors.orangeMain,
      dark: colors.orangeDark
    },
    warning: {
      light: colors.warningLight,
      main: colors.warningMain,
      dark: colors.warningDark,
      contrastText: colors.grey700
    },
    success: {
      light: colors.successLight,
      200: colors.success200,
      main: colors.successMain,
      dark: colors.successDark
    },
    grey: {
      50: colors.grey50,
      100: colors.grey100,
      200: colors.grey200,
      300: colors.grey300,
      500: colors.grey500,
      600: colors.grey600,
      700: colors.grey700,
      900: colors.grey900
    },
    dark: {
      light: colors.darkTextPrimary,
      main: colors.darkLevel1,
      dark: colors.darkLevel2,
      800: colors.darkBackground,
      900: colors.darkPaper
    },
    text: {
      primary: colors.grey700,
      secondary: colors.grey500,
      dark: colors.grey900,
      hint: colors.grey100,
      heading: colors.grey900
    },
    divider: colors.grey200,
    background: {
      // page levemente cinza + cards brancos = profundidade (não mais "tudo branco")
      paper: colors.paper,
      default: colors.grey50
    }
  };

  // ---------------------------------------------------------------- DARK
  const darkColors = {
    mode: 'dark',
    primary: {
      light: colors.darkPrimaryLight,
      main: colors.darkPrimaryMain,
      dark: colors.darkPrimaryDark,
      200: colors.darkPrimary200,
      800: colors.darkPrimary800
    },
    secondary: {
      light: colors.darkSecondaryLight,
      main: colors.darkSecondaryMain,
      dark: colors.darkSecondaryDark,
      200: colors.darkSecondary200,
      800: colors.darkSecondary800
    },
    error: {
      light: colors.darkErrorLight,
      main: colors.errorMain,
      dark: colors.errorDark
    },
    orange: {
      light: colors.darkOrangeLight,
      main: colors.orangeMain,
      dark: colors.orangeDark
    },
    warning: {
      light: colors.darkWarningLight,
      main: colors.warningMain,
      dark: colors.warningDark,
      contrastText: '#1a1a1a'
    },
    success: {
      light: colors.darkSuccessLight,
      200: colors.success200,
      main: colors.successMain,
      dark: colors.successDark
    },
    // grey invertido p/ o dark (900 = quase branco, 100/200 = superfícies/bordas escuras)
    grey: {
      50: colors.darkGrey50,
      100: colors.darkGrey100,
      200: colors.darkGrey200,
      300: colors.darkGrey300,
      400: '#5b6b86',
      500: colors.darkGrey500,
      600: colors.darkGrey600,
      700: colors.darkGrey700,
      800: '#e6ecf4',
      900: colors.darkGrey900
    },
    dark: {
      light: colors.darkTextPrimary,
      main: colors.darkLevel1,
      dark: colors.darkLevel2,
      800: colors.darkBackground,
      900: colors.darkPaper
    },
    text: {
      primary: colors.darkTextPrimary,
      secondary: colors.darkTextSecondary,
      disabled: colors.darkTextDisabled,
      dark: colors.darkTextTitle,
      hint: colors.darkGrey100,
      heading: colors.darkTextTitle
    },
    divider: colors.darkDivider,
    background: {
      paper: colors.darkPaper,
      default: colors.darkBackground
    }
  };

  const lightCommon = { common: { black: '#0b1120', white: '#ffffff' } };
  const darkCommon = { common: { black: '#000000', white: '#ffffff' } };

  return {
    light: {
      mode: 'light',
      ...extendPaletteWithChannels(lightCommon),
      ...extendPaletteWithChannels(lightColors)
    },
    dark: {
      mode: 'dark',
      ...extendPaletteWithChannels(darkCommon),
      ...extendPaletteWithChannels(darkColors)
    }
  };
}
