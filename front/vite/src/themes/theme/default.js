// ==============================|| DEFAULT THEME COLORS ||============================== //

const defaultColor = {
  // paper & background
  paper: '#ffffff',

  // primary (base: #377EF0)
  primaryLight: '#eaf2fe',
  primary200: '#9cbef8',
  primaryMain: '#377EF0',
  primaryDark: '#1e5dc8',
  primary800: '#0f3a7a',

  // secondary (analogous violet-blue)
  secondaryLight: '#ebedfd',
  secondary200: '#a3a8f4',
  secondaryMain: '#5b6cf0',
  secondaryDark: '#3848d8',
  secondary800: '#1c2480',

  // success
  successLight: '#dcedc8',
  success200: '#aed581',
  successMain: '#66bb6a',
  successDark: '#388e3c',

  // error
  errorLight: '#ef9a9a',
  errorMain: '#f44336',
  errorDark: '#c62828',

  // orange
  orangeLight: '#fbe9e7',
  orangeMain: '#ffab91',
  orangeDark: '#d84315',

  // warning
  warningLight: '#fff8e1',
  warningMain: '#ffe57f',
  warningDark: '#ffc107',

  // grey
  grey50: '#f8fafc',
  grey100: '#eef2f6',
  grey200: '#e3e8ef',
  grey300: '#cdd5df',
  grey500: '#697586',
  grey600: '#4b5565',
  grey700: '#364152',
  grey900: '#121926',

  // ==============================|| DARK THEME VARIANTS (slate-navy, low eye-strain) ||============================== //

  // superfícies (profundidade: default < paper < level1 < level2)
  darkBackground: '#0b1120', // fundo da página
  darkPaper: '#151d30', // cards / superfícies
  darkLevel1: '#1d2740', // hover / seleção sutil
  darkLevel2: '#25304d', // elevação maior (menus, popovers)

  // texto
  darkTextTitle: '#f1f5f9', // títulos
  darkTextPrimary: '#d7e0ec', // corpo
  darkTextSecondary: '#8fa1bd', // secundário/muted
  darkTextDisabled: '#5b6b86',

  // divisor / bordas no dark
  darkDivider: '#26314a',

  // grey invertido para o dark (mesma semântica do Berry: 900 = "texto escuro",
  // 100/200 = "fundos/bordas claras" — no dark viram claro/escuro respectivamente)
  darkGrey50: '#151d30',
  darkGrey100: '#1b2440',
  darkGrey200: '#26314a',
  darkGrey300: '#3b4a66',
  darkGrey500: '#8fa1bd',
  darkGrey600: '#aab8cc',
  darkGrey700: '#d7e0ec',
  darkGrey900: '#f1f5f9',

  // primary no dark (azul um pouco mais claro p/ contraste em fundo escuro)
  darkPrimaryLight: '#17233c', // tint de fundo (hover/selected/chip)
  darkPrimaryMain: '#5b9bff',
  darkPrimaryDark: '#3b7de0',
  darkPrimary200: '#3d6bb5',
  darkPrimary800: '#9cbef8',

  // secondary no dark (violeta-azul)
  darkSecondaryLight: '#1c2140', // tint de fundo
  darkSecondaryMain: '#8b93f8',
  darkSecondaryDark: '#5b6cf0',
  darkSecondary200: '#4a4f9e',
  darkSecondary800: '#a3a8f4',

  // tints de fundo dos estados semânticos no dark (alerts/chips)
  darkSuccessLight: '#14301f',
  darkErrorLight: '#3a1c1c',
  darkWarningLight: '#3a2f14',
  darkOrangeLight: '#3a2418'
};

export default defaultColor;
