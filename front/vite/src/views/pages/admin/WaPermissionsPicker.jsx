// =============================================================================
// Sub-permissões do módulo WhatsApp (Fase 7, contrato §11.5) — Administração → Usuários.
// Guardadas em `users.modules` junto com os módulos: 'whatsapp:finance' | 'whatsapp:crm' |
// 'whatsapp:settings'; nenhuma marcada → manda 'whatsapp:basic' (sem o marcador o back dá as três).
// OWNER/ADMIN/SUPER_ADMIN têm todas sempre (o picker vira só uma nota).
// =============================================================================
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { WA_SUB_KEYS, WA_SUB_MARKER, WA_SUB_PERMISSIONS, permissionLabel } from 'views/pages/access/modules';
import { roleSeesAllNumbers } from './WhatsAppNumbersPicker';

/** Lista crua (de `user.permissions` ou de `user.modules`) → sub-permissões conhecidas, na ordem. */
export const normalizeWaPerms = (raw) => WA_SUB_KEYS.filter((k) => Array.isArray(raw) && raw.includes(k));

/** Permissões iniciais de um usuário: `permissions` do back; sem o campo (back antigo) = todas. */
export const initialWaPerms = (user) => (Array.isArray(user?.permissions) ? normalizeWaPerms(user.permissions) : [...WA_SUB_KEYS]);

/**
 * `modules` do payload: módulos + sub-permissões (+ marcador quando nenhuma) — SEMPRE que tiver WhatsApp,
 * senão o back entende "sem escolha" e libera as três.
 */
export const modulesWithWaPerms = (modules, perms) => {
  const mods = Array.isArray(modules) ? modules.filter((m) => !String(m).startsWith('whatsapp:')) : [];
  if (!mods.includes('whatsapp')) return mods;
  const p = normalizeWaPerms(perms);
  return [...mods, ...(p.length ? p : [WA_SUB_MARKER])];
};

export const sameWaPerms = (a, b) => normalizeWaPerms(a).join(',') === normalizeWaPerms(b).join(',');

export default function WaPermissionsPicker({ role, value, onChange, disabled }) {
  if (roleSeesAllNumbers(role)) {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Donos e admins têm todas as permissões do WhatsApp (cobranças, clientes e configurações).
      </Typography>
    );
  }
  const sel = normalizeWaPerms(value);
  const toggle = (k, on) => onChange(normalizeWaPerms(on ? [...sel, k] : sel.filter((x) => x !== k)));
  return (
    <Box>
      <Box sx={{ display: 'grid', gap: 0.5 }}>
        {WA_SUB_PERMISSIONS.map((p) => (
          <FormControlLabel
            key={p.key}
            disabled={disabled}
            sx={{ alignItems: 'flex-start', mr: 0, '& .MuiCheckbox-root': { pt: 0.5 } }}
            control={<Checkbox size="small" checked={sel.includes(p.key)} onChange={(e) => toggle(p.key, e.target.checked)} />}
            label={
              <Box sx={{ pt: 0.5, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                  {p.label}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }}>
                  {p.hint}
                </Typography>
              </Box>
            }
          />
        ))}
      </Box>
      {!sel.length ? (
        <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.5 }}>
          Só o básico: chat, contatos, funil, tarefas, agenda e chamados — sem cobranças, clientes nem configurações.
        </Typography>
      ) : null}
    </Box>
  );
}

/** Resumo para a tabela de usuários (só para MEMBER com WhatsApp; todas = nada a mostrar). */
export function WaPermsChip({ user }) {
  if (!user || roleSeesAllNumbers(user.role) || !Array.isArray(user.modules) || !user.modules.includes('whatsapp')) return null;
  const perms = initialWaPerms(user);
  if (perms.length === WA_SUB_KEYS.length) return null;
  const short = { 'whatsapp:finance': 'Cobranças', 'whatsapp:crm': 'Clientes', 'whatsapp:settings': 'Config.' };
  const label = perms.length ? `WA: ${perms.map((p) => short[p] || p).join(' · ')}` : 'WA: só básico';
  return (
    <Tooltip
      arrow
      title={
        <Stack spacing={0.25}>
          {WA_SUB_PERMISSIONS.map((p) => (
            <span key={p.key}>
              {perms.includes(p.key) ? '✓' : '✕'} {permissionLabel(p.key)}
            </span>
          ))}
        </Stack>
      }
    >
      <Chip
        size="small"
        variant="outlined"
        color="warning"
        label={label}
        sx={{ height: 20, fontSize: 11, fontWeight: 700, maxWidth: '100%' }}
      />
    </Tooltip>
  );
}
