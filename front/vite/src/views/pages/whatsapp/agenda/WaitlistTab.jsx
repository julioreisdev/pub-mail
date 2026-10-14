import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconBrandWhatsapp, IconHourglassHigh, IconSend, IconTrash } from '@tabler/icons-react';

import { get, post, remove } from 'api/api';
import { TgCard, TgConfirmDialog, TgEmptyState, TgFilterBar, TgListSkeleton } from 'views/pages/telegram/ui';
import { asList } from '../waKit';
import { fmtDateTime, fmtPhone } from '../waShared';
import { chatUrl, fmtDateBR } from '../crm/crmKit';
import { API, apptErr, whenLabel } from './agendaKit';

// ============================================================================
// Lista de espera: quem pediu um horário que não tinha. Quando um horário libera,
// o sistema oferece ao 1º compatível; aqui a equipe vê a fila, oferece manualmente
// (o back procura o próximo horário livre compatível) ou remove.
// ============================================================================

const STATUS = {
  waiting: { label: 'Esperando', color: 'info' },
  offered: { label: 'Oferta enviada', color: 'warning' },
  booked: { label: 'Agendado', color: 'success' },
  expired: { label: 'Expirou', color: 'default' },
  canceled: { label: 'Cancelado', color: 'default' }
};
const PERIOD = { any: 'Qualquer horário', morning: 'Manhã', afternoon: 'Tarde', evening: 'Noite' };

export default function WaitlistTab({ services = [], reloadToken }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('waiting');
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState('');
  const [del, setDel] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const s = ++seq.current;
    try {
      const r = await get(`${API}/waitlist`, { params: { status: status || undefined } });
      if (s === seq.current) setItems(asList(r));
    } catch (e) {
      if (s === seq.current) {
        setItems([]);
        toast.error(apptErr(e, 'Não foi possível carregar a lista de espera.'));
      }
    }
  }, [status]);
  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const offer = async (w) => {
    setBusy(w.id);
    try {
      await post(`${API}/waitlist/${w.id}/offer`, {});
      toast.success('Oferta enviada ao cliente.');
      load();
    } catch (e) {
      toast.error(apptErr(e, 'Nenhum horário compatível livre agora.'));
    } finally {
      setBusy('');
    }
  };
  const doDelete = async () => {
    setBusy(del.id);
    try {
      await remove(`${API}/waitlist/${del.id}`);
      toast.success('Removido da lista de espera.');
      setDel(null);
      load();
    } catch (e) {
      toast.error(apptErr(e, 'Não foi possível remover.'));
    } finally {
      setBusy('');
    }
  };

  const serviceName = (w) => w.service_name || w.product_name || services.find((s) => s.id === w.product_id)?.name || 'Serviço';
  const personName = (w) =>
    w.customer?.name || w.contact?.name || w.name || fmtPhone(w.customer?.phone || w.contact?.phone || w.phone) || 'Contato';

  return (
    <Box>
      <TgFilterBar>
        <TextField
          select
          size="small"
          label="Situação"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          sx={{ minWidth: { md: 200 } }}
        >
          <MenuItem value="">Todas</MenuItem>
          {Object.entries(STATUS).map(([k, v]) => (
            <MenuItem key={k} value={k}>
              {v.label}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          O cliente entra na fila pelo bot (bloco "Lista de espera"). Horário liberado = oferta automática ao 1º compatível.
        </Typography>
      </TgFilterBar>
      {items === null ? (
        <TgCard hover={false} sx={{ p: 2 }}>
          <TgListSkeleton rows={5} />
        </TgCard>
      ) : !items.length ? (
        <TgEmptyState
          icon={IconHourglassHigh}
          title="Ninguém na lista de espera"
          description="Quando alguém pedir um horário sem vaga, aparece aqui."
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2, minmax(0,1fr))', xl: 'repeat(3, minmax(0,1fr))' }
          }}
        >
          {items.map((w) => {
            const st = STATUS[w.status] || { label: w.status, color: 'default' };
            return (
              <TgCard key={w.id} hover={false} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800 }} noWrap>
                      {personName(w)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                      {serviceName(w)}
                      {w.resource?.name ? ` · ${w.resource.name}` : ''}
                    </Typography>
                  </Box>
                  <Chip size="small" color={st.color} label={st.label} sx={{ fontWeight: 700, height: 22 }} />
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {fmtDateBR(w.date_from)} a {fmtDateBR(w.date_to)} · {PERIOD[w.period] || w.period || 'Qualquer horário'}
                </Typography>
                {w.status === 'offered' && w.offered_starts_at ? (
                  <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 700 }}>
                    Ofertado: {whenLabel(w.offered_starts_at)}
                    {w.expires_at ? ` · vale até ${fmtDateTime(w.expires_at)}` : ''}
                  </Typography>
                ) : null}
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  Na fila desde {fmtDateTime(w.created_at)}
                </Typography>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 'auto', pt: 0.5 }}>
                  {w.status === 'waiting' ? (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={busy === w.id ? <CircularProgress size={14} /> : <IconSend size={15} />}
                      disabled={Boolean(busy)}
                      onClick={() => offer(w)}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                    >
                      Oferecer horário
                    </Button>
                  ) : null}
                  {w.chat_uuid || w.chat?.chat_id ? (
                    <Tooltip title="Abrir conversa">
                      <IconButton size="small" onClick={() => navigate(chatUrl(w.chat_uuid || w.chat.chat_id))}>
                        <IconBrandWhatsapp size={17} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Remover da fila">
                    <IconButton size="small" onClick={() => setDel(w)} disabled={Boolean(busy)}>
                      <IconTrash size={16} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </TgCard>
            );
          })}
        </Box>
      )}
      <TgConfirmDialog
        open={Boolean(del)}
        onClose={() => setDel(null)}
        onConfirm={doDelete}
        loading={Boolean(busy)}
        danger
        title="Remover da lista de espera?"
        message={del ? `${personName(del)} sai da fila de ${serviceName(del)}. Nada é enviado ao cliente.` : ''}
        confirmLabel="Remover"
      />
    </Box>
  );
}
