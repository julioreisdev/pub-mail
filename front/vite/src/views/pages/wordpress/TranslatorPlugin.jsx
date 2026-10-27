// =============================================================================
// WordPress → Tradução Invisível: baixar o plugin vinculado à conta, como instalar
// e os sites que estão usando. Dark-mode: só tokens e theme.vars.
// =============================================================================
import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';
import {
  IconBrandWordpress,
  IconDownload,
  IconKey,
  IconLanguage,
  IconPlugConnected,
  IconRefresh,
  IconUpload,
  IconWorldWww
} from '@tabler/icons-react';

import api, { get, post } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgCard, TgConfirmDialog, TgEmptyState, TgStatusPill } from 'views/pages/telegram/ui';

const WP_GRADIENT = 'linear-gradient(135deg, #3858e9 0%, #21759b 100%)';
const tint = (t, token, a) => `rgba(${t.vars.palette[token].mainChannel} / ${a})`;

const errMsg = (e, fb) => {
  const m = e?.response?.data?.message ?? e?.message;
  return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');
const fmtAgo = (v) => {
  if (!v) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(v).getTime()) / 1000));
  if (s < 60) return 'agora';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d === 1 ? '' : 's'}`;
};

const STEPS = [
  { icon: IconDownload, title: 'Baixe o plugin', text: 'O arquivo já vem ligado à sua conta.' },
  { icon: IconUpload, title: 'Envie no WordPress', text: 'Plugins → Adicionar novo → Enviar plugin → Ativar.' },
  { icon: IconLanguage, title: 'Pronto', text: 'Cada visitante lê no idioma do navegador dele.' }
];
// 1.5.0: a tradução do endereço (URL) nasce desligada e liga com um interruptor no menu do WordPress.
const URL_HINT =
  'Quer traduzir também o endereço das páginas? No WordPress, abra o menu Tradutor Invisível → Tradução de URL e ligue "Habilitar tradução de URL". Vem desligado por padrão.';

function accessLabel(access) {
  if (!access) return { status: 'inactive', label: '—' };
  if (!access.active) return { status: 'error', label: 'Pausado' };
  if (access.until) return { status: 'active', label: `Ativo até ${fmtDate(access.until)}` };
  return { status: 'active', label: 'Ativo' };
}

function Header() {
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
      <Box
        sx={{
          width: 46,
          height: 46,
          flexShrink: 0,
          borderRadius: 3,
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          background: WP_GRADIENT,
          boxShadow: (t) => `0 8px 20px ${tint(t, 'primary', 0.28)}`
        }}
      >
        <IconBrandWordpress size={24} stroke={1.8} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          Tradução Invisível
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
          Plugin para WordPress: seus posts no idioma de cada visitante, sem botões nem avisos.
        </Typography>
      </Box>
    </Stack>
  );
}

export default function TranslatorPlugin() {
  const { user } = useAuth();
  const canManage = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await get('/wordpress/translator'); // get() já devolve os dados
      setData(d);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível carregar.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/wordpress/translator/download', { responseType: 'blob' });
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tradutor-invisivel.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      let msg = 'Não foi possível baixar o plugin.';
      try {
        const txt = e?.response?.data instanceof Blob ? await e.response.data.text() : '';
        const j = txt ? JSON.parse(txt) : null;
        if (j?.message) msg = Array.isArray(j.message) ? j.message.join(' | ') : j.message;
      } catch {
        /* resposta sem JSON */
      }
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  const rotate = async () => {
    setRotating(true);
    try {
      const d = await post('/wordpress/translator/rotate');
      setData(d);
      setConfirmRotate(false);
      toast.success('Nova chave criada. Baixe os plugins de novo e instale nos seus sites.');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível trocar a chave.'));
    } finally {
      setRotating(false);
    }
  };

  const acc = accessLabel(data?.access);
  // um site por endereço: a chave atual vence a antiga; entre iguais, o contato mais recente
  const sites = Object.values(
    (data?.sites || []).reduce((acc, s) => {
      const cur = acc[s.host];
      const better =
        !cur || (cur.old_key && !s.old_key) || (cur.old_key === s.old_key && new Date(s.last_seen_at) > new Date(cur.last_seen_at));
      if (better) acc[s.host] = s;
      return acc;
    }, {})
  ).sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at));

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <Header />

      {/* Plugin + download */}
      <TgCard hover={false} sx={{ p: { xs: 2.5, sm: 3 }, mb: 2.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              flexShrink: 0,
              borderRadius: 3.5,
              display: 'grid',
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: (t) => tint(t, 'primary', 0.1)
            }}
          >
            <IconLanguage size={34} stroke={1.6} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Tradutor Invisível
              </Typography>
              {loading ? (
                <Skeleton width={70} />
              ) : data?.plugin?.version ? (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  versão {data.plugin.version}
                </Typography>
              ) : null}
              {!loading ? <TgStatusPill status={acc.status} label={acc.label} /> : null}
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Vinculado à sua conta · sites ilimitados · atualiza sozinho
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            onClick={download}
            disabled={downloading || loading}
            startIcon={downloading ? <CircularProgress size={18} color="inherit" /> : <IconDownload size={20} />}
            sx={{ flexShrink: 0, px: 3, borderRadius: 2.5, width: { xs: '100%', sm: 'auto' } }}
          >
            Baixar plugin
          </Button>
        </Stack>

        {/* 3 passos */}
        <Box
          sx={{
            mt: 3,
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 1.5
          }}
        >
          {STEPS.map((s, i) => (
            <Stack key={s.title} direction="row" spacing={1.5} sx={{ p: 1.75, borderRadius: 2.5, bgcolor: 'action.hover', minWidth: 0 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  color: '#fff',
                  background: WP_GRADIENT
                }}
              >
                {i + 1}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {s.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {s.text}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Box>
        <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
          {URL_HINT}
        </Typography>
      </TgCard>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 2.5 }}>
        {/* Sites */}
        <TgCard hover={false} sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <IconWorldWww size={20} stroke={1.8} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Sites usando o plugin
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Só os sites com o plugin instalado e ativo agora. Desativou ou apagou no WordPress, sai daqui na hora.
              </Typography>
            </Box>
            <Tooltip title="Atualizar">
              <span>
                <Button size="small" onClick={load} disabled={loading} sx={{ minWidth: 0, px: 1 }}>
                  <IconRefresh size={18} />
                </Button>
              </span>
            </Tooltip>
          </Stack>
          {loading ? (
            <Stack spacing={1}>
              <Skeleton height={48} />
              <Skeleton height={48} />
            </Stack>
          ) : sites.length === 0 ? (
            <TgEmptyState
              dense
              icon={IconPlugConnected}
              title="Nenhum site ainda"
              description="Instale e ative o plugin: o site aparece aqui em instantes."
            />
          ) : (
            <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
              {sites.map((s) => (
                <Stack key={s.id} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.25, minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      flexShrink: 0,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      color: 'text.secondary',
                      bgcolor: 'action.hover'
                    }}
                  >
                    <IconBrandWordpress size={20} stroke={1.7} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="subtitle2"
                      component="a"
                      href={s.url}
                      target="_blank"
                      rel="noopener"
                      noWrap
                      sx={{
                        display: 'block',
                        fontWeight: 700,
                        color: 'text.primary',
                        textDecoration: 'none',
                        '&:hover': { color: 'primary.main' }
                      }}
                    >
                      {s.host}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap component="div">
                      {[
                        s.plugin_version ? `plugin ${s.plugin_version}` : null,
                        s.wp_version ? `WordPress ${s.wp_version}` : null,
                        fmtAgo(s.last_seen_at)
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  </Box>
                  {s.old_key ? (
                    <TgStatusPill status="paused" label="Chave antiga" />
                  ) : s.active ? (
                    <TgStatusPill status="active" label="Traduzindo" />
                  ) : (
                    <TgStatusPill status="error" label="Pausado" />
                  )}
                </Stack>
              ))}
            </Stack>
          )}
        </TgCard>

        {/* Chave */}
        <TgCard hover={false} sx={{ p: { xs: 2.5, sm: 3 }, alignSelf: 'start' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <IconKey size={20} stroke={1.8} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Chave da conta
            </Typography>
          </Stack>
          {loading ? (
            <Skeleton height={40} />
          ) : (
            <Box
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: 2,
                bgcolor: 'action.hover',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {data?.license?.prefix ? `${data.license.prefix}••••••••••••` : '—'}
            </Box>
          )}
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.25 }}>
            Vai dentro do plugin baixado. É a mesma chave do Push In Play: trocar aqui troca para os dois. Se o arquivo vazar, gere outra:
            os sites com a chave antiga param até receberem os plugins novos.
          </Typography>
          {canManage ? (
            <Button variant="outlined" color="error" size="small" sx={{ mt: 2 }} onClick={() => setConfirmRotate(true)} disabled={loading}>
              Gerar nova chave
            </Button>
          ) : null}
        </TgCard>
      </Box>

      <TgConfirmDialog
        open={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        onConfirm={rotate}
        loading={rotating}
        danger
        title="Gerar nova chave?"
        message="A chave vale para o Tradutor Invisível E para o Push In Play. Os sites que usam os plugins atuais param até você baixar os plugins de novo e instalar neles."
        confirmLabel="Gerar nova chave"
      />
    </Box>
  );
}
