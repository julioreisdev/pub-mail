import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconCreditCard, IconTrash } from '@tabler/icons-react';

import { get, remove } from 'api/api';
import { TgConfirmDialog } from 'views/pages/telegram/ui';
import { errMsg } from '../waShared';

// ============================================================================
// Meio de pagamento da assinatura + cartões salvos do cliente (Fase 4).
// O cartão é digitado SEMPRE na página segura do gateway (Asaas); aqui só aparecem bandeira e final.
// ============================================================================

// cache curto das configurações de cobrança (quem configura o gateway em outra aba não espera 1 min);
// `force` ignora o cache (usado quando `reloadKey` muda)
let settingsCache = null;
const SETTINGS_TTL_MS = 15_000;
const loadChargeSettings = async (force = false) => {
  if (!force && settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS) return settingsCache.data;
  const data = await get('/whatsapp/charges/settings');
  settingsCache = { at: Date.now(), data };
  return data;
};

const fmtDate = (v) => {
  if (!v) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(v));
  } catch {
    return '';
  }
};

/**
 * Campos "Forma de pagamento" (+ cartão salvo) de uma assinatura. `value` = { payment_method, payment_method_id }.
 * `reloadKey`: mudou → recarrega configurações (sem cache) e a lista de cartões (ex.: cartão removido em SavedCards).
 */
export function SubPaymentMethodFields({ customerId, value, onChange, reloadKey }) {
  const [cfg, setCfg] = useState(null);
  const [cards, setCards] = useState([]);
  useEffect(() => {
    let alive = true;
    loadChargeSettings(Boolean(reloadKey))
      .then((c) => alive && setCfg(c))
      .catch(() => alive && setCfg(null));
    return () => {
      alive = false;
    };
  }, [reloadKey]);
  useEffect(() => {
    if (!customerId || !cfg?.card_available) {
      setCards([]);
      return undefined;
    }
    let alive = true;
    // o endpoint só devolve cartões ativos — recarregar basta para um cartão removido sumir da lista
    get(`/whatsapp/customers/${customerId}/payment-methods`)
      .then((r) => alive && setCards(Array.isArray(r) ? r : []))
      .catch(() => alive && setCards([]));
    return () => {
      alive = false;
    };
  }, [customerId, cfg?.card_available, reloadKey]);

  const pm = value?.payment_method || '';
  const defLabel = { pix: 'PIX', boleto: 'Boleto', both: 'PIX + Boleto' }[cfg?.default_kind] || 'PIX';
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
      <TextField
        select
        size="small"
        label="Forma de pagamento"
        SelectProps={{ displayEmpty: true }}
        InputLabelProps={{ shrink: true }}
        value={pm}
        onChange={(e) =>
          onChange({
            payment_method: e.target.value || null,
            payment_method_id: e.target.value === 'card' ? value?.payment_method_id || null : null
          })
        }
        fullWidth
        helperText={
          pm === 'card'
            ? 'Cobra no cartão a cada ciclo. Sem cartão salvo, o cliente recebe o link seguro e o cartão fica salvo.'
            : 'Como as cobranças desta assinatura são geradas.'
        }
      >
        <MenuItem value="">Padrão das cobranças ({defLabel})</MenuItem>
        <MenuItem value="pix">PIX</MenuItem>
        <MenuItem value="boleto" disabled={!cfg?.boleto_available}>
          Boleto
        </MenuItem>
        <MenuItem value="both" disabled={!cfg?.boleto_available}>
          PIX + Boleto
        </MenuItem>
        <MenuItem value="card" disabled={!cfg?.card_available}>
          Cartão de crédito{cfg?.card_available ? '' : ' (configure o Asaas)'}
        </MenuItem>
      </TextField>
      {pm === 'card' ? (
        <TextField
          select
          size="small"
          label="Cartão"
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          value={value?.payment_method_id || ''}
          onChange={(e) => onChange({ payment_method: 'card', payment_method_id: e.target.value || null })}
          fullWidth
          helperText={cards.length ? 'Cartão debitado sozinho no vencimento.' : 'Nenhum cartão salvo ainda.'}
        >
          <MenuItem value="">Pedir o cartão no 1º pagamento (link seguro)</MenuItem>
          {cards.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.brand || 'Cartão'} final {c.last4 || '••••'}
            </MenuItem>
          ))}
        </TextField>
      ) : null}
    </Stack>
  );
}

/**
 * Cartões salvos do cliente (bandeira, final, uso) com remover.
 * `canManage` = dono/admin (só eles removem). `onChanged()` é chamado depois de remover com sucesso
 * (quem usa recarrega o cliente: as assinaturas que apontavam para o cartão mudam).
 */
export function SavedCards({ customerId, reloadKey, canManage = true, onChanged }) {
  const [items, setItems] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [removing, setRemoving] = useState(false);
  const load = useCallback(() => {
    if (!customerId) return undefined;
    let alive = true;
    get(`/whatsapp/customers/${customerId}/payment-methods`)
      .then((r) => alive && setItems(Array.isArray(r) ? r : []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [customerId]);
  useEffect(() => load(), [load, reloadKey]);
  if (!items?.length) return null;

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Cartões salvos
      </Typography>
      <Stack spacing={0.75} sx={{ mt: 0.75 }}>
        {items.map((c) => (
          <Stack key={c.id} direction="row" spacing={1} alignItems="center">
            <IconCreditCard size={18} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {c.brand || 'Cartão'} final {c.last4 || '••••'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {c.subscriptions?.length
                  ? `Usado em: ${c.subscriptions.map((s) => s.product_name).join(', ')}`
                  : 'Não vinculado a assinatura'}
                {c.last_used_at ? ` · último uso ${fmtDate(c.last_used_at)}` : ''}
                {c.failures ? ` · ${c.failures} recusa${c.failures === 1 ? '' : 's'} seguida${c.failures === 1 ? '' : 's'}` : ''}
              </Typography>
            </Box>
            {canManage ? (
              <Tooltip title="Remover cartão">
                <IconButton size="small" onClick={() => setConfirm(c)} aria-label="Remover cartão" disabled={removing}>
                  <IconTrash size={16} />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
        ))}
      </Stack>
      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => !removing && setConfirm(null)}
        loading={removing}
        danger
        title="Remover este cartão?"
        message={`${confirm?.brand || 'Cartão'} final ${confirm?.last4 || '••••'} sai do cadastro. Assinaturas que usavam ele passam a mandar o link seguro do cartão a cada cobrança.`}
        confirmLabel="Remover cartão"
        onConfirm={async () => {
          const c = confirm;
          setRemoving(true);
          try {
            const r = await remove(`/whatsapp/customers/${customerId}/payment-methods/${c.id}`);
            setItems(Array.isArray(r) ? r : []);
            setConfirm(null);
            toast.success('Cartão removido.');
            onChanged?.();
          } catch (e) {
            toast.error(errMsg(e, 'Falha ao remover.'));
          } finally {
            setRemoving(false);
          }
        }}
      />
    </Box>
  );
}
