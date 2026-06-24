import { useMemo, useState } from 'react';
import useSWR from 'swr';

// material-ui
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';

// icons
import { IconEdit, IconPlus, IconRefresh, IconStar, IconStarFilled, IconTrash, IconX } from '@tabler/icons-react';

// project imports
import MainCard from 'ui-component/cards/MainCard';

// your api helpers
import { fetcher, post, patch, remove } from '../../../api/api'; // ajuste o path se necessário

// stripe
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

import {
  // ...
  FormControlLabel,
  Switch
  // ...
} from '@mui/material';
import TransactionsListCard from './Transactions';

const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

// ---------- helpers ----------
function brandLabel(brand) {
  const b = (brand || '').toLowerCase();
  if (b.includes('master')) return 'MASTERCARD';
  if (b.includes('visa')) return 'VISA';
  if (b.includes('amex')) return 'AMEX';
  if (b.includes('elo')) return 'ELO';
  if (b.includes('hiper')) return 'HIPERCARD';
  return (brand || 'CARD').toUpperCase();
}

function maskLast4(last4) {
  const d = String(last4 || '')
    .replace(/\D/g, '')
    .slice(-4)
    .padStart(4, '•');
  return `•••• ${d}`;
}

function centsToUSD(amountCents) {
  const v = Number(amountCents || 0) / 100;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function BrandIcon({ brand }) {
  const label = brandLabel(brand);
  return (
    <Box
      sx={{
        width: 40,
        height: 28,
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        display: 'grid',
        placeItems: 'center'
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 900, lineHeight: 1 }}>
        {label === 'MASTERCARD' ? 'MC' : label}
      </Typography>
    </Box>
  );
}

// ---------- Stripe inner form ----------
function StripeAddCardForm({ holderName, isDefault, onSaved, onError, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();

  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!stripe || !elements) return;

    setSaving(true);
    try {
      const result = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
        confirmParams: {
          payment_method_data: {
            billing_details: { name: holderName }
          }
        }
      });

      if (result?.error) {
        onError?.(result.error.message || 'Erro ao confirmar cartão no Stripe.');
        return;
      }

      const setupIntent = result?.setupIntent;
      const pm = setupIntent?.payment_method; // pm_...

      if (!pm) {
        onError?.('Não foi possível obter o payment_method (pm_...).');
        return;
      }

      // salva no seu backend
      const created = await post('/billing/cards', {
        holder_name: holderName,
        provider_token: pm,
        is_default: !!isDefault
      });

      onSaved?.(created);
    } catch (e) {
      onError?.(e?.response?.data?.message || e?.message || 'Falha ao salvar cartão.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <PaymentElement />

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button onClick={onCancel} disabled={saving} sx={{ borderRadius: 2 }}>
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={saving || !stripe || !elements || !holderName?.trim()}
          variant="contained"
          color="secondary"
          sx={{ borderRadius: 2, minWidth: 190 }}
        >
          {saving ? 'Salvando...' : 'Salvar cartão'}
        </Button>
      </Stack>
    </Stack>
  );
}

// ==============================|| BILLING ACCOUNT (SINGLE FILE) ||============================== //

export default function BillingAccount() {
  // ---- cards (SWR inside the file) ----
  const {
    data: cardsData,
    error: cardsError,
    isLoading: cardsLoading,
    mutate: mutateCards,
    isValidating
  } = useSWR('/billing/cards', fetcher, { revalidateOnFocus: true, shouldRetryOnError: false });

  const cards = useMemo(() => (Array.isArray(cardsData) ? cardsData : []), [cardsData]);

  // ---- ui feedback ----
  const [snack, setSnack] = useState({ open: false, severity: 'success', message: '' });
  const closeSnack = () => setSnack((s) => ({ ...s, open: false }));

  // ---- Add/Edit dialog state ----
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState('create'); // 'create' | 'edit'
  const [editing, setEditing] = useState(null);

  const [holderName, setHolderName] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Stripe client secret for PaymentElement
  const [clientSecret, setClientSecret] = useState('');
  const [loadingSecret, setLoadingSecret] = useState(false);

  // ---- delete confirm ----
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  // ---- topup ----
  const [tokens, setTokens] = useState('100');
  const [topupLoading, setTopupLoading] = useState(false);

  const priceCents = useMemo(() => {
    const t = Math.max(0, Math.floor(Number(tokens || 0)));
    // 1 cent = 400 tokens
    return t > 0 ? Math.max(1, Math.round(t / 400)) : 0;
  }, [tokens]);

  // ---------- open/close ----------
  const openCreate = async () => {
    if (!stripePromise) {
      setSnack({
        open: true,
        severity: 'warning',
        message: 'Defina VITE_STRIPE_PUBLISHABLE_KEY no .env do front para habilitar o Stripe.'
      });
      return;
    }

    setMode('create');
    setEditing(null);
    setHolderName('');
    setIsDefault(false);

    setClientSecret('');
    setDialogOpen(true);

    // buscar client_secret
    setLoadingSecret(true);
    try {
      const res = await post('/billing/setup-intent', {});
      setClientSecret(res?.client_secret || '');
      if (!res?.client_secret) {
        setSnack({ open: true, severity: 'error', message: 'SetupIntent não retornou client_secret.' });
      }
    } catch (e) {
      setSnack({
        open: true,
        severity: 'error',
        message: e?.response?.data?.message || 'Falha ao criar SetupIntent no backend.'
      });
    } finally {
      setLoadingSecret(false);
    }
  };

  const openEdit = (card) => {
    setMode('edit');
    setEditing(card);
    setHolderName(card?.holder_name || '');
    setIsDefault(!!card?.is_default);
    setClientSecret('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setClientSecret('');
    setLoadingSecret(false);
  };

  // ---------- actions ----------
  const refreshCards = () => mutateCards();

  const setDefaultCard = async (card) => {
    if (card?.is_default) return;

    // otimista
    const optimistic = cards.map((c) => ({ ...c, is_default: c.id === card.id }));
    await mutateCards(optimistic, false);

    try {
      await patch(`/billing/cards/${card.id}/default`, {});
      await mutateCards();
      setSnack({ open: true, severity: 'success', message: 'Cartão definido como principal.' });
    } catch (e) {
      await mutateCards();
      setSnack({
        open: true,
        severity: 'error',
        message: e?.response?.data?.message || 'Não foi possível definir como principal.'
      });
    }
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    if (!holderName.trim()) {
      setSnack({ open: true, severity: 'warning', message: 'Informe o nome no cartão.' });
      return;
    }

    try {
      await patch(`/billing/cards/${editing.id}`, {
        holder_name: holderName.trim(),
        is_default: !!isDefault
      });

      await mutateCards();
      setSnack({ open: true, severity: 'success', message: 'Cartão atualizado.' });
      closeDialog();
    } catch (e) {
      setSnack({
        open: true,
        severity: 'error',
        message: e?.response?.data?.message || 'Não foi possível atualizar o cartão.'
      });
    }
  };

  const askDelete = (card) => {
    setToDelete(card);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete?.id) return;

    setDeleting(true);
    // otimista
    const optimistic = cards.filter((c) => c.id !== toDelete.id);
    await mutateCards(optimistic, false);

    try {
      await remove(`/billing/cards/${toDelete.id}`);
      await mutateCards();
      setSnack({ open: true, severity: 'success', message: 'Cartão removido.' });
      setDeleteOpen(false);
      setToDelete(null);
    } catch (e) {
      await mutateCards();
      setSnack({
        open: true,
        severity: 'error',
        message: e?.response?.data?.message || 'Não foi possível remover o cartão.'
      });
    } finally {
      setDeleting(false);
    }
  };

  const doTopup = async () => {
    const t = Math.floor(Number(tokens || 0));
    if (!Number.isFinite(t) || t <= 0) {
      setSnack({ open: true, severity: 'warning', message: 'Informe uma quantidade de tokens válida.' });
      return;
    }

    setTopupLoading(true);
    try {
      const res = await post('/billing/topup', { tokens: t });
      setSnack({
        open: true,
        severity: 'success',
        message: `Compra aprovada: +${res?.tokens ?? t} tokens.`
      });
      setInterval(() => {
        window.location.reload();
      }, 500);
      // se quiser, também pode refazer um hook de wallet depois — por enquanto só confirma sucesso.
    } catch (e) {
      setSnack({
        open: true,
        severity: 'error',
        message: e?.response?.data?.message || 'Falha ao comprar tokens.'
      });
      setInterval(() => {
        window.location.reload();
      }, 500);
    } finally {
      setTopupLoading(false);
    }
  };

  const orderedCards = useMemo(() => [...cards].sort((a, b) => Number(!!b.is_default) - Number(!!a.is_default)), [cards]);

  const empty = !cardsLoading && !cardsError && orderedCards.length === 0;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <MainCard
        content={false}
        sx={{
          overflow: 'hidden',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          marginBottom: '1rem'
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ alignItems: 'stretch' }}>
          {/* LEFT: Cards */}
          <Box sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h4">Cartões</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Adicione, edite, marque como principal ou remova.
                </Typography>
              </Box>

              <Stack direction="row" spacing={1}>
                <Tooltip title="Atualizar lista">
                  <span>
                    <IconButton onClick={refreshCards} disabled={isValidating} sx={{ borderRadius: 2 }}>
                      <IconRefresh size={18} />
                    </IconButton>
                  </span>
                </Tooltip>

                <Button
                  onClick={openCreate}
                  variant="contained"
                  color="secondary"
                  startIcon={<IconPlus size={18} />}
                  sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}
                >
                  Novo cartão
                </Button>
              </Stack>
            </Stack>

            {cardsError && (
              <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
                Não foi possível carregar os cartões.
              </Alert>
            )}

            <MainCard
              sx={{
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
              }}
            >
              {cardsLoading ? (
                <Stack spacing={1.25}>
                  {[1, 2, 3].map((i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Skeleton variant="rounded" width={40} height={28} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton width="60%" />
                        <Skeleton width="35%" />
                      </Box>
                      <Skeleton variant="rounded" width={120} height={28} />
                    </Box>
                  ))}
                </Stack>
              ) : empty ? (
                <Stack spacing={1} sx={{ py: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                    Nenhum cartão cadastrado
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Clique em <b>Novo cartão</b> para adicionar o primeiro método.
                  </Typography>
                </Stack>
              ) : (
                <List disablePadding sx={{ '& .MuiListItem-root + .MuiListItem-root': { mt: 1 } }}>
                  {orderedCards.map((c) => (
                    <ListItem
                      key={c.id}
                      disablePadding
                      sx={{
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: c.is_default ? 'secondary.main' : 'divider',
                        bgcolor: c.is_default ? 'action.hover' : 'transparent',
                        overflow: 'hidden'
                      }}
                      secondaryAction={
                        <Stack direction="row" alignItems="center" spacing={0.25} sx={{ pr: 1 }}>
                          <Tooltip title={c.is_default ? 'Principal' : 'Definir como principal'}>
                            <span>
                              <IconButton size="small" onClick={() => setDefaultCard(c)} disabled={c.is_default} sx={{ borderRadius: 2 }}>
                                {c.is_default ? <IconStarFilled color="#5E35B1" size={18} /> : <IconStar size={18} />}
                              </IconButton>
                            </span>
                          </Tooltip>

                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => openEdit(c)} sx={{ borderRadius: 2 }}>
                              <IconEdit size={18} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Apagar">
                            <IconButton size="small" onClick={() => askDelete(c)} sx={{ borderRadius: 2 }}>
                              <IconTrash size={18} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      }
                    >
                      <ListItemButton onClick={() => setDefaultCard(c)} sx={{ py: 1.2, px: 1.25, pr: 11 }}>
                        <ListItemIcon sx={{ minWidth: 48 }}>
                          <BrandIcon brand={c.brand} />
                        </ListItemIcon>

                        <ListItemText
                          primary={
                            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                {maskLast4(c.last_four_digits)}
                              </Typography>
                            </Stack>
                          }
                          secondary={
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {c.holder_name} • {brandLabel(c.brand)}
                            </Typography>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </MainCard>

            <Typography variant="caption" sx={{ display: 'block', mt: 1.25, color: 'text.secondary' }}>
              Dica: clique no cartão (ou na estrela) para torná-lo principal.
            </Typography>
          </Box>

          {/* DIVIDERS */}
          <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />
          <Divider flexItem orientation="horizontal" sx={{ display: { xs: 'block', md: 'none' } }} />

          {/* RIGHT: Topup */}
          <Box sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
            <Stack spacing={1.5}>
              <Typography variant="h4">Comprar tokens</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Preço: <b>1M tokens = US$25 (1 token = US$0.000025)</b>.
              </Typography>

              <MainCard
                sx={{
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper'
                }}
              >
                <Stack spacing={1.5}>
                  <TextField
                    label="Quantidade de tokens"
                    value={tokens}
                    onChange={(e) => setTokens(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    inputProps={{ inputMode: 'numeric' }}
                    fullWidth
                    InputProps={{
                      endAdornment: <InputAdornment position="end">tokens</InputAdornment>
                    }}
                    helperText={`Total estimado: ${centsToUSD(priceCents)}`}
                  />

                  <Button
                    onClick={doTopup}
                    disabled={topupLoading || priceCents <= 0}
                    variant="contained"
                    color="secondary"
                    sx={{ borderRadius: 2, minHeight: 44 }}
                  >
                    {topupLoading ? 'Processando...' : `Comprar (${centsToUSD(priceCents)})`}
                  </Button>
                </Stack>
              </MainCard>

              <Alert severity="info" variant="outlined">
                Se o topup falhar com “nenhum cartão principal”, primeiro adicione um cartão e marque como principal.
              </Alert>
            </Stack>
          </Box>
        </Stack>
      </MainCard>
      <TransactionsListCard />
      {/* ADD/EDIT DIALOG */}
      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                {mode === 'create' ? 'Novo cartão' : 'Editar cartão'}
              </Typography>
            </Box>

            <IconButton onClick={closeDialog} sx={{ borderRadius: 2 }}>
              <IconX size={18} />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            {!stripePromise && mode === 'create' && (
              <Alert severity="warning" variant="outlined">
                Stripe não está configurado no front. Defina <b>VITE_STRIPE_PUBLISHABLE_KEY</b> no .env.
              </Alert>
            )}

            <TextField placeholder="Nome no cartão" value={holderName} onChange={(e) => setHolderName(e.target.value)} fullWidth />

            <FormControlLabel
              sx={{ mt: 0.25, ml: 0.25, alignItems: 'flex-start' }}
              control={<Switch checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} color="secondary" />}
              label={
                <Stack spacing={0}>
                  <Typography sx={{ fontWeight: 900 }}>Definir como principal</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Se ativado, este cartão será usado para cobranças futuras.
                  </Typography>
                </Stack>
              }
            />

            {/* CREATE: Stripe Payment Element */}
            {mode === 'create' && stripePromise && (
              <>
                {loadingSecret ? (
                  <Stack spacing={1}>
                    <Skeleton height={28} width="50%" />
                    <Skeleton variant="rounded" height={140} />
                    <Skeleton variant="rounded" height={44} />
                  </Stack>
                ) : clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <StripeAddCardForm
                      holderName={holderName}
                      isDefault={isDefault}
                      onCancel={closeDialog}
                      onError={(msg) => setSnack({ open: true, severity: 'error', message: msg })}
                      onSaved={async () => {
                        await mutateCards();
                        setSnack({ open: true, severity: 'success', message: 'Cartão cadastrado com sucesso.' });
                        closeDialog();
                      }}
                    />
                  </Elements>
                ) : (
                  <Alert severity="error" variant="outlined">
                    Não foi possível obter client_secret. Verifique o endpoint <b>POST /billing/setup-intent</b>.
                  </Alert>
                )}
              </>
            )}

            {/* EDIT: simple save */}
            {mode === 'edit' && (
              <Alert severity="info" variant="outlined">
                O token do cartão não aparece por segurança. Você pode renomear e/ou marcar como principal.
              </Alert>
            )}
          </Stack>
        </DialogContent>

        {mode === 'edit' && (
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeDialog} sx={{ borderRadius: 2 }}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} variant="contained" color="secondary" sx={{ borderRadius: 2, minWidth: 160 }}>
              Salvar alterações
            </Button>
          </DialogActions>
        )}
      </Dialog>
      {/* DELETE CONFIRM */}
      <Dialog open={deleteOpen} onClose={() => (!deleting ? setDeleteOpen(false) : null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Remover cartão
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Tem certeza que deseja remover o cartão <b>{maskLast4(toDelete?.last_four_digits)}</b>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting} sx={{ borderRadius: 2 }}>
            Cancelar
          </Button>
          <Button onClick={confirmDelete} disabled={deleting} variant="contained" color="error" sx={{ borderRadius: 2, minWidth: 140 }}>
            {deleting ? 'Removendo...' : 'Remover'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* SNACK */}
      <Snackbar open={snack.open} autoHideDuration={3200} onClose={closeSnack} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={closeSnack} severity={snack.severity} variant="filled" sx={{ borderRadius: 2 }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
