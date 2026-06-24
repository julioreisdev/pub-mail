import { useEffect, useState } from 'react';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import CircularProgress from '@mui/material/CircularProgress';

import { get, patch } from 'api/api';

const getErr = (e, f) => e?.response?.data?.message || e?.response?.data?.error || e?.message || f;

const EMPTY_TOPO = {
  ativo: true,
  codigo_tag: '',
  gpt_sizes: '320x100',
  gpt_slot: '',
  gpt_div_id: '',
  rotulo: 'PUBLICIDADE',
  rotuloAtivo: true
};

// Por ora só "topo". A estrutura já aceita novas posições no back.
const POSITIONS = [{ value: 'topo', label: 'Topo (acima do quiz)' }];

export default function QuizAdsDialog({ open, quiz, onClose }) {
  const [position, setPosition] = useState('topo');
  const [topo, setTopo] = useState(EMPTY_TOPO);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!open || !quiz?.id) return;
    let alive = true;
    setLoading(true);
    setError('');
    setSuccess('');
    setShowAdvanced(false);
    setPosition('topo');
    (async () => {
      try {
        const data = await get(`/quizzes/${quiz.id}/ads`);
        if (!alive) return;
        const t = data?.topo;
        if (t) {
          setTopo({
            ativo: t.ativo !== false,
            codigo_tag: t.codigo_tag || t.anuncio_fixed || '',
            gpt_sizes: typeof t.gpt_sizes === 'string' ? t.gpt_sizes : JSON.stringify(t.gpt_sizes || '320x100'),
            gpt_slot: t.gpt_slot || '',
            gpt_div_id: t.gpt_div_id || '',
            rotulo: t.rotulo || 'PUBLICIDADE',
            rotuloAtivo: t.rotuloAtivo !== false
          });
        } else {
          setTopo(EMPTY_TOPO);
        }
      } catch (e) {
        if (alive) setError(getErr(e, 'Falha ao carregar anúncios.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, quiz?.id]);

  const set = (k) => (e) => setTopo((p) => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      // codigo_tag vazio => back remove a posição. ativo=false => preserva mas
      // não exibe no público.
      const payload = {
        topo: {
          codigo_tag: topo.codigo_tag,
          gpt_sizes: topo.gpt_sizes,
          gpt_slot: topo.gpt_slot,
          gpt_div_id: topo.gpt_div_id,
          rotulo: topo.rotulo,
          rotuloAtivo: topo.rotuloAtivo,
          ativo: topo.ativo
        }
      };
      await patch(`/quizzes/${quiz.id}/ads`, payload);
      setSuccess('Anúncios salvos.');
    } catch (e) {
      setError(getErr(e, 'Falha ao salvar anúncios.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Anúncios — {quiz?.name}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}>
            <CircularProgress size={26} />
          </Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {success ? <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert> : null}

            <TextField select size="small" label="Posição" value={position} onChange={(e) => setPosition(e.target.value)} helperText="Mais posições (rodapé, intersticial) chegam em breve.">
              {POSITIONS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>

            <Divider />

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Exibir anúncio no topo
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Desligar mantém a configuração salva, mas não exibe no quiz.
                </Typography>
              </Box>
              <Switch checked={topo.ativo} onChange={(e) => setTopo((p) => ({ ...p, ativo: e.target.checked }))} />
            </Stack>

            <TextField
              label="Código do anúncio"
              value={topo.codigo_tag}
              onChange={set('codigo_tag')}
              fullWidth
              multiline
              minRows={4}
              maxRows={12}
              placeholder="Cole a TAG do Google Ad Manager (GPT) OU o HTML/<script> do anúncio (ADX)."
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
              helperText="GPT: o slot/div/tamanho são detectados do código. Você pode usar HTML puro também. Vazio = remove o anúncio."
            />

            <TextField
              size="small"
              label="Tamanho"
              value={topo.gpt_sizes}
              onChange={set('gpt_sizes')}
              placeholder="320x100"
              helperText='Ex.: "320x100" ou "[320,100]". Usado pelo slot GPT.'
              sx={{ maxWidth: 220 }}
            />

            <Button size="small" onClick={() => setShowAdvanced((v) => !v)} sx={{ alignSelf: 'flex-start' }}>
              {showAdvanced ? 'Ocultar avançado' : 'Opções avançadas (GPT)'}
            </Button>
            <Collapse in={showAdvanced}>
              <Stack spacing={1.5}>
                <TextField size="small" label="GPT slot (opcional)" value={topo.gpt_slot} onChange={set('gpt_slot')} placeholder="/12345/seu-slot" helperText="Deixe vazio para detectar do código." />
                <TextField size="small" label="GPT div id (opcional)" value={topo.gpt_div_id} onChange={set('gpt_div_id')} placeholder="div-gpt-ad-xxxx" />
              </Stack>
            </Collapse>

            <Divider />

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Exibir rótulo de publicidade
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Recomendado pelo Google Ad Manager. Desligue se o criativo já traz o rótulo.
                </Typography>
              </Box>
              <Switch checked={topo.rotuloAtivo} onChange={(e) => setTopo((p) => ({ ...p, rotuloAtivo: e.target.checked }))} />
            </Stack>
            {topo.rotuloAtivo ? (
              <TextField size="small" label="Texto do rótulo" value={topo.rotulo} onChange={set('rotulo')} placeholder="PUBLICIDADE" sx={{ maxWidth: 260 }} />
            ) : null}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Fechar
        </Button>
        <Button variant="contained" color="secondary" onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Salvando…' : 'Salvar anúncios'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
