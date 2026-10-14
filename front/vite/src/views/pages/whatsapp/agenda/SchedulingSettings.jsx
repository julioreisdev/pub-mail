import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { IconDeviceFloppy } from '@tabler/icons-react';

import { get, put } from 'api/api';
import { TgCard, TgListSkeleton } from 'views/pages/telegram/ui';
import { CollapsibleSection, waPrimaryBtn } from '../crm/crmKit';
import { API, apptErr, copyText } from './agendaKit';

// ============================================================================
// Configurações de agendamento (dono/admin): textos das mensagens automáticas,
// lembretes (véspera e 2 h antes), falta automática, conclusão automática, lista de
// espera, aviso à equipe e sinal obrigatório depois de N faltas.
// GET/PUT /whatsapp/scheduling/settings
// ============================================================================

const TEXTS = [
  ['booked', 'Agendamento criado', 'Enviado quando o horário fica reservado (sem pagamento pendente).'],
  ['pending_payment', 'Aguardando pagamento', 'Vai junto da cobrança; o horário fica reservado até o prazo.'],
  ['paid', 'Pagamento confirmado', 'Quando a cobrança do agendamento é paga.'],
  ['reminder_d1', 'Lembrete da véspera', 'Para serviços que não pedem confirmação.'],
  ['reminder_d1_confirm', 'Lembrete da véspera com confirmação', 'Pede "1 para confirmar, 2 para remarcar/cancelar".'],
  ['reminder_h2', 'Lembrete 2 horas antes', ''],
  ['confirmed', 'Confirmado', 'Resposta quando o cliente confirma.'],
  ['canceled', 'Cancelado (dentro do prazo)', ''],
  ['canceled_late', 'Cancelado fora do prazo', 'Explique a política (crédito, retenção ou estorno).'],
  ['rescheduled', 'Remarcado', ''],
  ['no_show', 'Falta', 'Enviado quando o atendimento é marcado como falta.'],
  ['expired', 'Reserva expirada', 'O pagamento não chegou no prazo e o horário foi liberado.'],
  ['waitlist_offer', 'Oferta da lista de espera', 'Pede "1 para quero".'],
  ['waitlist_booked', 'Lista de espera — agendado', '']
];
const VARS = [
  '{{cliente.primeiro_nome}}',
  '{{agendamento.servico}}',
  '{{agendamento.profissional}}',
  '{{agendamento.data}}',
  '{{agendamento.hora}}',
  '{{agendamento.valor}}',
  '{{agendamento.endereco}}',
  '{{agendamento.link_pagamento}}'
];

const intOr = (v, min, max, def) => {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export default function SchedulingSettings({ canEdit }) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    get(`${API}/settings`)
      .then((r) => setS({ texts: {}, ...(r || {}) }))
      .catch((e) => {
        toast.error(apptErr(e, 'Não foi possível carregar as configurações.'));
        setS({ texts: {} });
      });
  }, []);

  const set = (k, v) => {
    setS((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  const setText = (k, v) => {
    setS((x) => ({ ...x, texts: { ...(x.texts || {}), [k]: v } }));
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const body = {
        texts: s.texts || {},
        reminder_d1_hour: s.reminder_d1_hour || '18:00',
        reminder_h2: Boolean(s.reminder_h2),
        no_show_after_minutes: intOr(s.no_show_after_minutes, 0, 1440, 30),
        auto_complete: Boolean(s.auto_complete),
        waitlist_offer_minutes: intOr(s.waitlist_offer_minutes, 5, 1440, 30),
        staff_notify: Boolean(s.staff_notify),
        no_show_deposit_after: intOr(s.no_show_deposit_after, 0, 20, 0)
      };
      const r = await put(`${API}/settings`, body);
      if (r && typeof r === 'object') setS({ texts: {}, ...r });
      setDirty(false);
      toast.success('Configurações salvas.');
    } catch (e) {
      toast.error(apptErr(e, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
  };

  if (!s)
    return (
      <TgCard hover={false} sx={{ p: 2 }}>
        <TgListSkeleton rows={6} />
      </TgCard>
    );

  return (
    <Stack spacing={2}>
      {!canEdit ? (
        <Alert severity="info" sx={{ borderRadius: 2.5 }}>
          Só o dono ou um admin altera as configurações de agendamento.
        </Alert>
      ) : null}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'repeat(2, minmax(0,1fr))' } }}>
        <TgCard hover={false} sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>
            Lembretes
          </Typography>
          <Stack spacing={1.5}>
            <TextField
              size="small"
              type="time"
              label="Lembrete da véspera às"
              value={s.reminder_d1_hour || '18:00'}
              onChange={(e) => set('reminder_d1_hour', e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Horário de Brasília. Vai para os agendamentos do dia seguinte."
              disabled={!canEdit}
            />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                size="small"
                checked={Boolean(s.reminder_h2)}
                onChange={(e) => set('reminder_h2', e.target.checked)}
                disabled={!canEdit}
              />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Lembrete 2 horas antes
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                size="small"
                checked={Boolean(s.staff_notify)}
                onChange={(e) => set('staff_notify', e.target.checked)}
                disabled={!canEdit}
              />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Avisar a equipe
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  O profissional (usuário vinculado ao recurso) recebe notificação de novos agendamentos, cancelamentos e faltas.
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </TgCard>
        <TgCard hover={false} sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>
            Faltas, conclusão e lista de espera
          </Typography>
          <Stack spacing={1.5}>
            <TextField
              size="small"
              type="number"
              label="Marcar falta automaticamente após"
              value={s.no_show_after_minutes ?? 30}
              onChange={(e) => set('no_show_after_minutes', e.target.value)}
              InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
              helperText="Depois do início sem atendimento iniciado. 0 = desligado."
              disabled={!canEdit}
            />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                size="small"
                checked={Boolean(s.auto_complete)}
                onChange={(e) => set('auto_complete', e.target.checked)}
                disabled={!canEdit}
              />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Concluir automaticamente
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Agendamentos que terminaram há mais de 2 horas viram "Concluído".
                </Typography>
              </Box>
            </Stack>
            <TextField
              size="small"
              type="number"
              label="Oferta da lista de espera vale por"
              value={s.waitlist_offer_minutes ?? 30}
              onChange={(e) => set('waitlist_offer_minutes', e.target.value)}
              InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
              helperText="Sem resposta nesse tempo, o horário vai para o próximo da fila."
              disabled={!canEdit}
            />
            <TextField
              size="small"
              type="number"
              label="Exigir sinal depois de quantas faltas"
              value={s.no_show_deposit_after ?? 0}
              onChange={(e) => set('no_show_deposit_after', e.target.value)}
              helperText="0 = desligado. Com N faltas, o cliente passa a pagar sinal para agendar."
              disabled={!canEdit}
            />
          </Stack>
        </TgCard>
      </Box>

      <TgCard hover={false} sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          Mensagens automáticas
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          Em branco = texto padrão. Variáveis (clique para copiar):
        </Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          {VARS.map((v) => (
            <Chip
              key={v}
              size="small"
              label={v}
              onClick={async () => (await copyText(v)) && toast.success('Variável copiada.')}
              sx={{ fontFamily: 'monospace', fontSize: 11, height: 22 }}
            />
          ))}
        </Stack>
        <Stack spacing={1}>
          {TEXTS.map(([k, label, hint]) => (
            <CollapsibleSection key={k} title={label} summary={s.texts?.[k] ? s.texts[k].slice(0, 120) : 'Texto padrão'}>
              <TextField
                size="small"
                value={s.texts?.[k] || ''}
                onChange={(e) => setText(k, e.target.value.slice(0, 1000))}
                fullWidth
                multiline
                minRows={3}
                maxRows={10}
                helperText={hint || ' '}
                disabled={!canEdit}
              />
            </CollapsibleSection>
          ))}
        </Stack>
      </TgCard>

      {canEdit ? (
        <Stack direction="row" justifyContent="flex-end" spacing={1} alignItems="center" sx={{ position: 'sticky', bottom: 12 }}>
          {dirty ? <Chip size="small" color="warning" label="Alterações não salvas" sx={{ fontWeight: 700 }} /> : null}
          <Button
            variant="contained"
            disableElevation
            onClick={save}
            disabled={busy || !dirty}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconDeviceFloppy size={16} />}
            sx={waPrimaryBtn}
          >
            Salvar configurações
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
