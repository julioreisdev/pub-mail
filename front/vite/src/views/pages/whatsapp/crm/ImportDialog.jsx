import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconAlertTriangle,
  IconDownload,
  IconEye,
  IconFileSpreadsheet,
  IconPlayerStop,
  IconRefresh,
  IconUpload
} from '@tabler/icons-react';

import { api, get, post } from 'api/api';
import { errMsg, fmtDateTime, tint } from '../waShared';
import { CollapsibleSection, CrmModal, waPrimaryBtn } from './crmKit';
import { useCustomFieldDefs } from './customFields';

// ============================================================================
// Importação de clientes EM SEGUNDO PLANO (Fase 8, contrato §12.3).
// Envia o CSV → POST /whatsapp/imports (job) → acompanha GET /whatsapp/imports/:id a cada 2 s
// (barra, contadores, previsão) → relatório de erros (CSV) e histórico das últimas 20.
// O processamento continua no servidor mesmo com a janela fechada.
// ============================================================================

const STATUS = {
  queued: { label: 'Na fila', color: 'info' },
  running: { label: 'Importando', color: 'primary' },
  done: { label: 'Concluída', color: 'success' },
  failed: { label: 'Falhou', color: 'error' },
  canceled: { label: 'Cancelada', color: 'default' }
};
const isOpen = (j) => j && (j.status === 'queued' || j.status === 'running');
const n = (v) => Number(v || 0).toLocaleString('pt-BR');

const COLUMNS = [
  { col: 'phone', what: 'Telefone com DDI + DDD (obrigatória). Identifica o cliente.', ex: '5511999990001' },
  { col: 'name', what: 'Nome do cliente.', ex: 'Maria Souza' },
  { col: 'doc', what: 'CPF ou CNPJ (com ou sem pontos). Precisa ser válido.', ex: '529.982.247-25' },
  { col: 'email', what: 'E-mail.', ex: 'maria@exemplo.com' },
  {
    col: 'zip · street · number · district · city · state',
    what: 'Endereço de cobrança (CEP, rua, número, bairro, cidade, UF).',
    ex: '01310100 · Av. Paulista · 1000 · …'
  },
  { col: 'notes', what: 'Observações.', ex: 'Cliente desde 2020' },
  { col: 'code', what: 'Código / matrícula / contrato (único na conta).', ex: 'MAT-001' },
  { col: 'kind', what: 'Pessoa (person) ou empresa (company).', ex: 'company' },
  { col: 'phones', what: 'Outros números do cliente, separados por |.', ex: '5511988880001|5511977770001' },
  { col: 'external_id', what: 'Id do cliente no seu sistema (ERP). Se já existir, o cliente é atualizado por ele.', ex: 'ERP-1001' },
  { col: 'unit', what: 'Unidade / filial pelo nome. Se não existir, é criada.', ex: 'Matriz' },
  { col: 'product', what: 'Plano assinado (pelo nome). Se não existir e "price" vier, é criado com a periodicidade de "billing".', ex: 'Plano Mensal' },
  { col: 'price', what: 'Valor da assinatura.', ex: '99,90' },
  {
    col: 'billing',
    what: 'Periodicidade do plano: avulso, mensal, trimestral, semestral ou anual (ou 1/3/6/12). Vazio: pelo nome do plano ("Plano Anual"), senão mensal.',
    ex: 'anual'
  },
  { col: 'due_day', what: 'Dia do vencimento (1 a 28).', ex: '10' },
  {
    col: 'next_due',
    what: 'Próximo vencimento da assinatura importada. No passado, anda de ciclo em ciclo até hoje (nada é cobrado para trás).',
    ex: '2026-11-10 ou 10/11/2026'
  },
  { col: 'balance', what: 'Saldo devedor de antes. Vira 1 cobrança em aberto (sem mensagem e sem PIX gerado).', ex: '150,00' },
  { col: 'balance_due', what: 'Vencimento do saldo (vazio = daqui a 3 dias).', ex: '2026-10-20' },
  {
    col: 'paid_history',
    what: 'Pagamentos já feitos: data:valor separados por |. Viram cobranças pagas (só histórico). Não inclua o próprio próximo vencimento.',
    ex: '2026-08-10:99,90|2026-09-10:99,90'
  }
];

async function downloadCsv(url, filename) {
  const res = await api.get(url, { responseType: 'blob' });
  const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

const fmtEta = (s) => {
  if (!s || s < 1) return null;
  if (s < 60) return `~${Math.max(1, Math.round(s))} s`;
  if (s < 3600) return `~${Math.round(s / 60)} min`;
  const h = Math.floor(s / 3600);
  return `~${h} h ${Math.round((s % 3600) / 60)} min`;
};

function Counter({ label, value, color }) {
  return (
    <Box
      sx={(t) => ({
        px: 1.5,
        py: 1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: color ? tint(t, color, 0.06) : 'transparent',
        minWidth: 0
      })}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 700, color: color ? `${color}.main` : 'text.primary' }}>
        {n(value)}
      </Typography>
    </Box>
  );
}

function OptionSwitch({ checked, onChange, label, help, disabled }) {
  return (
    <Box>
      <FormControlLabel
        control={<Switch checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />}
        label={
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
        }
        sx={{ mr: 0 }}
      />
      <Typography variant="caption" component="div" sx={{ color: 'text.secondary', ml: { xs: 0, sm: 6 }, mt: -0.5 }}>
        {help}
      </Typography>
    </Box>
  );
}

function JobView({ job, onCancel, canceling, onDownloadErrors, onRealRun, realRunning }) {
  const st = STATUS[job.status] || STATUS.queued;
  const s = job.summary || {};
  const dry = job.options?.dry_run;
  const open = isOpen(job);
  const eta = fmtEta(job.eta_seconds);
  const errs = job.errors_preview || [];
  return (
    <Stack spacing={1.75}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <IconFileSpreadsheet size={20} />
        <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 0, flex: 1, wordBreak: 'break-all' }}>
          {job.file_name || 'arquivo.csv'}
        </Typography>
        {dry ? <Chip size="small" variant="outlined" color="warning" label="Simulação" /> : null}
        <Chip size="small" color={st.color} label={st.label} icon={open ? <CircularProgress size={12} color="inherit" /> : undefined} />
      </Stack>

      <Box>
        <LinearProgress
          variant={job.status === 'queued' ? 'indeterminate' : 'determinate'}
          value={job.progress || 0}
          color={job.status === 'failed' ? 'error' : job.status === 'done' ? 'success' : 'primary'}
          sx={{ height: 8, borderRadius: 4 }}
        />
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }} spacing={1}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {n(job.processed)} de {n(job.total_rows)} linhas · {job.progress || 0}%
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {job.status === 'queued' ? 'Aguardando a vez…' : open && eta ? `${eta} restantes` : ''}
          </Typography>
        </Stack>
      </Box>

      <Grid container spacing={1}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Counter label={dry ? 'Seriam criados' : 'Novos'} value={job.created_count} color="success" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Counter label={dry ? 'Seriam atualizados' : 'Atualizados'} value={job.updated_count} color="primary" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Counter label="Pulados" value={job.skipped_count} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Counter label="Erros" value={job.error_count} color={job.error_count ? 'error' : undefined} />
        </Grid>
      </Grid>

      {s &&
      (s.subscriptions ||
        s.charges_balance ||
        s.charges_history ||
        s.units_created ||
        s.products_created ||
        s.skipped_existing ||
        s.charges_duplicated ||
        s.next_due_rolled ||
        s.subscriptions_updated) ? (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {s.subscriptions ? <Chip size="small" label={`${n(s.subscriptions)} assinaturas${dry ? ' (seriam criadas)' : ''}`} /> : null}
          {s.subscriptions_updated ? <Chip size="small" label={`${n(s.subscriptions_updated)} vencimentos ajustados`} /> : null}
          {s.charges_balance ? <Chip size="small" label={`${n(s.charges_balance)} saldos em aberto`} /> : null}
          {s.charges_history ? <Chip size="small" label={`${n(s.charges_history)} pagamentos no histórico`} /> : null}
          {s.units_created ? <Chip size="small" label={`${n(s.units_created)} unidades novas`} /> : null}
          {s.products_created ? <Chip size="small" label={`${n(s.products_created)} produtos novos`} /> : null}
          {s.skipped_existing ? (
            <Chip size="small" variant="outlined" label={`${n(s.skipped_existing)} já existiam (não atualizados)`} />
          ) : null}
          {s.charges_duplicated ? (
            <Chip size="small" variant="outlined" label={`${n(s.charges_duplicated)} cobranças já importadas antes`} />
          ) : null}
          {s.next_due_rolled ? (
            <Chip size="small" variant="outlined" label={`${n(s.next_due_rolled)} vencimentos no passado levados para a próxima data`} />
          ) : null}
        </Stack>
      ) : null}

      {s.unknown_columns?.length ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Colunas ignoradas (nome não reconhecido): {s.unknown_columns.join(', ')}.
        </Alert>
      ) : null}
      {s.unknown_custom?.length ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Campos personalizados sem cadastro (ignorados — cadastre o campo e importe de novo): {s.unknown_custom.map((k) => `custom.${k}`).join(', ')}.
        </Alert>
      ) : null}

      {job.status === 'done' ? (
        dry ? (
          <Alert
            severity={job.error_count ? 'warning' : 'success'}
            sx={{ borderRadius: 2 }}
            action={
              onRealRun ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={onRealRun}
                  disabled={realRunning}
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  Importar de verdade
                </Button>
              ) : null
            }
          >
            Simulação concluída — nada foi gravado.{' '}
            {job.error_count
              ? 'Corrija as linhas com erro (relatório abaixo) ou importe assim mesmo: linhas com erro são puladas.'
              : 'Tudo certo para importar.'}
          </Alert>
        ) : (
          <Alert severity={job.error_count ? 'warning' : 'success'} sx={{ borderRadius: 2 }}>
            Importação concluída. Nenhuma mensagem foi enviada e nada foi cobrado.
          </Alert>
        )
      ) : null}
      {job.status === 'failed' ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {job.last_error || 'A importação falhou.'}
        </Alert>
      ) : null}
      {job.status === 'canceled' ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Importação cancelada. O que já tinha sido gravado ({n(job.processed)} linhas) continua.
        </Alert>
      ) : null}
      {open ? (
        <Alert severity="info" icon={false} sx={{ borderRadius: 2 }}>
          Pode fechar esta janela: a importação continua no servidor. Volte aqui para ver o resultado.
        </Alert>
      ) : null}

      {errs.length ? (
        <Box>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{ mb: 0.75 }}
            flexWrap="wrap"
            useFlexGap
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Linhas com erro {job.error_count > errs.length ? `(primeiras ${errs.length} de ${n(job.error_count)})` : ''}
            </Typography>
            <Button
              size="small"
              startIcon={<IconDownload size={16} />}
              onClick={onDownloadErrors}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Baixar relatório de erros
            </Button>
          </Stack>
          <TableContainer sx={{ maxHeight: 240, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 64 }}>Linha</TableCell>
                  <TableCell sx={{ width: 120 }}>Campo</TableCell>
                  <TableCell>Erro</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {errs.map((e, i) => (
                  <TableRow key={`${e.line}-${i}`}>
                    <TableCell>{e.line || '—'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{e.field || '—'}</TableCell>
                    <TableCell sx={{ wordBreak: 'break-word' }}>{e.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ) : job.error_count && !open ? (
        <Button
          size="small"
          startIcon={<IconDownload size={16} />}
          onClick={onDownloadErrors}
          sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
        >
          Baixar relatório de erros
        </Button>
      ) : null}

      {open ? (
        <Button
          color="error"
          variant="outlined"
          size="small"
          startIcon={canceling ? <CircularProgress size={14} color="inherit" /> : <IconPlayerStop size={16} />}
          onClick={onCancel}
          disabled={canceling}
          sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
        >
          Cancelar importação
        </Button>
      ) : null}
    </Stack>
  );
}

export default function ImportDialog({ open, onClose, onImported }) {
  const { defs: customDefs } = useCustomFieldDefs('customer');
  const [file, setFile] = useState(null);
  const [opts, setOpts] = useState({ update_existing: true, create_products: true, dry_run: false });
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const lastStatus = useRef({});
  const fileRef = useRef(null); // o arquivo da simulação (para "Importar de verdade")

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const r = await get('/whatsapp/imports');
      const items = Array.isArray(r?.items) ? r.items : [];
      setHistory(items);
      return items;
    } catch {
      return [];
    } finally {
      setHistLoading(false);
    }
  }, []);

  // ao abrir: histórico + volta a acompanhar uma importação em andamento
  useEffect(() => {
    if (!open) return;
    loadHistory().then((items) => {
      const running = items.find(isOpen);
      if (running) {
        setJob((cur) => cur || running);
        get(`/whatsapp/imports/${running.id}`)
          .then((full) => setJob((cur) => (cur && cur.id !== running.id ? cur : full)))
          .catch(() => undefined);
      }
    });
  }, [open, loadHistory]);

  // acompanhamento ao vivo (2 s) enquanto está na fila / importando
  const jobId = job?.id;
  const jobOpen = isOpen(job);
  useEffect(() => {
    if (!open || !jobId || !jobOpen) return undefined;
    let alive = true;
    const t = setInterval(async () => {
      try {
        const j = await get(`/whatsapp/imports/${jobId}`);
        if (!alive) return;
        setJob((cur) => (cur && cur.id === j.id ? j : cur));
      } catch {
        /* rede instável: tenta no próximo */
      }
    }, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [open, jobId, jobOpen]);

  // terminou → avisa e recarrega a lista de clientes
  useEffect(() => {
    if (!job) return;
    const prev = lastStatus.current[job.id];
    lastStatus.current[job.id] = job.status;
    if (!prev || prev === job.status || isOpen(job)) return;
    loadHistory();
    if (job.status === 'done') {
      if (job.options?.dry_run) toast.success('Simulação concluída.');
      else {
        toast.success(`Importação concluída: ${n(job.created_count)} novos · ${n(job.updated_count)} atualizados.`);
        onImported?.();
      }
    } else if (job.status === 'failed') toast.error(job.last_error || 'A importação falhou.');
  }, [job, loadHistory, onImported]);

  const send = async (overrideOpts) => {
    const f = file || fileRef.current;
    if (!f) return toast.error('Escolha um arquivo CSV.');
    const o = { ...opts, ...(overrideOpts || {}) };
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', f, f.name);
      fd.append('update_existing', String(o.update_existing));
      fd.append('create_products', String(o.create_products));
      fd.append('dry_run', String(o.dry_run));
      const j = await post('/whatsapp/imports', fd, { headers: { 'Content-Type': undefined }, timeout: 180000 });
      lastStatus.current[j.id] = j.status;
      fileRef.current = o.dry_run ? f : null;
      setJob(j);
      setFile(null);
      loadHistory();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível enviar o arquivo.'));
    } finally {
      setUploading(false);
    }
    return undefined;
  };

  const cancelJob = async () => {
    if (!job) return;
    setCanceling(true);
    try {
      const j = await post(`/whatsapp/imports/${job.id}/cancel`);
      setJob(j);
      loadHistory();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível cancelar.'));
    } finally {
      setCanceling(false);
    }
  };

  const downloadErrors = async (id) => {
    try {
      await downloadCsv(`/whatsapp/imports/${id}/errors.csv`, `importacao-${String(id).slice(0, 8)}-erros.csv`);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível baixar o relatório.'));
    }
  };
  const downloadTemplate = async () => {
    try {
      await downloadCsv('/whatsapp/imports/template.csv', 'modelo-importacao-clientes.csv');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível baixar o modelo.'));
    }
  };
  const viewJob = async (id) => {
    try {
      setJob(await get(`/whatsapp/imports/${id}`));
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível abrir a importação.'));
    }
  };

  const showForm = !job;
  const footer = showForm ? (
    <>
      <Button color="inherit" onClick={onClose} disabled={uploading} sx={{ textTransform: 'none' }}>
        Fechar
      </Button>
      <Button
        variant="contained"
        disableElevation
        onClick={() => send()}
        disabled={!file || uploading}
        startIcon={
          uploading ? <CircularProgress size={15} color="inherit" /> : opts.dry_run ? <IconEye size={16} /> : <IconUpload size={16} />
        }
        sx={waPrimaryBtn}
      >
        {opts.dry_run ? 'Simular' : 'Importar'}
      </Button>
    </>
  ) : (
    <>
      <Button color="inherit" onClick={onClose} sx={{ textTransform: 'none' }}>
        Fechar
      </Button>
      <Button
        variant="outlined"
        onClick={() => setJob(null)}
        startIcon={<IconUpload size={16} />}
        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
      >
        Nova importação
      </Button>
    </>
  );

  return (
    <CrmModal
      open={open}
      onClose={onClose}
      disableClose={uploading}
      title="Importar clientes (CSV)"
      subtitle="Roda em segundo plano — até 50.000 linhas e 25 MB. Nada importado manda mensagem nem cobra."
      maxWidth="md"
      footer={footer}
    >
      <Stack spacing={2}>
        {showForm ? (
          <>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button
                component="label"
                variant="outlined"
                startIcon={<IconFileSpreadsheet size={18} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  minHeight: 44,
                  maxWidth: '100%',
                  justifyContent: 'flex-start',
                  flex: { sm: 1 }
                }}
              >
                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file
                    ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(file.size > 1024 * 1024 ? 1 : 2)} MB`
                    : 'Escolher arquivo .csv'}
                </Box>
                <input
                  hidden
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    e.target.value = '';
                    if (f && f.size > 25 * 1024 * 1024) return toast.error('O arquivo passa de 25 MB. Divida em partes menores.');
                    setFile(f);
                    return undefined;
                  }}
                />
              </Button>
              <Button
                startIcon={<IconDownload size={16} />}
                onClick={downloadTemplate}
                sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
              >
                Baixar modelo
              </Button>
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: '2px !important', lineHeight: 1.5 }}>
              Separador vírgula, ponto e vírgula ou TAB (detectado sozinho). No Excel: “Salvar como” → “CSV UTF-8”. Só a coluna{' '}
              <code>phone</code> é obrigatória; colunas com nome desconhecido são ignoradas.
            </Typography>

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 4 }}>
                <OptionSwitch
                  checked={opts.update_existing}
                  onChange={(v) => setOpts((o) => ({ ...o, update_existing: v }))}
                  label="Atualizar quem já existe"
                  help="Cliente achado pelo id externo ou pelo telefone recebe os dados da planilha. Desligado: é pulado."
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <OptionSwitch
                  checked={opts.create_products}
                  onChange={(v) => setOpts((o) => ({ ...o, create_products: v }))}
                  label="Criar produtos que faltam"
                  help="Plano que não existe e tem “price” vira um produto (periodicidade da coluna “billing”). Desligado: a linha dá erro."
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <OptionSwitch
                  checked={opts.dry_run}
                  onChange={(v) => setOpts((o) => ({ ...o, dry_run: v }))}
                  label="Só simular"
                  help="Confere tudo e mostra o que seria criado/atualizado, sem gravar nada."
                />
              </Grid>
            </Grid>

            <CollapsibleSection
              title="Colunas aceitas"
              summary="phone, name, doc, product, billing, next_due, balance, paid_history, custom.<campo>…"
            >
              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Coluna</TableCell>
                      <TableCell>O que é</TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Exemplo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {COLUMNS.map((c) => (
                      <TableRow key={c.col}>
                        <TableCell
                          sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, verticalAlign: 'top', wordBreak: 'break-word' }}
                        >
                          {c.col}
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          {c.what}
                          <Typography
                            variant="caption"
                            component="div"
                            sx={{
                              color: 'text.secondary',
                              display: { xs: 'block', sm: 'none' },
                              fontFamily: 'monospace',
                              wordBreak: 'break-all'
                            }}
                          >
                            {c.ex}
                          </Typography>
                        </TableCell>
                        <TableCell
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: 12,
                            verticalAlign: 'top',
                            wordBreak: 'break-all',
                            display: { xs: 'none', sm: 'table-cell' }
                          }}
                        >
                          {c.ex}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, verticalAlign: 'top' }}>
                        custom.&lt;chave&gt;
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top' }}>
                        Campo personalizado do cliente (validado pelo tipo). Célula vazia não apaga o valor atual.
                        {customDefs.length ? (
                          <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {customDefs.map((d) => (
                              <Chip
                                key={d.key}
                                size="small"
                                variant="outlined"
                                label={`custom.${d.key} · ${d.label}`}
                                sx={{ fontFamily: 'monospace', fontSize: 11 }}
                              />
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                            Nenhum campo personalizado cadastrado.
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell
                        sx={{ fontFamily: 'monospace', fontSize: 12, verticalAlign: 'top', display: { xs: 'none', sm: 'table-cell' } }}
                      >
                        custom.convenio = Unimed
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Alert severity="info" icon={<IconAlertTriangle size={18} />} sx={{ mt: 1.25, borderRadius: 2 }}>
                <b>paid_history</b>: cada pagamento é <code>data:valor</code> (data AAAA-MM-DD ou DD/MM/AAAA), separados por <code>|</code>{' '}
                — ex. <code>2026-08-10:99,90|2026-09-10:99,90</code>. Entram como cobranças pagas só para histórico: não mudam o vencimento
                da assinatura e não enviam recibo. Importar o mesmo arquivo de novo não duplica saldo nem histórico.
              </Alert>
            </CollapsibleSection>
          </>
        ) : (
          <JobView
            job={job}
            onCancel={cancelJob}
            canceling={canceling}
            onDownloadErrors={() => downloadErrors(job.id)}
            onRealRun={fileRef.current && job.options?.dry_run ? () => send({ dry_run: false }) : null}
            realRunning={uploading}
          />
        )}

        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Histórico de importações
            </Typography>
            <Tooltip title="Atualizar">
              <span>
                <IconButton size="small" onClick={loadHistory} disabled={histLoading} aria-label="Atualizar histórico">
                  {histLoading ? <CircularProgress size={16} /> : <IconRefresh size={16} />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          {!history.length ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {histLoading ? 'Carregando…' : 'Nenhuma importação ainda.'}
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {history.map((h) => {
                const st = STATUS[h.status] || STATUS.queued;
                const active = job?.id === h.id;
                return (
                  <Box
                    key={h.id}
                    sx={(t) => ({
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: active ? 'primary.main' : 'divider',
                      bgcolor: active ? tint(t, 'primary', 0.05) : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      flexWrap: { xs: 'wrap', sm: 'nowrap' }
                    })}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                          {h.file_name || 'arquivo.csv'}
                        </Typography>
                        {h.options?.dry_run ? (
                          <Chip size="small" variant="outlined" color="warning" label="Simulação" sx={{ height: 20 }} />
                        ) : null}
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {fmtDateTime(h.created_at)} · {n(h.processed)}/{n(h.total_rows)} linhas · {n(h.created_count)} novos ·{' '}
                        {n(h.updated_count)} atualizados
                        {h.error_count ? ` · ${n(h.error_count)} erros` : ''}
                      </Typography>
                    </Box>
                    <Chip size="small" color={st.color} label={isOpen(h) ? `${st.label} ${h.progress || 0}%` : st.label} />
                    <Stack direction="row" spacing={0.25}>
                      <Tooltip title="Ver detalhes">
                        <IconButton size="small" onClick={() => viewJob(h.id)} aria-label="Ver detalhes">
                          <IconEye size={16} />
                        </IconButton>
                      </Tooltip>
                      {h.error_count ? (
                        <Tooltip title="Baixar relatório de erros">
                          <IconButton size="small" onClick={() => downloadErrors(h.id)} aria-label="Baixar relatório de erros">
                            <IconDownload size={16} />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      </Stack>
    </CrmModal>
  );
}
