import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { IconUsersGroup, IconBroadcast, IconSearch, IconLink, IconLogout, IconMessage2, IconRefresh, IconUsers, IconBrandTelegram } from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, post } from '../../../api/api';
import SearchSelect from './SearchSelect';
import { TgPageHeader, TgFilterBar, TgCard, TgAvatar, TgStatusPill, TgEmptyState, TgGhostButton, TgConfirmDialog, TgCardGridSkeleton } from './ui';

const errMsg = (e, fb) => {
    const m = e?.response?.data?.message ?? e?.message;
    return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};
const fmtDate = (v) => {
    if (!v) return '—';
    try {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v));
    } catch {
        return '—';
    }
};

export default function TelegramGroups({ kind = 'group' }) {
    const isChannel = kind === 'channel';
    const L = isChannel
        ? {
              title: 'Canais',
              subtitle: 'Canais onde os seus bots são administradores.',
              one: 'canal',
              plural: 'canais',
              privateLabel: 'Canal privado',
              members: 'inscritos',
              leave: 'Sair do canal',
              posts: 'Posts',
              emptyTitle: 'Nenhum canal ainda',
              emptyDesc: 'Adicione o bot como administrador de um canal. Ele aparece aqui automaticamente quando recebe um post.',
              icon: IconBroadcast
          }
        : {
              title: 'Grupos',
              subtitle: 'Grupos onde os seus bots estão.',
              one: 'grupo',
              plural: 'grupos',
              privateLabel: 'Grupo privado',
              members: 'membros',
              leave: 'Sair do grupo',
              posts: 'Mensagens',
              emptyTitle: 'Nenhum grupo ainda',
              emptyDesc: 'Adicione um bot a um grupo (com o bot admin). Ele aparece aqui automaticamente quando recebe uma mensagem.',
              icon: IconUsersGroup
          };
    const listUrl = isChannel ? '/telegram/channels?bot_id=all' : '/telegram/groups?bot_id=all';

    const navigate = useNavigate();
    const [bots, setBots] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [botFilter, setBotFilter] = useState('all');
    const [q, setQ] = useState('');
    const [leaving, setLeaving] = useState(null); // group to confirm leaving
    const [busy, setBusy] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [g, b] = await Promise.all([get(listUrl), get('/telegram/bots')]);
            setGroups(g);
            setBots(b);
        } catch (e) {
            toast.error(errMsg(e, `Falha ao carregar ${L.title.toLowerCase()}.`));
        } finally {
            setLoading(false);
        }
    }, [listUrl, L.title]);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        return groups.filter((g) => {
            if (botFilter !== 'all' && g.bot?.id !== botFilter) return false;
            if (term && !`${g.name} ${g.username || ''}`.toLowerCase().includes(term)) return false;
            return true;
        });
    }, [groups, botFilter, q]);

    const copyInvite = async (g) => {
        setBusy(`inv-${g.id}`);
        try {
            const r = await get(`/telegram/groups/${g.id}/invite-link`);
            await navigator.clipboard.writeText(r.url);
            toast.success('Link de convite copiado!');
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao gerar convite.'));
        } finally {
            setBusy('');
        }
    };

    const confirmLeave = async () => {
        const g = leaving;
        setBusy(`leave-${g.id}`);
        try {
            await post(`/telegram/groups/${g.id}/leave`);
            toast.success(`O bot saiu do ${L.one}.`);
            setLeaving(null);
            await load();
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao sair.'));
        } finally {
            setBusy('');
        }
    };

    // total de membros calculado SÓ a partir de contagens conhecidas (não trata null como 0);
    // se nenhuma contagem é conhecida, mostra "—" em vez de afirmar 0.
    const knownMembers = filtered.filter((g) => g.member_count != null);
    const totalMembers = knownMembers.reduce((s, g) => s + g.member_count, 0);
    const membersLabel = knownMembers.length ? totalMembers.toLocaleString('pt-BR') : '—';
    // enquanto carrega (cards ainda são skeletons) não afirma contagens; mostra só a descrição.
    const countsSubtitle = loading
        ? L.subtitle
        : `${L.subtitle} ${filtered.length} ${filtered.length === 1 ? L.one : L.plural} · ${membersLabel} ${L.members} no total.`;

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <TgPageHeader
                icon={L.icon}
                title={L.title}
                subtitle={countsSubtitle}
                action={
                    <Tooltip title="Atualizar">
                        <span>
                            <TgGhostButton onClick={load} startIcon={<IconRefresh size={16} />}>
                                Atualizar
                            </TgGhostButton>
                        </span>
                    </Tooltip>
                }
            />

            <TgFilterBar>
                <SearchSelect
                    sx={{ minWidth: 220 }}
                    label="Bot"
                    value={botFilter}
                    onChange={setBotFilter}
                    options={[{ value: 'all', label: 'Todos os bots' }, ...bots.map((b) => ({ value: b.id, label: `${b.name}${b.username ? ` · @${b.username}` : ''}` }))]}
                />
                <TextField
                    size="small"
                    placeholder={`Buscar ${L.one}…`}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    sx={{ minWidth: 220, flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }}
                />
            </TgFilterBar>

            {loading ? (
                <TgCardGridSkeleton count={3} height={160} />
            ) : filtered.length === 0 ? (
                <TgEmptyState icon={L.icon} title={L.emptyTitle} description={L.emptyDesc} />
            ) : (
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
                    {filtered.map((g) => {
                        const banned = g.bot?.status === 'BANNED';
                        return (
                            <TgCard key={g.id} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <TgAvatar
                                        name={g.name}
                                        photoPath={`/telegram/groups/${g.id}/photo`}
                                        size={50}
                                        kind={isChannel ? 'channel' : 'group'}
                                        icon={L.icon}
                                    />
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography sx={{ fontWeight: 700 }} noWrap>
                                            {g.name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                                            {g.username ? `@${g.username}` : L.privateLabel}
                                        </Typography>
                                    </Box>
                                    <Stack
                                        direction="row"
                                        spacing={0.5}
                                        alignItems="center"
                                        sx={{ flexShrink: 0, px: 1, py: 0.4, borderRadius: 1.5, bgcolor: 'action.hover', color: 'text.secondary' }}
                                    >
                                        <IconUsers size={14} />
                                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                            {g.member_count ?? '—'}
                                        </Typography>
                                    </Stack>
                                </Stack>

                                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ color: 'text.secondary' }}>
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.3, borderRadius: 5, bgcolor: 'action.hover', fontSize: 11, fontWeight: 600 }}>
                                        <IconBrandTelegram size={12} />
                                        {g.bot ? `@${g.bot.username || g.bot.name}` : 'bot'}
                                    </Box>
                                    <Typography variant="caption">atividade {fmtDate(g.last_message_at)}</Typography>
                                    {banned ? <TgStatusPill status="banned" label="Bot banido" /> : null}
                                </Stack>

                                {g.last_message_text ? (
                                    <Typography variant="caption" sx={{ color: 'text.disabled' }} noWrap>
                                        {g.last_message_text}
                                    </Typography>
                                ) : null}

                                <Box sx={{ flex: 1 }} />
                                <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                                    <TgGhostButton startIcon={<IconMessage2 size={15} />} onClick={() => navigate(`/telegram/dms?kind=GROUP&id=${g.id}`)}>
                                        {L.posts}
                                    </TgGhostButton>
                                    <TgGhostButton
                                        startIcon={busy === `inv-${g.id}` ? <CircularProgress size={13} /> : <IconLink size={15} />}
                                        onClick={() => copyInvite(g)}
                                        disabled={busy === `inv-${g.id}`}
                                    >
                                        Convite
                                    </TgGhostButton>
                                    <Box sx={{ flex: 1 }} />
                                    <Tooltip title={L.leave}>
                                        <TgGhostButton
                                            onClick={() => setLeaving(g)}
                                            sx={{ minWidth: 0, px: 1, color: 'error.main', borderColor: (t) => `rgba(${t.vars.palette.error.mainChannel} / 0.3)` }}
                                        >
                                            <IconLogout size={16} />
                                        </TgGhostButton>
                                    </Tooltip>
                                </Stack>
                            </TgCard>
                        );
                    })}
                </Box>
            )}

            <TgConfirmDialog
                open={!!leaving}
                onClose={() => setLeaving(null)}
                onConfirm={confirmLeave}
                loading={busy.startsWith('leave')}
                danger
                icon={IconLogout}
                title={L.leave}
                message={`O bot vai sair de "${leaving?.name}" e o ${L.one} será removido do Pub Mail (junto com o histórico daqui). Você pode adicionar o bot de novo depois.`}
                confirmLabel={L.leave}
            />
        </Box>
    );
}
