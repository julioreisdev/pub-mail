import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconAlertTriangle, IconCircleCheck, IconPaperclip, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';

import { get, post } from 'api/api';
import { WaNumberSelect, fmtBytes, sessionLabel, useWaSessions } from '../waKit';
import { errMsg, tint } from '../waShared';
import { ENT_KINDS } from './EntitlementsList';

// ============================================================================
// Editor das regras "Ao pagar, liberar…" de um produto recorrente (Fase 5).
// Grava em `product.entitlement = { rules: Rule[] }` (o back normaliza):
//   Rule = { id, kind: group_member|tag|digital_file|external, label?, session_id?, ref,
//            on_overdue: keep|suspend, suspend_after_days 0..60, on_cancel: revoke|keep, invite_fallback }
// group_member: ref = jid do grupo (…@g.us), session_id = número que é ADMIN do grupo.
// tag: ref = id da etiqueta. digital_file: ref = id da mídia (POST /whatsapp/media). external: chave livre.
// ============================================================================

export const MAX_RULES = 10;
const KIND_ORDER = ['group_member', 'tag', 'digital_file', 'external'];
const KIND_HINT = {
  group_member: 'Adiciona o cliente num grupo e tira quando suspende ou cancela.',
  tag: 'Põe uma etiqueta nas conversas do cliente.',
  digital_file: 'Manda um arquivo (PDF, e-book, zip) na conversa ao liberar.',
  external: 'Só avisa o seu sistema (webhook "entitlement.*"), sem ação no WhatsApp.'
};

const ruleId = () => {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 8; i += 1) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
};

/** Lê `product.entitlement` (aceita o legado: array solto ou objeto sem `rules`). */
export const rulesOf = (entitlement) => {
  const raw = Array.isArray(entitlement) ? entitlement : Array.isArray(entitlement?.rules) ? entitlement.rules : [];
  return raw
    .filter((r) => r && typeof r === 'object' && ENT_KINDS[r.kind])
    .slice(0, MAX_RULES)
    .map((r) => ({
      id: /^[a-z0-9]{8}$/.test(String(r.id || '')) ? r.id : ruleId(),
      kind: r.kind,
      label: String(r.label || ''),
      session_id: r.session_id || '',
      ref: String(r.ref || ''),
      file_name: r.file_name || '',
      on_overdue: r.on_overdue === 'keep' ? 'keep' : 'suspend',
      suspend_after_days: Number.isFinite(Number(r.suspend_after_days)) ? Math.min(60, Math.max(0, Number(r.suspend_after_days))) : 3,
      on_cancel: r.on_cancel === 'keep' ? 'keep' : 'revoke',
      invite_fallback: r.invite_fallback !== false
    }));
};

export const newRule = (kind) => ({
  id: ruleId(),
  kind,
  label: '',
  session_id: '',
  ref: '',
  file_name: '',
  on_overdue: 'suspend',
  suspend_after_days: 3,
  on_cancel: 'revoke',
  invite_fallback: true
});

/** Regras → corpo do PUT (sem campos de tela). Devolve `{ rules, error }`. */
export const rulesPayload = (rules) => {
  const out = [];
  for (const [i, r] of (rules || []).entries()) {
    const n = i + 1;
    if (r.kind === 'group_member' && (!r.session_id || !r.ref)) return { error: `Acesso ${n}: escolha o número e o grupo.` };
    if (r.kind === 'tag' && !r.ref) return { error: `Acesso ${n}: escolha a etiqueta.` };
    if (r.kind === 'digital_file' && !r.ref) return { error: `Acesso ${n}: envie o arquivo.` };
    if (r.kind === 'external' && !r.ref) return { error: `Acesso ${n}: dê uma chave à integração.` };
    const rule = {
      id: r.id,
      kind: r.kind,
      label: String(r.label || '')
        .trim()
        .slice(0, 120),
      ref: r.ref,
      on_overdue: r.on_overdue,
      suspend_after_days: r.suspend_after_days,
      on_cancel: r.on_cancel
    };
    if (r.kind === 'group_member') {
      rule.session_id = r.session_id;
      rule.invite_fallback = Boolean(r.invite_fallback);
    }
    if (r.kind === 'digital_file' && r.file_name) rule.file_name = r.file_name;
    out.push(rule);
  }
  return { rules: out, error: null };
};

/** Resumo curto (seção recolhida e cartão do produto). */
export const rulesSummary = (rules) => {
  if (!rules?.length) return 'Nada liberado automaticamente';
  const names = rules.map((r) => r.label || ENT_KINDS[r.kind]?.label || r.kind);
  return `${rules.length} acesso${rules.length === 1 ? '' : 's'}: ${names.join(', ')}`;
};

// ----------------------------------------------------------------------------
// Grupo do WhatsApp: número → grupo → conferência de admin
// ----------------------------------------------------------------------------
function GroupFields({ rule, set, sessions, groupsCache, loadGroups }) {
  const groups = rule.session_id ? groupsCache[rule.session_id] : null;
  const [check, setCheck] = useState(null); // null | 'loading' | {is_admin, name, participants_count} | {error}
  const seq = useRef(0);

  useEffect(() => {
    if (rule.session_id && groupsCache[rule.session_id] === undefined) loadGroups(rule.session_id);
  }, [rule.session_id, groupsCache, loadGroups]);

  const runCheck = async () => {
    if (!rule.session_id || !rule.ref) {
      setCheck(null);
      return;
    }
    const s = ++seq.current;
    setCheck('loading');
    try {
      const r = await get(`/whatsapp/groups/${encodeURIComponent(rule.ref)}/admin-check?session_id=${encodeURIComponent(rule.session_id)}`);
      if (s === seq.current) setCheck(r || { error: 'Sem resposta.' });
    } catch (e) {
      if (s === seq.current) setCheck({ error: errMsg(e, 'Não foi possível conferir o grupo.') });
    }
  };
  useEffect(() => {
    runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule.session_id, rule.ref]);

  const list = Array.isArray(groups) ? groups : [];
  const known = list.some((g) => g.jid === rule.ref);
  const sessionName = sessions.find((s) => s.id === rule.session_id);

  return (
    <Stack spacing={1.25}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
        <WaNumberSelect
          sessions={sessions}
          value={rule.session_id}
          onChange={(v) => set({ session_id: v, ref: '' })}
          label="Número (administrador do grupo)"
        />
        <TextField
          select
          size="small"
          fullWidth
          label="Grupo"
          value={known || !rule.ref ? rule.ref : '__unknown'}
          disabled={!rule.session_id || groups === null}
          onChange={(e) => {
            const g = list.find((x) => x.jid === e.target.value);
            if (!g) return;
            set({ ref: g.jid, ...(rule.label ? {} : { label: String(g.name || '').slice(0, 120) }) });
          }}
          helperText={!rule.session_id ? 'Escolha o número primeiro.' : groups === null ? 'Carregando grupos…' : null}
          InputProps={{
            endAdornment:
              rule.session_id && groups !== null ? (
                <InputAdornment position="end" sx={{ mr: 2 }}>
                  <Tooltip title="Recarregar grupos">
                    <IconButton size="small" onClick={() => loadGroups(rule.session_id)} aria-label="Recarregar grupos">
                      <IconRefresh size={15} />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ) : null
          }}
        >
          {rule.ref && !known ? (
            <MenuItem value="__unknown" disabled>
              {rule.label || rule.ref} (não encontrado neste número)
            </MenuItem>
          ) : null}
          {list.map((g) => (
            <MenuItem key={g.jid} value={g.jid}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {g.name || g.jid}
                </Typography>
                {g.participants_count != null ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {g.participants_count} participantes
                  </Typography>
                ) : null}
              </Stack>
            </MenuItem>
          ))}
          {!list.length ? (
            <MenuItem value="__none" disabled>
              Nenhum grupo neste número
            </MenuItem>
          ) : null}
        </TextField>
      </Stack>

      {rule.ref && rule.session_id ? (
        check === 'loading' ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <CircularProgress size={12} /> Conferindo se o número é administrador do grupo…
          </Typography>
        ) : check?.error ? (
          <Alert
            severity="warning"
            sx={{ borderRadius: 2, py: 0.25 }}
            action={
              <Button size="small" onClick={runCheck}>
                Conferir
              </Button>
            }
          >
            {check.error}
          </Alert>
        ) : check && check.is_admin === false ? (
          <Alert
            severity="warning"
            icon={<IconAlertTriangle size={18} />}
            sx={{ borderRadius: 2, py: 0.25 }}
            action={
              <Button size="small" onClick={runCheck}>
                Conferir de novo
              </Button>
            }
          >
            O número precisa ser administrador do grupo
            {sessionName ? ` (${sessionLabel(sessionName)})` : ''}. Sem isso ninguém é adicionado nem removido.
          </Alert>
        ) : check && check.is_admin ? (
          <Typography variant="caption" sx={{ color: 'success.main', display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600 }}>
            <IconCircleCheck size={14} /> O número é administrador
            {check.participants_count != null ? ` · ${check.participants_count} participantes` : ''}
          </Typography>
        ) : null
      ) : null}

      <Box>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Switch size="small" checked={rule.invite_fallback} onChange={(e) => set({ invite_fallback: e.target.checked })} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Se não der para adicionar, mandar o link de convite
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', pl: 5.5 }}>
          Quem só aceita entrar em grupos por convite (privacidade do WhatsApp) recebe o link na conversa.
        </Typography>
      </Box>
    </Stack>
  );
}

// ----------------------------------------------------------------------------
// Arquivo digital: upload → id da mídia
// ----------------------------------------------------------------------------
function FileFields({ rule, set }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const upload = async (file) => {
    if (!file) return;
    if (file.size > 64 * 1024 * 1024) {
      toast.error('Arquivo grande demais (máx. 64 MB).');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await post('/whatsapp/media', fd, {
        headers: { 'Content-Type': undefined },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
      if (!res?.id) throw new Error('O servidor não devolveu o arquivo.');
      const name = res.filename || file.name;
      set({ ref: res.id, file_name: name, ...(rule.label ? {} : { label: name.replace(/\.[^.]+$/, '').slice(0, 120) }) });
      toast.success(`Arquivo enviado (${fmtBytes(res.size ?? file.size)}).`);
    } catch (e) {
      toast.error(errMsg(e, 'Falha no envio do arquivo.'));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          upload(f);
        }}
      />
      <Button
        size="small"
        variant="outlined"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        startIcon={uploading ? <CircularProgress size={13} /> : <IconPaperclip size={15} />}
        sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
      >
        {uploading ? `Enviando… ${progress}%` : rule.ref ? 'Trocar arquivo' : 'Enviar arquivo'}
      </Button>
      <Typography variant="body2" sx={{ color: rule.ref ? 'text.primary' : 'text.secondary', minWidth: 0 }} noWrap title={rule.file_name}>
        {rule.ref ? rule.file_name || `Arquivo ${rule.ref.slice(0, 8)}…` : 'Nenhum arquivo ainda'}
      </Typography>
    </Stack>
  );
}

// ----------------------------------------------------------------------------
// Cartão de uma regra
// ----------------------------------------------------------------------------
function RuleCard({ rule, index, onChange, onRemove, sessions, tags, groupsCache, loadGroups }) {
  const kind = ENT_KINDS[rule.kind];
  const Icon = kind.icon;
  const set = (p) => onChange({ ...rule, ...p });
  return (
    <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 0 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1.5,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            color: 'primary.main',
            bgcolor: (t) => tint(t, 'primary', 0.1)
          }}
        >
          <Icon size={16} />
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 800, flex: 1, minWidth: 0 }} noWrap>
          {index + 1}. {kind.label}
        </Typography>
        <Tooltip title="Remover este acesso">
          <IconButton size="small" onClick={onRemove} aria-label="Remover acesso">
            <IconTrash size={16} />
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack spacing={1.25}>
        <TextField
          size="small"
          fullWidth
          label="Nome do acesso (aparece para o cliente)"
          value={rule.label}
          onChange={(e) => set({ label: e.target.value.slice(0, 120) })}
          placeholder={
            rule.kind === 'group_member'
              ? 'Ex.: Grupo VIP'
              : rule.kind === 'digital_file'
                ? 'Ex.: E-book do curso'
                : rule.kind === 'tag'
                  ? 'Ex.: Cliente Premium'
                  : 'Ex.: Área de membros'
          }
        />

        {rule.kind === 'group_member' ? (
          <GroupFields rule={rule} set={set} sessions={sessions} groupsCache={groupsCache} loadGroups={loadGroups} />
        ) : null}

        {rule.kind === 'tag' ? (
          <TextField
            select
            size="small"
            fullWidth
            label="Etiqueta"
            value={tags === null ? '' : rule.ref}
            disabled={tags === null}
            onChange={(e) => {
              const t = (tags || []).find((x) => x.id === e.target.value);
              set({ ref: e.target.value, ...(rule.label || !t ? {} : { label: String(t.name || '').slice(0, 120) }) });
            }}
            helperText={tags === null ? 'Carregando etiquetas…' : 'Vale em todas as conversas do cliente, em todos os números.'}
          >
            {(tags || []).map((t) => (
              <MenuItem key={t.id} value={t.id}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: t.color || '#64748B' }} />
                  <span>{t.name}</span>
                </Stack>
              </MenuItem>
            ))}
            {tags && rule.ref && !tags.some((t) => t.id === rule.ref) ? (
              <MenuItem value={rule.ref} disabled>
                Etiqueta apagada
              </MenuItem>
            ) : null}
            {tags && !tags.length ? (
              <MenuItem value="__none" disabled>
                Nenhuma etiqueta — crie em WhatsApp → Configurações
              </MenuItem>
            ) : null}
          </TextField>
        ) : null}

        {rule.kind === 'digital_file' ? <FileFields rule={rule} set={set} /> : null}

        {rule.kind === 'external' ? (
          <TextField
            size="small"
            fullWidth
            label="Chave da integração"
            value={rule.ref}
            onChange={(e) => set({ ref: e.target.value.replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 64) })}
            placeholder="Ex.: area_membros, curso:premium"
            helperText='Vai no webhook "entitlement.*" para o seu sistema saber o que liberar. Letras, números e _ . : -'
            InputProps={{ sx: { fontFamily: 'monospace' } }}
          />
        ) : null}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <TextField
            select
            size="small"
            fullWidth
            label="Em atraso"
            value={rule.on_overdue}
            onChange={(e) => set({ on_overdue: e.target.value })}
          >
            <MenuItem value="suspend">Suspender</MenuItem>
            <MenuItem value="keep">Manter liberado</MenuItem>
          </TextField>
          {rule.on_overdue === 'suspend' ? (
            <TextField
              size="small"
              type="number"
              fullWidth
              label="Suspender após"
              value={rule.suspend_after_days}
              onChange={(e) => {
                const n = parseInt(e.target.value || '0', 10);
                set({ suspend_after_days: Number.isFinite(n) ? Math.min(60, Math.max(0, n)) : 0 });
              }}
              inputProps={{ min: 0, max: 60, inputMode: 'numeric' }}
              InputProps={{ endAdornment: <InputAdornment position="end">dias de atraso</InputAdornment> }}
            />
          ) : null}
          <TextField
            select
            size="small"
            fullWidth
            label="Ao cancelar"
            value={rule.on_cancel}
            onChange={(e) => set({ on_cancel: e.target.value })}
          >
            <MenuItem value="revoke">Revogar</MenuItem>
            <MenuItem value="keep">Manter (acesso vitalício)</MenuItem>
          </TextField>
        </Stack>
        {rule.kind === 'digital_file' && rule.on_overdue === 'suspend' ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Arquivo já enviado não volta: suspender/revogar só muda a situação (e avisa o seu sistema pelo webhook).
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}

// ============================================================================
export default function EntitlementRulesEditor({ rules, onChange }) {
  const { sessions } = useWaSessions(0);
  const [tags, setTags] = useState(null);
  const [groupsCache, setGroupsCache] = useState({}); // session_id → array | null (carregando)
  const [anchor, setAnchor] = useState(null);
  const list = rules || [];

  const needsTags = list.some((r) => r.kind === 'tag');
  useEffect(() => {
    if (!needsTags || tags !== null) return;
    get('/whatsapp/tags')
      .then((r) => setTags((Array.isArray(r) ? r : r?.items || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))))
      .catch(() => setTags([]));
  }, [needsTags, tags]);

  const loadGroups = async (sid) => {
    setGroupsCache((c) => ({ ...c, [sid]: null }));
    try {
      const r = await get(`/whatsapp/groups?session_id=${encodeURIComponent(sid)}`);
      const arr = Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : [];
      setGroupsCache((c) => ({ ...c, [sid]: arr.filter((g) => !g.session_id || g.session_id === sid) }));
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível carregar os grupos.'));
      setGroupsCache((c) => ({ ...c, [sid]: [] }));
    }
  };

  const add = (kind) => {
    setAnchor(null);
    if (list.length >= MAX_RULES) return;
    const r = newRule(kind);
    if (kind === 'group_member' && sessions.length === 1) r.session_id = sessions[0].id;
    onChange([...list, r]);
  };

  return (
    <Stack spacing={1.25}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        O que o cliente ganha enquanto a assinatura está em dia. Libera sozinho ao pagar (ou no teste grátis), suspende no atraso e revoga
        ao cancelar — conforme as escolhas de cada acesso.
      </Typography>
      {list.map((r, i) => (
        <RuleCard
          key={r.id}
          rule={r}
          index={i}
          sessions={sessions}
          tags={tags}
          groupsCache={groupsCache}
          loadGroups={loadGroups}
          onChange={(nr) => onChange(list.map((x) => (x.id === r.id ? nr : x)))}
          onRemove={() => onChange(list.filter((x) => x.id !== r.id))}
        />
      ))}
      <Box>
        <Button
          size="small"
          startIcon={<IconPlus size={16} />}
          onClick={(e) => setAnchor(e.currentTarget)}
          disabled={list.length >= MAX_RULES}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {list.length >= MAX_RULES ? `Máximo de ${MAX_RULES} acessos` : 'Adicionar acesso'}
        </Button>
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
          {KIND_ORDER.map((k) => {
            const K = ENT_KINDS[k];
            const KIcon = K.icon;
            return (
              <MenuItem key={k} onClick={() => add(k)} sx={{ maxWidth: 360, whiteSpace: 'normal' }}>
                <ListItemIcon>
                  <KIcon size={18} />
                </ListItemIcon>
                <ListItemText
                  primary={K.label}
                  secondary={KIND_HINT[k]}
                  primaryTypographyProps={{ fontWeight: 700, fontSize: 14 }}
                  secondaryTypographyProps={{ fontSize: 12 }}
                />
              </MenuItem>
            );
          })}
        </Menu>
      </Box>
    </Stack>
  );
}
