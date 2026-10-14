import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  IconBolt,
  IconBuildingBank,
  IconBuildingSkyscraper,
  IconBuildingStore,
  IconCheck,
  IconCircleCheck,
  IconCrown,
  IconEye,
  IconPackage,
  IconRobot,
  IconShieldLock,
  IconShoppingBag,
  IconShoppingCart,
  IconStethoscope,
  IconTemplate,
  IconTicket,
  IconWifi
} from '@tabler/icons-react';

import { get, post } from 'api/api';
import { TgCard } from 'views/pages/telegram/ui';
import { CrmModal, formatBRL, waPrimaryBtn } from '../crm/crmKit';
import { CF_ENTITIES, loadCrmSettings } from '../crm/customFields';
import { tint } from '../waShared';
import { SettingsCardHeader, cardSx, errText } from './settingsKit';

// ============================================================================
// "Começar com um modelo" (Fase 7, contrato §11.6): modelos prontos por ramo (clínica, provedor,
// loja, segurança, VIP, prefeitura, mercado). GET /whatsapp/templates (lista + o que cada um cria),
// GET /whatsapp/templates/:key (prévia) e POST /whatsapp/templates/:key/apply {parts} (dono/admin).
// Nada que já existe é sobrescrito (cria por NOME o que falta); o fluxo do bot nasce DESLIGADO e sem número.
// ============================================================================

const ICONS = {
  stethoscope: IconStethoscope,
  clinic: IconStethoscope,
  wifi: IconWifi,
  shoppingbag: IconShoppingBag,
  shoppingcart: IconShoppingCart,
  buildingstore: IconBuildingStore,
  shieldlock: IconShieldLock,
  shield: IconShieldLock,
  crown: IconCrown,
  buildingbank: IconBuildingBank,
  buildingskyscraper: IconBuildingSkyscraper,
  template: IconTemplate,
  package: IconPackage,
  ticket: IconTicket,
  robot: IconRobot
};
const iconOf = (name) => {
  const k = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^icon/, '');
  return ICONS[k] || IconTemplate;
};

export const PART_LABEL = {
  products: 'Produtos e serviços',
  custom_fields: 'Campos personalizados',
  tags: 'Etiquetas',
  pipeline: 'Etapas do funil',
  tickets: 'Chamados (categorias e ajustes)',
  scheduling: 'Agenda (recursos e ajustes)',
  orders: 'Pedidos (configuração)',
  bot: 'Fluxo do bot'
};
const BUCKET_LABEL = {
  ...PART_LABEL,
  services: 'Serviços',
  pipeline_stages: 'Etapas do funil',
  stages: 'Etapas do funil',
  categories: 'Categorias de chamado',
  ticket_categories: 'Categorias de chamado',
  resources: 'Recursos da agenda',
  products: 'Produtos e serviços'
};
const bucketLabel = (k) => BUCKET_LABEL[k] || k;
const entityLabel = (k) => CF_ENTITIES.find((e) => e.key === k)?.label || k;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function countChips(c = {}) {
  const out = [];
  if (c.products) out.push(plural(c.products, 'produto', 'produtos'));
  if (c.services) out.push(plural(c.services, 'serviço', 'serviços'));
  if (c.custom_fields) out.push(plural(c.custom_fields, 'campo', 'campos'));
  if (c.tags) out.push(plural(c.tags, 'etiqueta', 'etiquetas'));
  if (c.pipeline_stages) out.push(plural(c.pipeline_stages, 'etapa', 'etapas'));
  if (c.ticket_categories) out.push(plural(c.ticket_categories, 'categoria', 'categorias'));
  if (c.resources) out.push(plural(c.resources, 'recurso', 'recursos'));
  if (c.orders) out.push('pedidos');
  if (c.bot) out.push('fluxo do bot');
  return out;
}

// ---------------------------------------------------------------- prévia ("Ver o que cria")
function PreviewSection({ title, items }) {
  if (!items?.length) return null;
  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {title}
      </Typography>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
        {items.map((it, i) => (
          <Chip key={i} size="small" label={it} sx={{ height: 24, borderRadius: 1.5, fontWeight: 600, maxWidth: '100%' }} />
        ))}
      </Stack>
    </Box>
  );
}

function PreviewDialog({ tpl, onClose, onApply, canEdit }) {
  const [full, setFull] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!tpl) return undefined;
    let alive = true;
    setFull(null);
    setError('');
    get(`/whatsapp/templates/${encodeURIComponent(tpl.key)}`)
      .then((r) => alive && setFull(r || {}))
      .catch((e) => alive && setError(errText(e, 'Não foi possível carregar o modelo.')));
    return () => {
      alive = false;
    };
  }, [tpl]);
  const products = (full?.products || []).filter((p) => p.kind !== 'service');
  const services = (full?.products || []).filter((p) => p.kind === 'service');
  const priceOf = (p) => (Number(p.price_cents) > 0 ? ` · ${formatBRL(p.price_cents)}` : '');
  return (
    <CrmModal
      open={Boolean(tpl)}
      onClose={onClose}
      title={tpl?.name || 'Modelo'}
      subtitle={tpl?.description}
      maxWidth="sm"
      footer={
        <>
          <Button color="inherit" onClick={onClose} sx={{ textTransform: 'none' }}>
            Fechar
          </Button>
          {canEdit ? (
            <Button variant="contained" disableElevation onClick={() => onApply(tpl)} startIcon={<IconBolt size={16} />} sx={waPrimaryBtn}>
              Aplicar este modelo
            </Button>
          ) : null}
        </>
      }
    >
      {error ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      ) : !full ? (
        <Stack spacing={1}>
          <Skeleton height={28} />
          <Skeleton height={28} />
          <Skeleton height={28} />
        </Stack>
      ) : (
        <Stack spacing={1.75}>
          {tpl?.highlights?.length ? (
            <Stack spacing={0.5}>
              {tpl.highlights.map((h, i) => (
                <Stack key={i} direction="row" spacing={0.75} alignItems="flex-start">
                  <Box component="span" sx={{ color: 'success.main', display: 'inline-flex', mt: '2px' }}>
                    <IconCircleCheck size={15} />
                  </Box>
                  <Typography variant="body2">{h}</Typography>
                </Stack>
              ))}
            </Stack>
          ) : null}
          <PreviewSection title="Produtos e planos" items={products.map((p) => `${p.name}${priceOf(p)}`)} />
          <PreviewSection title="Serviços da agenda" items={services.map((p) => `${p.name}${priceOf(p)}`)} />
          {Object.entries(full.custom_fields || {})
            .filter(([, l]) => l?.length)
            .map(([ent, l]) => (
              <PreviewSection key={ent} title={`Campos · ${entityLabel(ent)}`} items={l.map((d) => d.label || d.key)} />
            ))}
          <PreviewSection title="Etiquetas" items={(full.tags || []).map((t) => t.name)} />
          <PreviewSection title="Etapas do funil" items={(full.pipeline_stages || []).map((s) => s.name)} />
          <PreviewSection title="Categorias de chamado" items={(full.tickets?.categories || []).map((c) => c.label || c.name || c.key)} />
          <PreviewSection title="Recursos da agenda" items={(full.scheduling?.resources || []).map((r) => r.name)} />
          <PreviewSection title="Pedidos" items={full.orders ? ['Configuração de pedidos (entrega, retirada, pagamento)'] : []} />
          <PreviewSection title="Fluxo do bot" items={full.bot ? [`${full.bot.name} — criado desligado e sem número`] : []} />
        </Stack>
      )}
    </CrmModal>
  );
}

// ---------------------------------------------------------------- aplicar
function ApplyDialog({ tpl, onClose, onDone }) {
  const [parts, setParts] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (tpl) {
      setParts(tpl.parts || []);
      setBusy(false);
    }
  }, [tpl]);
  const toggle = (p, on) => setParts((xs) => (on ? [...new Set([...xs, p])] : xs.filter((x) => x !== p)));
  const apply = async () => {
    if (!parts.length) return toast.error('Marque pelo menos uma parte do modelo.');
    setBusy(true);
    try {
      const r = await post(`/whatsapp/templates/${encodeURIComponent(tpl.key)}/apply`, { parts });
      onDone?.(tpl, r);
    } catch (e) {
      toast.error(errText(e, 'Não foi possível aplicar o modelo.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };
  return (
    <CrmModal
      open={Boolean(tpl)}
      onClose={() => !busy && onClose()}
      title={`Aplicar "${tpl?.name || ''}"`}
      subtitle="Escolha o que criar na sua conta."
      maxWidth="sm"
      disableClose={busy}
      footer={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={apply}
            disabled={busy || !parts.length}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCheck size={16} />}
            sx={waPrimaryBtn}
          >
            Aplicar modelo
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        <Box sx={{ display: 'grid', gap: 0.25 }}>
          {(tpl?.parts || []).map((p) => (
            <FormControlLabel
              key={p}
              disabled={busy}
              control={<Checkbox size="small" checked={parts.includes(p)} onChange={(e) => toggle(p, e.target.checked)} />}
              label={<Typography variant="body2">{PART_LABEL[p] || p}</Typography>}
            />
          ))}
        </Box>
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          <strong>Nada que você já tem é sobrescrito</strong>: produtos, etiquetas, etapas, categorias e campos com o mesmo nome são
          pulados.
          {(tpl?.parts || []).includes('bot') ? (
            <>
              {' '}
              O fluxo do bot é criado <strong>DESLIGADO e sem número</strong> — revise em Fluxo do Bot e ligue quando quiser.
            </>
          ) : null}
        </Alert>
      </Stack>
    </CrmModal>
  );
}

function ResultDialog({ result, onClose }) {
  const navigate = useNavigate();
  const r = result?.r || {};
  const created = Object.entries(r.created || {}).filter(([, l]) => l?.length);
  const skipped = Object.entries(r.skipped || {}).filter(([, l]) => l?.length);
  const errors = Array.isArray(r.errors) ? r.errors : [];
  return (
    <CrmModal
      open={Boolean(result)}
      onClose={onClose}
      title={errors.length ? 'Modelo aplicado com avisos' : 'Modelo aplicado'}
      subtitle={result?.tpl?.name}
      maxWidth="sm"
      footer={
        <>
          <Button color="inherit" onClick={onClose} sx={{ textTransform: 'none' }}>
            Fechar
          </Button>
          {r.flow_id ? (
            <Button
              variant="contained"
              disableElevation
              startIcon={<IconRobot size={16} />}
              onClick={() => {
                onClose();
                navigate(`/whatsapp/bot?flow=${encodeURIComponent(r.flow_id)}`);
              }}
              sx={waPrimaryBtn}
            >
              Abrir o fluxo criado
            </Button>
          ) : null}
        </>
      }
    >
      <Stack spacing={1.75}>
        {created.length ? (
          created.map(([k, l]) => <PreviewSection key={`c-${k}`} title={`Criado · ${bucketLabel(k)} (${l.length})`} items={l} />)
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Nada novo foi criado — você já tinha tudo o que este modelo traz.
          </Typography>
        )}
        {skipped.length ? (
          <Box sx={{ p: 1.25, borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>
              Já existiam (mantidos como estavam)
            </Typography>
            {skipped.map(([k, l]) => (
              <Typography key={`s-${k}`} variant="caption" sx={{ display: 'block', color: 'text.secondary', overflowWrap: 'anywhere' }}>
                <strong>{bucketLabel(k)}:</strong> {l.join(', ')}
              </Typography>
            ))}
          </Box>
        ) : null}
        {errors.length ? (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {errors.map((e, i) => (
                <li key={i}>
                  <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                    {e}
                  </Typography>
                </li>
              ))}
            </Box>
          </Alert>
        ) : null}
        {r.flow_id ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            O fluxo do bot foi criado desligado e sem número. Abra, revise os textos e ligue em <strong>Fluxo do Bot</strong>.
          </Alert>
        ) : null}
      </Stack>
    </CrmModal>
  );
}

// ---------------------------------------------------------------- card
export default function TemplatesCard({ canEdit, onApplied }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [applyTpl, setApplyTpl] = useState(null);
  const [result, setResult] = useState(null);

  const load = useCallback(() => {
    setError('');
    get('/whatsapp/templates')
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => {
        setList([]);
        setError(errText(e, 'Não foi possível carregar os modelos.'));
      });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <TgCard hover={false} sx={{ ...cardSx, gridColumn: '1 / -1' }}>
      <SettingsCardHeader
        icon={IconTemplate}
        title="Começar com um modelo"
        subtitle="Produtos, campos, etiquetas, funil e um fluxo do bot prontos para o seu ramo — tudo editável depois."
      />
      {error ? (
        <Alert severity="error" sx={{ borderRadius: 2 }} action={<Button onClick={load}>Tentar de novo</Button>}>
          {error}
        </Alert>
      ) : list === null ? (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }
          }}
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={150} sx={{ borderRadius: 2.5 }} />
          ))}
        </Box>
      ) : !list.length ? (
        <Box sx={{ p: 3, borderRadius: 2.5, border: '1px dashed', borderColor: 'divider', textAlign: 'center' }}>
          <Box sx={{ color: 'text.secondary', display: 'inline-flex', mb: 0.5 }}>
            <IconTemplate size={28} />
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Nenhum modelo disponível ainda
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Em breve: clínica, provedor de internet, loja, segurança, grupo VIP, prefeitura e mercado.
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }
          }}
        >
          {list.map((t) => {
            const Icon = iconOf(t.icon);
            const chips = countChips(t.counts);
            return (
              <Box
                key={t.key}
                sx={{
                  p: 1.75,
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  minWidth: 0,
                  transition: 'border-color .15s, box-shadow .15s',
                  '&:hover': { borderColor: 'success.main', boxShadow: (th) => `0 0 0 3px ${tint(th, 'success', 0.1)}` }
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      color: 'success.main',
                      bgcolor: (th) => tint(th, 'success', 0.12)
                    }}
                  >
                    <Icon size={21} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{t.name}</Typography>
                    {t.description ? (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }}>
                        {t.description}
                      </Typography>
                    ) : null}
                  </Box>
                </Stack>
                {t.highlights?.length ? (
                  <Stack spacing={0.25}>
                    {t.highlights.slice(0, 3).map((h, i) => (
                      <Stack key={i} direction="row" spacing={0.5} alignItems="flex-start">
                        <Box component="span" sx={{ color: 'success.main', display: 'inline-flex', mt: '3px', flexShrink: 0 }}>
                          <IconCheck size={13} />
                        </Box>
                        <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                          {h}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                ) : null}
                {chips.length ? (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {chips.map((c) => (
                      <Chip key={c} size="small" label={c} sx={{ height: 20, fontSize: 11, fontWeight: 700, borderRadius: 1.5 }} />
                    ))}
                  </Stack>
                ) : null}
                <Box sx={{ flex: 1 }} />
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    startIcon={<IconEye size={15} />}
                    onClick={() => setPreview(t)}
                    sx={{ textTransform: 'none', fontWeight: 700, flex: 1, borderRadius: 2 }}
                  >
                    Ver o que cria
                  </Button>
                  {canEdit ? (
                    <Button
                      size="small"
                      variant="contained"
                      disableElevation
                      startIcon={<IconBolt size={15} />}
                      onClick={() => setApplyTpl(t)}
                      sx={{ ...waPrimaryBtn, flex: 1 }}
                    >
                      Aplicar
                    </Button>
                  ) : null}
                </Stack>
              </Box>
            );
          })}
        </Box>
      )}
      <PreviewDialog
        tpl={preview}
        canEdit={canEdit}
        onClose={() => setPreview(null)}
        onApply={(t) => {
          setPreview(null);
          setApplyTpl(t);
        }}
      />
      <ApplyDialog
        tpl={applyTpl}
        onClose={() => setApplyTpl(null)}
        onDone={(t, r) => {
          setApplyTpl(null);
          setResult({ tpl: t, r });
          loadCrmSettings(true).catch(() => undefined); // campos personalizados novos
          onApplied?.(r);
        }}
      />
      <ResultDialog result={result} onClose={() => setResult(null)} />
    </TgCard>
  );
}
