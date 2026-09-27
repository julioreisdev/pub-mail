// =============================================================================
// ModulesPicker — seletor de módulos de acesso do usuário (Administração).
// Reusado em Usuários (Novo cliente / Editar / Acesso) e em Pagamentos.
// Dark-mode: só tokens e theme.vars (nunca theme.palette em callback sx).
// =============================================================================
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';

import { IconMailBolt, IconMessageChatbot, IconListLetters, IconBrandTelegram, IconSettings, IconCheck } from '@tabler/icons-react';

export const MODULE_DEFS = [
  {
    key: 'email',
    label: 'E-mail Marketing',
    short: 'EM',
    description: 'Projetos, templates, automações',
    Icon: IconMailBolt,
    color: 'primary'
  },
  { key: 'webchat', label: 'Webchat', short: 'WC', description: 'Chat com IA, funis e vendas', Icon: IconMessageChatbot, color: 'info' },
  { key: 'quiz', label: 'Quizzes', short: 'QZ', description: 'Quizzes e captação', Icon: IconListLetters, color: 'secondary' },
  { key: 'telegram', label: 'Telegram', short: 'TG', description: 'Bots, broadcasts e VIP', Icon: IconBrandTelegram, color: 'info' },
  {
    key: 'settings',
    label: 'Configurações',
    short: 'CF',
    description: 'Conta, domínios, integrações e chaves',
    Icon: IconSettings,
    color: 'warning'
  }
];

export const ALL_MODULE_KEYS = MODULE_DEFS.map((m) => m.key);
const DEF_BY_KEY = Object.fromEntries(MODULE_DEFS.map((m) => [m.key, m]));

const tint = (theme, token, a) => `rgba(${theme.vars.palette[token].mainChannel} / ${a})`;

/** Ordena as chaves na ordem canônica e descarta desconhecidas. */
export const normalizeModules = (list) => ALL_MODULE_KEYS.filter((k) => Array.isArray(list) && list.includes(k));

/**
 * Chips compactos (para tabelas): rótulo curto + tooltip com o nome completo.
 * Vazio → "—".
 */
export function ModuleChips({ value, size = 'small' }) {
  const keys = normalizeModules(value);
  if (keys.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        —
      </Typography>
    );
  }
  const all = keys.length === ALL_MODULE_KEYS.length;
  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" alignItems="center">
      {keys.map((k) => {
        const d = DEF_BY_KEY[k];
        return (
          <Tooltip key={k} title={d.label} arrow>
            <Chip
              size={size}
              label={d.short}
              icon={<d.Icon size={13} stroke={2} />}
              sx={(t) => ({
                height: 22,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 0.3,
                bgcolor: tint(t, d.color, 0.12),
                color: `${d.color}.main`,
                '& .MuiChip-icon': { color: 'inherit', ml: 0.6 },
                '& .MuiChip-label': { px: 0.75 }
              })}
            />
          </Tooltip>
        );
      })}
      {all ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, ml: 0.25 }}>
          todos
        </Typography>
      ) : null}
    </Stack>
  );
}

/**
 * Picker. `compact` = chips selecionáveis em linha; senão grade de cards.
 * props: value: string[], onChange(next: string[]), compact?, disabled?
 */
export default function ModulesPicker({ value, onChange, compact = false, disabled = false }) {
  const selected = normalizeModules(value);
  const toggle = (key) => {
    if (disabled) return;
    const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
    onChange(normalizeModules(next));
  };
  const allOn = selected.length === ALL_MODULE_KEYS.length;

  if (compact) {
    return (
      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
        {MODULE_DEFS.map((d) => {
          const on = selected.includes(d.key);
          return (
            <Chip
              key={d.key}
              clickable={!disabled}
              onClick={() => toggle(d.key)}
              icon={on ? <IconCheck size={14} stroke={2.4} /> : <d.Icon size={14} stroke={1.9} />}
              label={d.label}
              variant={on ? 'filled' : 'outlined'}
              sx={(t) => ({
                fontWeight: 700,
                borderColor: on ? 'transparent' : 'divider',
                bgcolor: on ? tint(t, d.color, 0.16) : 'transparent',
                color: on ? `${d.color}.main` : 'text.secondary',
                '& .MuiChip-icon': { color: 'inherit' },
                opacity: disabled ? 0.6 : 1
              })}
            />
          );
        })}
      </Stack>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {selected.length === 0
            ? 'Nenhum módulo selecionado'
            : allOn
              ? 'Acesso completo (todos os módulos)'
              : `${selected.length} de ${ALL_MODULE_KEYS.length} módulos`}
        </Typography>
        {!disabled ? (
          <Chip
            size="small"
            variant="outlined"
            clickable
            label={allOn ? 'Limpar' : 'Selecionar todos'}
            onClick={() => onChange(allOn ? [] : [...ALL_MODULE_KEYS])}
            sx={{ height: 22, fontSize: 11, fontWeight: 700 }}
          />
        ) : null}
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
        {MODULE_DEFS.map((d) => {
          const on = selected.includes(d.key);
          return (
            <ButtonBase
              key={d.key}
              disabled={disabled}
              onClick={() => toggle(d.key)}
              aria-pressed={on}
              sx={(t) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                textAlign: 'left',
                p: 1.25,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: on ? `${d.color}.main` : 'divider',
                bgcolor: on ? tint(t, d.color, 0.08) : 'background.paper',
                transition: 'border-color .15s, background-color .15s, box-shadow .15s',
                boxShadow: on ? `0 0 0 3px ${tint(t, d.color, 0.14)}` : 'none',
                '&:hover': { borderColor: on ? `${d.color}.main` : 'text.disabled' },
                opacity: disabled ? 0.65 : 1
              })}
            >
              <Box
                sx={(t) => ({
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  flex: '0 0 auto',
                  color: on ? `${d.color}.main` : 'text.secondary',
                  bgcolor: on ? tint(t, d.color, 0.16) : 'action.selected'
                })}
              >
                <d.Icon size={19} stroke={1.8} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
                  {d.label}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }} noWrap>
                  {d.description}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  flex: '0 0 auto',
                  border: '2px solid',
                  borderColor: on ? `${d.color}.main` : 'divider',
                  bgcolor: on ? `${d.color}.main` : 'transparent',
                  color: `${d.color}.contrastText`,
                  transition: 'all .15s'
                }}
              >
                {on ? <IconCheck size={13} stroke={3} /> : null}
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
