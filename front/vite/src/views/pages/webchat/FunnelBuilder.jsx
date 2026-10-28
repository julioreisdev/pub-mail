import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { AddRoundedIcon as AddRoundedIcon } from 'ui-component/icons';
import { DeleteRoundedIcon as DeleteRoundedIcon } from 'ui-component/icons';
import { ArrowUpwardRoundedIcon as ArrowUpwardRoundedIcon } from 'ui-component/icons';
import { ArrowDownwardRoundedIcon as ArrowDownwardRoundedIcon } from 'ui-component/icons';

import {
  DEFAULT_FUNIL,
  VARIAVEIS_LEAD,
  createDefaultMessage,
  createDefaultOption,
  createDefaultSequence,
  makeId,
  normalizeFunil,
  calculateFunilMediaBytes,
  FUNIL_MAX_MEDIA_BYTES,
  formatBytes,
  dataUrlBytes,
  LEAD_CAPTURE_PRESETS,
  createDefaultCharge,
  formatBRL,
  normalizeRedirectUrl,
} from './funnel-utils';
import RichTextField from './RichTextField';
import ClipMessageEditor from './ClipMessageEditor';
import AudioRecorder from './AudioRecorder';
import { get, post } from 'api/api';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Chip,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
} from '@mui/material';
import { IconChevronDown, IconCreditCard, IconFileTypePdf, IconLock, IconUpload, IconVideo } from '@tabler/icons-react';

// Nó customizado do ReactFlow: card representando uma sequência. Mostra
// nome, número de mensagens e tipo de fim (opções X / esperar input).
function SequenceNode({ data, selected }) {
  const seq = data?.sequence;
  const isStart = data?.isStart;
  const isDelivery = data?.isDelivery;
  const protectedCount = (seq?.messages || []).filter((m) => m?.type === 'file' || m?.type === 'video').length;
  const optionsCount = seq?.ending?.type === 'options' ? (seq.ending.options || []).length : 0;
  const messagesCount = (seq?.messages || []).length;

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        boxShadow: selected ? 3 : 1,
        minWidth: 220,
        maxWidth: 260,
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#999' }} />
      <Box sx={{ p: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2" sx={{ fontWeight: 800, flex: 1 }} noWrap>
            {seq?.name || 'Sequência'}
          </Typography>
          {isStart ? (
            <Typography
              variant="caption"
              sx={{ bgcolor: 'success.main', color: 'common.white', px: 0.75, borderRadius: 1, fontWeight: 700 }}
            >
              Início
            </Typography>
          ) : null}
          {isDelivery ? (
            <Tooltip title="Sequência de ENTREGA: só chega ao lead depois do pagamento confirmado">
              <Typography
                variant="caption"
                sx={{ bgcolor: '#7c3aed', color: 'common.white', px: 0.75, borderRadius: 1, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
              >
                <IconLock size={11} /> Entrega
              </Typography>
            </Tooltip>
          ) : null}
        </Stack>
      </Box>
      <Box sx={{ p: 1.25 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          📩 {messagesCount} mensage{messagesCount === 1 ? 'm' : 'ns'}
        </Typography>
        {seq?.ending?.type === 'options' && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            🔘 {optionsCount} {optionsCount === 1 ? 'botão' : 'botões'}
          </Typography>
        )}
        {seq?.ending?.type === 'wait_input' && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            ⌨️ Espera resposta
            {seq.ending.captureVariable ? ` → {{${seq.ending.captureVariable}}}` : ''}
          </Typography>
        )}
        {seq?.ending?.type === 'end' && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            🏁 Fim do funil
          </Typography>
        )}
        {seq?.ending?.type === 'charge' && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontWeight: 700, color: '#2e7d32' }}>
            💳 Cobrança PIX · {formatBRL(seq.ending.charge?.amountCents || 0)}
            {!seq.ending.charge?.onPaidSequenceId ? (
              <Typography component="span" variant="caption" sx={{ color: 'warning.main', display: 'block', fontWeight: 600 }}>
                ⚠ sem sequência de entrega
              </Typography>
            ) : null}
          </Typography>
        )}
        {protectedCount > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            📎 {protectedCount} arquivo{protectedCount === 1 ? '' : 's'} protegido{protectedCount === 1 ? '' : 's'}
          </Typography>
        )}
      </Box>
      <Handle type="source" position={Position.Bottom} style={{ background: '#999' }} />
    </Box>
  );
}

const NODE_TYPES = { sequence: SequenceNode };

function FunnelBuilderImpl({ value, onChange, height = 700 }) {
  // Estado interno = funil normalizado. Sempre que muda, propagamos via
  // onChange. Usamos um ref pra evitar loop quando o pai re-passa value.
  const [funil, setFunil] = useState(() => normalizeFunil(value));
  const lastEmittedRef = useRef(funil);
  const [selectedSequenceId, setSelectedSequenceId] = useState(() => {
    const initial = normalizeFunil(value);
    return initial.startSequenceId || Object.keys(initial.sequences)[0] || '';
  });

  // Aceita atualização externa do value (ex: depois de salvar) sem
  // sobrescrever edições em andamento — só re-aplica se o conteúdo mudou.
  useEffect(() => {
    const incoming = normalizeFunil(value);
    if (JSON.stringify(incoming) !== JSON.stringify(lastEmittedRef.current)) {
      setFunil(incoming);
      lastEmittedRef.current = incoming;
      if (!incoming.sequences[selectedSequenceId]) {
        const fallback = incoming.startSequenceId || Object.keys(incoming.sequences)[0] || '';
        setSelectedSequenceId(fallback);
      }
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = useCallback(
    (next) => {
      lastEmittedRef.current = next;
      setFunil(next);
      onChange?.(next);
    },
    [onChange],
  );

  // Garante pelo menos 1 sequência inicial quando o usuário começa.
  useEffect(() => {
    if (Object.keys(funil.sequences).length === 0) {
      const seq = createDefaultSequence('Boas-vindas');
      seq.position = { x: 80, y: 80 };
      const next = {
        ...funil,
        sequences: { [seq.id]: seq },
        startSequenceId: seq.id,
      };
      emit(next);
      setSelectedSequenceId(seq.id);
    }
  }, [funil, emit]);

  const sequenceList = useMemo(() => Object.values(funil.sequences), [funil.sequences]);
  const selectedSequence = funil.sequences[selectedSequenceId] || null;

  // Sequências que são ENTREGA (alvo de alguma cobrança) — ganham badge no
  // canvas e aviso no editor: seu conteúdo só chega após o pagamento.
  const deliveryIds = useMemo(() => {
    const set = new Set();
    sequenceList.forEach((seq) => {
      if (seq.ending?.type === 'charge' && seq.ending.charge?.onPaidSequenceId) {
        set.add(seq.ending.charge.onPaidSequenceId);
      }
    });
    return set;
  }, [sequenceList]);

  // Gateway PIX da organização (Configurações → Pagamentos). Só informativo:
  // sem gateway pronto a cobrança não vai funcionar no chat.
  const [gateway, setGateway] = useState(null);
  useEffect(() => {
    let alive = true;
    get('/payments/settings')
      .then((g) => alive && setGateway(g))
      .catch(() => alive && setGateway({ ready: false, error: true }));
    return () => {
      alive = false;
    };
  }, []);

  // Modelo -> nodes do ReactFlow. Fonte da verdade ESTRUTURAL (qtd de
  // sequências, conteúdo, seleção, posição salva).
  const derivedNodes = useMemo(() => {
    return sequenceList.map((seq) => ({
      id: seq.id,
      type: 'sequence',
      position: seq.position || { x: 0, y: 0 },
      data: { sequence: seq, isStart: seq.id === funil.startSequenceId, isDelivery: deliveryIds.has(seq.id) },
      selected: seq.id === selectedSequenceId,
    }));
  }, [sequenceList, funil.startSequenceId, selectedSequenceId, deliveryIds]);

  // Estado LOCAL de nodes do ReactFlow. Durante o drag o ReactFlow mexe
  // só aqui (movimento suave). NÃO emitimos pro modelo a cada frame — era
  // isso que reconstruía o array de nodes no meio do gesto e fazia o bloco
  // sumir / a tela ficar branca. O modelo só é atualizado no onNodeDragStop.
  const [nodes, setNodes, onNodesChange] = useNodesState(derivedNodes);

  // Re-sincroniza os nodes locais quando o MODELO muda por motivo
  // estrutural (add/remover sequência, seleção, edição no painel lateral).
  // Não dispara durante o drag porque o modelo fica estável nesse intervalo.
  useEffect(() => {
    setNodes(derivedNodes);
  }, [derivedNodes, setNodes]);

  const edges = useMemo(() => {
    const out = [];
    sequenceList.forEach((seq) => {
      if (seq.ending?.type === 'options') {
        (seq.ending.options || []).forEach((opt, idx) => {
          if (opt.action?.type === 'goto' && opt.action.sequenceId && funil.sequences[opt.action.sequenceId]) {
            out.push({
              id: `${seq.id}-${opt.id}`,
              source: seq.id,
              target: opt.action.sequenceId,
              label: (opt.label || `Botão ${idx + 1}`).slice(0, 24),
              labelStyle: { fontSize: 11, fontWeight: 600 },
              labelBgPadding: [4, 2],
              labelBgBorderRadius: 4,
              labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { stroke: '#2979ff' },
            });
          }
        });
      } else if (seq.ending?.type === 'charge' && seq.ending.charge?.onPaidSequenceId && funil.sequences[seq.ending.charge.onPaidSequenceId]) {
        out.push({
          id: `${seq.id}-paid`,
          source: seq.id,
          target: seq.ending.charge.onPaidSequenceId,
          label: `✅ pago · ${formatBRL(seq.ending.charge.amountCents || 0)}`,
          labelStyle: { fontSize: 11, fontWeight: 700, fill: '#2e7d32' },
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 4,
          labelBgStyle: { fill: '#fff', fillOpacity: 0.95 },
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#2e7d32' },
          style: { stroke: '#2e7d32', strokeWidth: 2 },
        });
      } else if (seq.ending?.type === 'wait_input' && seq.ending.nextSequenceId && funil.sequences[seq.ending.nextSequenceId]) {
        out.push({
          id: `${seq.id}-wait-next`,
          source: seq.id,
          target: seq.ending.nextSequenceId,
          label: seq.ending.captureVariable ? `→ {{${seq.ending.captureVariable}}}` : '→ resposta',
          labelStyle: { fontSize: 11, fontWeight: 600 },
          labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#9c27b0', strokeDasharray: '6 4' },
        });
      }
    });
    return out;
  }, [sequenceList, funil.sequences]);

  // Persiste a posição no modelo só quando o usuário SOLTA o bloco.
  // Evita o storm de re-render a cada frame de drag (causa do bug do bloco
  // sumindo / tela branca). Suporta arraste de múltiplos nós selecionados.
  const onNodeDragStop = useCallback(
    (_evt, node, draggedNodes) => {
      const list = draggedNodes && draggedNodes.length ? draggedNodes : node ? [node] : [];
      if (!list.length) return;
      let changed = false;
      const nextSequences = { ...funil.sequences };
      list.forEach((n) => {
        const cur = nextSequences[n.id];
        if (!cur) return;
        const x = Math.round(n.position.x);
        const y = Math.round(n.position.y);
        if (cur.position && cur.position.x === x && cur.position.y === y) return;
        nextSequences[n.id] = { ...cur, position: { x, y } };
        changed = true;
      });
      if (node) setSelectedSequenceId(node.id);
      if (changed) emit({ ...funil, sequences: nextSequences });
    },
    [funil, emit],
  );

  // ReactFlow precisa do callback mesmo que ignoremos — bloqueia warning.
  const onEdgesChange = useCallback((_changes) => {}, []);

  const handleNodeClick = useCallback((_evt, node) => {
    setSelectedSequenceId(node.id);
  }, []);

  // ===== Mutations =====

  function patchSequence(seqId, patch) {
    const cur = funil.sequences[seqId];
    if (!cur) return;
    const next = {
      ...funil,
      sequences: { ...funil.sequences, [seqId]: { ...cur, ...patch } },
    };
    emit(next);
  }

  function addSequence() {
    const positions = sequenceList.map((s) => s.position || { x: 0, y: 0 });
    const maxY = positions.reduce((acc, p) => Math.max(acc, p.y), 0);
    const seq = createDefaultSequence(`Sequência ${sequenceList.length + 1}`);
    seq.position = { x: 80, y: maxY + 200 };
    const next = {
      ...funil,
      sequences: { ...funil.sequences, [seq.id]: seq },
      startSequenceId: funil.startSequenceId || seq.id,
    };
    emit(next);
    setSelectedSequenceId(seq.id);
  }

  function deleteSequence(seqId) {
    if (!seqId) return;
    if (sequenceList.length <= 1) {
      // eslint-disable-next-line no-alert
      window.alert('O funil precisa ter ao menos uma sequência.');
      return;
    }
    // Clona cada sequência antes de mexer — sem isso `s.ending = …` mutava o
    // estado anterior (prev) e o React não enxergava a mudança.
    const nextSequences = {};
    Object.keys(funil.sequences || {}).forEach((id) => {
      if (id !== seqId) nextSequences[id] = { ...funil.sequences[id] };
    });
    // Limpa referências (options.action.goto + wait_input.nextSequenceId)
    Object.keys(nextSequences).forEach((id) => {
      const s = nextSequences[id];
      if (s.ending?.type === 'options') {
        s.ending = {
          ...s.ending,
          options: (s.ending.options || []).map((o) =>
            o.action?.type === 'goto' && o.action.sequenceId === seqId
              ? { ...o, action: { ...o.action, sequenceId: '' } }
              : o,
          ),
        };
      }
      if (s.ending?.type === 'wait_input' && s.ending.nextSequenceId === seqId) {
        s.ending = { ...s.ending, nextSequenceId: '' };
      }
      if (s.ending?.type === 'charge' && s.ending.charge?.onPaidSequenceId === seqId) {
        s.ending = { ...s.ending, charge: { ...s.ending.charge, onPaidSequenceId: '' } };
      }
    });
    let nextStart = funil.startSequenceId;
    if (nextStart === seqId) {
      nextStart = Object.keys(nextSequences)[0] || '';
    }
    // Captação intermediária apontando pra sequência apagada → desliga.
    const lc = funil.leadCapture || {};
    const leadCapture =
      lc.triggerSequenceId === seqId ? { ...lc, triggerSequenceId: '' } : lc;
    emit({ ...funil, sequences: nextSequences, startSequenceId: nextStart, leadCapture });
    setSelectedSequenceId(nextStart);
  }

  function setAsStart(seqId) {
    emit({ ...funil, startSequenceId: seqId });
  }

  function patchMessage(seqId, msgId, patch) {
    const seq = funil.sequences[seqId];
    if (!seq) return;
    const messages = (seq.messages || []).map((m) => (m.id === msgId ? { ...m, ...patch } : m));
    patchSequence(seqId, { messages });
  }

  function addMessage(seqId, kind = 'text') {
    const seq = funil.sequences[seqId];
    if (!seq) return;
    const messages = [...(seq.messages || []), createDefaultMessage(kind)];
    patchSequence(seqId, { messages });
  }

  function removeMessage(seqId, msgId) {
    const seq = funil.sequences[seqId];
    if (!seq) return;
    const messages = (seq.messages || []).filter((m) => m.id !== msgId);
    if (messages.length === 0) {
      messages.push(createDefaultMessage('text'));
    }
    patchSequence(seqId, { messages });
  }

  function moveMessage(seqId, msgId, dir) {
    const seq = funil.sequences[seqId];
    if (!seq) return;
    const arr = [...(seq.messages || [])];
    const idx = arr.findIndex((m) => m.id === msgId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    patchSequence(seqId, { messages: arr });
  }

  function setEndingType(seqId, type) {
    const seq = funil.sequences[seqId];
    if (!seq) return;
    const ending = {
      type,
      options: type === 'options' ? seq.ending?.options?.length ? seq.ending.options : [createDefaultOption()] : [],
      captureVariable: type === 'wait_input' ? seq.ending?.captureVariable || '' : '',
      nextSequenceId: type === 'wait_input' ? seq.ending?.nextSequenceId || '' : '',
      // Preserva a config da cobrança se o usuário alternar e voltar.
      charge: type === 'charge' ? seq.ending?.charge || createDefaultCharge() : seq.ending?.charge,
    };
    patchSequence(seqId, { ending });
  }

  function patchCharge(seqId, patch) {
    const seq = funil.sequences[seqId];
    if (!seq?.ending || seq.ending.type !== 'charge') return;
    const charge = { ...(seq.ending.charge || createDefaultCharge()), ...patch };
    patchSequence(seqId, { ending: { ...seq.ending, charge } });
  }

  // Cria a sequência de ENTREGA já ligada à cobrança (atalho pro usuário leigo).
  function createDeliverySequence(seqId) {
    const seq = funil.sequences[seqId];
    if (!seq?.ending || seq.ending.type !== 'charge') return;
    const positions = sequenceList.map((s) => s.position || { x: 0, y: 0 });
    const maxY = positions.reduce((acc, p) => Math.max(acc, p.y), 0);
    const delivery = createDefaultSequence(`Entrega — ${seq.name || 'produto'}`);
    delivery.messages = [{ ...createDefaultMessage('text'), html: 'Aqui está o seu produto 🎁 Bom proveito!' }];
    delivery.ending = { type: 'end', options: [], captureVariable: '', nextSequenceId: '' };
    delivery.position = { x: (seq.position?.x || 80) + 320, y: Math.max(maxY, seq.position?.y || 0) + 60 };
    const next = {
      ...funil,
      sequences: {
        ...funil.sequences,
        [delivery.id]: delivery,
        [seqId]: { ...seq, ending: { ...seq.ending, charge: { ...(seq.ending.charge || createDefaultCharge()), onPaidSequenceId: delivery.id } } },
      },
    };
    emit(next);
    setSelectedSequenceId(delivery.id);
  }

  function patchOption(seqId, optId, patch) {
    const seq = funil.sequences[seqId];
    if (!seq?.ending) return;
    const options = (seq.ending.options || []).map((o) => (o.id === optId ? { ...o, ...patch } : o));
    patchSequence(seqId, { ending: { ...seq.ending, options } });
  }

  function patchOptionAction(seqId, optId, actionPatch) {
    const seq = funil.sequences[seqId];
    if (!seq?.ending) return;
    const options = (seq.ending.options || []).map((o) =>
      o.id === optId ? { ...o, action: { ...o.action, ...actionPatch } } : o,
    );
    patchSequence(seqId, { ending: { ...seq.ending, options } });
  }

  function addOption(seqId) {
    const seq = funil.sequences[seqId];
    if (!seq?.ending || seq.ending.type !== 'options') return;
    const options = [...(seq.ending.options || []), createDefaultOption()];
    patchSequence(seqId, { ending: { ...seq.ending, options } });
  }

  function removeOption(seqId, optId) {
    const seq = funil.sequences[seqId];
    if (!seq?.ending || seq.ending.type !== 'options') return;
    const options = (seq.ending.options || []).filter((o) => o.id !== optId);
    patchSequence(seqId, { ending: { ...seq.ending, options } });
  }

  // Captação de lead intermediária — só pode ser usada UMA VEZ no funil.
  // Setar em uma seq desativa em todas as outras automaticamente.
  function setLeadCaptureForSequence(seqId, fieldsPreset) {
    const fields = LEAD_CAPTURE_PRESETS[fieldsPreset] ? fieldsPreset : '';
    const prevPrompts = funil?.leadCapture?.prompts || {};
    emit({
      ...funil,
      leadCapture: {
        triggerSequenceId: fields ? seqId : '',
        fields,
        prompts: {
          // Preserva TODOS os prompts custom (intro/closing incluídos) —
          // trocar o preset de campos não pode apagar os textos.
          intro: prevPrompts.intro || '',
          closing: prevPrompts.closing || '',
          nome: prevPrompts.nome || '',
          telefone: prevPrompts.telefone || '',
          email: prevPrompts.email || '',
        },
      },
    });
  }

  // Atualiza um prompt específico (nome/telefone/email) sem mexer
  // no resto da config de captação.
  function setLeadCapturePrompt(field, value) {
    const cur = funil?.leadCapture || {};
    emit({
      ...funil,
      leadCapture: {
        ...cur,
        prompts: {
          ...(cur.prompts || {}),
          [field]: String(value || '').slice(0, 300),
        },
      },
    });
  }

  // Mensagem final do funil + flag de takeover da IA. Configuração
  // global (uma única por funil, não por sequência).
  function setEndingPatch(patch) {
    emit({
      ...funil,
      ending: { ...(funil?.ending || {}), ...patch },
    });
  }

  // Total de bytes consumido por mídia — alerta se ultrapassar limite.
  const totalMediaBytes = useMemo(() => calculateFunilMediaBytes(funil), [funil]);

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, height: { xs: 'auto', md: height } }}>
      {/* Canvas */}
      <Paper sx={{ flex: 1, height: { xs: 480, md: 'auto' }, position: 'relative', overflow: 'hidden' }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 5,
            bgcolor: 'background.paper',
            borderRadius: 2,
            p: 0.5,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Button size="small" startIcon={<AddRoundedIcon />} onClick={addSequence}>
            Nova sequência
          </Button>
        </Stack>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </Paper>

      {/* Sidebar */}
      <Paper sx={{ width: { xs: '100%', md: 380 }, p: 2, overflow: 'auto', maxHeight: { xs: 'none', md: height } }}>
        {selectedSequence ? (
          <SequenceEditor
            sequence={selectedSequence}
            funil={funil}
            isStart={selectedSequence.id === funil.startSequenceId}
            onSetAsStart={() => setAsStart(selectedSequence.id)}
            onPatch={(patch) => patchSequence(selectedSequence.id, patch)}
            onDelete={() => deleteSequence(selectedSequence.id)}
            onAddMessage={(kind) => addMessage(selectedSequence.id, kind)}
            onPatchMessage={(msgId, patch) => patchMessage(selectedSequence.id, msgId, patch)}
            onRemoveMessage={(msgId) => removeMessage(selectedSequence.id, msgId)}
            onMoveMessage={(msgId, dir) => moveMessage(selectedSequence.id, msgId, dir)}
            onSetEndingType={(type) => setEndingType(selectedSequence.id, type)}
            onPatchOption={(optId, patch) => patchOption(selectedSequence.id, optId, patch)}
            onPatchOptionAction={(optId, patch) => patchOptionAction(selectedSequence.id, optId, patch)}
            onAddOption={() => addOption(selectedSequence.id)}
            onRemoveOption={(optId) => removeOption(selectedSequence.id, optId)}
            onSetLeadCapture={(fields) => setLeadCaptureForSequence(selectedSequence.id, fields)}
            onSetLeadCapturePrompt={setLeadCapturePrompt}
            onSetEnding={setEndingPatch}
            onPatchCharge={(patch) => patchCharge(selectedSequence.id, patch)}
            onCreateDeliverySequence={() => createDeliverySequence(selectedSequence.id)}
            gateway={gateway}
            isDelivery={deliveryIds.has(selectedSequence.id)}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            Crie uma sequência para começar.
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Mídia total: {formatBytes(totalMediaBytes)} / {formatBytes(FUNIL_MAX_MEDIA_BYTES)}
        </Typography>
        {totalMediaBytes > FUNIL_MAX_MEDIA_BYTES && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            O funil está ultrapassando 5MB de mídia. Considere reduzir tamanho de imagens ou áudios.
          </Alert>
        )}
      </Paper>
    </Box>
  );
}

// React.memo: evita re-render quando o pai re-renderiza por motivos
// não-relacionados (ex: usuário mexendo em outra aba do builder).
// Sem memo, o ReactFlow inteiro era recomputado a cada keystroke
// em qualquer aba, travando a UI por alguns ms.
const FunnelBuilder = memo(FunnelBuilderImpl);
export default FunnelBuilder;

// =============================================================================
// SequenceEditor — sidebar de edição da sequência selecionada
// =============================================================================

function SequenceEditor({
  sequence,
  funil,
  isStart,
  onSetAsStart,
  onPatch,
  onDelete,
  onAddMessage,
  onPatchMessage,
  onRemoveMessage,
  onMoveMessage,
  onSetEndingType,
  onPatchOption,
  onPatchOptionAction,
  onAddOption,
  onRemoveOption,
  onSetLeadCapture,
  onSetLeadCapturePrompt,
  onSetEnding,
  onPatchCharge,
  onCreateDeliverySequence,
  gateway,
  isDelivery,
}) {
  const otherSequences = useMemo(
    () => Object.values(funil.sequences).filter((s) => s.id !== sequence.id),
    [funil.sequences, sequence.id],
  );

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="subtitle1" sx={{ fontWeight: 800, flex: 1 }}>
          {isStart ? '🚩 ' : ''}Editando sequência
        </Typography>
        {!isStart ? (
          <Tooltip title="Definir como sequência inicial">
            <Button size="small" onClick={onSetAsStart}>
              Definir como início
            </Button>
          </Tooltip>
        ) : null}
        <Tooltip title="Excluir sequência">
          <IconButton size="small" color="error" onClick={onDelete}>
            <DeleteRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <TextField
        label="Nome da sequência"
        value={sequence.name}
        onChange={(e) => onPatch({ name: e.target.value })}
        fullWidth
        size="small"
      />

      {isDelivery ? (
        <Alert severity="info" icon={<IconLock size={18} />} sx={{ py: 0.5 }}>
          <strong>Sequência de entrega.</strong> As mensagens abaixo (incluindo arquivos e vídeos) só são enviadas ao lead{' '}
          <strong>depois do pagamento confirmado</strong>. Coloque aqui o produto: PDF, vídeo, fotos, áudios e o texto de agradecimento.
        </Alert>
      ) : null}

      <Divider>Mensagens</Divider>

      <Stack spacing={1.5}>
        {(sequence.messages || []).map((msg, idx) => (
          <MessageEditor
            key={msg.id}
            message={msg}
            index={idx}
            total={sequence.messages.length}
            onPatch={(patch) => onPatchMessage(msg.id, patch)}
            onRemove={() => onRemoveMessage(msg.id)}
            onMove={(dir) => onMoveMessage(msg.id, dir)}
          />
        ))}
      </Stack>

      <Box>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75 }}>
          Adicionar mensagem
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
          <Button size="small" variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => onAddMessage('text')} sx={{ borderRadius: 2 }}>
            Texto
          </Button>
          <Button size="small" variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => onAddMessage('image')} sx={{ borderRadius: 2 }}>
            Imagem
          </Button>
          <Button size="small" variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => onAddMessage('audio')} sx={{ borderRadius: 2 }}>
            Áudio
          </Button>
          <Button size="small" variant="outlined" startIcon={<IconVideo size={16} />} onClick={() => onAddMessage('clip')} sx={{ borderRadius: 2 }}>
            Vídeo
          </Button>
          <Tooltip title="Arquivo (PDF, zip…) hospedado no servidor e liberado só depois do pagamento (entrega de produto)">
            <Button size="small" variant="outlined" startIcon={<IconFileTypePdf size={16} />} onClick={() => onAddMessage('file')} sx={{ borderRadius: 2 }}>
              Arquivo protegido
            </Button>
          </Tooltip>
          <Tooltip title="Vídeo hospedado no servidor e liberado só depois do pagamento (entrega de produto)">
            <Button size="small" variant="outlined" startIcon={<IconLock size={16} />} onClick={() => onAddMessage('video')} sx={{ borderRadius: 2 }}>
              Vídeo protegido
            </Button>
          </Tooltip>
        </Stack>
      </Box>

      <Divider>Como termina?</Divider>

      <TextField
        select
        size="small"
        label="Tipo de finalização"
        value={sequence.ending?.type || 'options'}
        onChange={(e) => onSetEndingType(e.target.value)}
        fullWidth
      >
        <MenuItem value="options">Mostrar botões</MenuItem>
        <MenuItem value="wait_input">Esperar resposta digitada</MenuItem>
        <MenuItem value="charge">💳 Cobrança PIX (vender produto)</MenuItem>
        <MenuItem value="end">Encerrar funil</MenuItem>
      </TextField>

      {sequence.ending?.type === 'charge' && (
        <ChargeEditor
          sequence={sequence}
          otherSequences={otherSequences}
          gateway={gateway}
          onPatchCharge={onPatchCharge}
          onCreateDeliverySequence={onCreateDeliverySequence}
        />
      )}

      {sequence.ending?.type === 'options' && (
        <OptionsEditor
          sequence={sequence}
          otherSequences={otherSequences}
          onPatchOption={onPatchOption}
          onPatchOptionAction={onPatchOptionAction}
          onAddOption={onAddOption}
          onRemoveOption={onRemoveOption}
        />
      )}

      {sequence.ending?.type === 'wait_input' && (
        <WaitInputEditor
          sequence={sequence}
          otherSequences={otherSequences}
          onPatch={(endingPatch) =>
            onPatch({ ending: { ...sequence.ending, ...endingPatch } })
          }
        />
      )}

      {sequence.ending?.type === 'end' && (
        <Alert severity="info">
          Esta sequência encerra o funil. Ideal para finalização ou agradecimento.
        </Alert>
      )}

      <Divider>Captação de lead</Divider>

      <LeadCaptureSection
        sequence={sequence}
        funil={funil}
        onSetLeadCapture={onSetLeadCapture}
        onSetLeadCapturePrompt={onSetLeadCapturePrompt}
      />

      <Divider>Encerramento do funil</Divider>

      <EndingSection funil={funil} onSetEnding={onSetEnding} />
    </Stack>
  );
}

// LeadCaptureSection — toggle + select de campos pra disparar captação
// intermediária após a sequência atual. Restrição: só uma seq do funil
// pode ter captação ativada por vez (setar aqui desativa em outras).
function LeadCaptureSection({ sequence, funil, onSetLeadCapture, onSetLeadCapturePrompt }) {
  const isActiveHere =
    funil?.leadCapture?.triggerSequenceId === sequence.id &&
    Boolean(funil?.leadCapture?.fields);
  const activeOnOtherId = funil?.leadCapture?.triggerSequenceId;
  const activeOnOther =
    Boolean(activeOnOtherId) &&
    activeOnOtherId !== sequence.id &&
    Boolean(funil?.leadCapture?.fields);
  const otherName =
    activeOnOther && funil?.sequences?.[activeOnOtherId]?.name
      ? funil.sequences[activeOnOtherId].name
      : '';

  const fieldsPreset = isActiveHere ? funil.leadCapture.fields : '';
  const activeFields = LEAD_CAPTURE_PRESETS[fieldsPreset] || [];
  const prompts = funil?.leadCapture?.prompts || {};

  // Placeholders padrão usados se o admin deixar vazio.
  const placeholders = {
    nome: 'Pra começar, qual é o seu nome? 👋',
    telefone: 'Qual seu telefone com DDD? 📱',
    email: 'Qual seu melhor e-mail? 📩',
  };
  const labels = {
    nome: 'Mensagem que o bot envia pedindo o NOME',
    telefone: 'Mensagem que o bot envia pedindo o TELEFONE',
    email: 'Mensagem que o bot envia pedindo o E-MAIL',
  };

  return (
    <Stack spacing={1.25}>
      <Alert severity="info" sx={{ py: 0.5 }}>
        Quando ativada, a captação dispara <strong>após esta sequência terminar</strong> (e antes de
        ir pra próxima). O lead digita os dados, são salvos em "Leads", e depois o funil continua.
        Só pode existir <strong>uma captação por funil</strong>.
      </Alert>

      {activeOnOther ? (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          A captação está ativa em outra sequência: <strong>{otherName}</strong>. Ativar aqui vai
          movê-la pra esta sequência (desativando lá).
        </Alert>
      ) : null}

      <TextField
        select
        size="small"
        fullWidth
        label="Capturar após esta sequência?"
        value={fieldsPreset}
        onChange={(e) => onSetLeadCapture(e.target.value)}
        helperText="O lead vai precisar digitar os campos em sequência. Salvo em Leads ao terminar."
      >
        <MenuItem value="">— não capturar —</MenuItem>
        <MenuItem value="nome_telefone">Nome + Telefone</MenuItem>
        <MenuItem value="nome_email">Nome + E-mail</MenuItem>
        <MenuItem value="nome_telefone_email">Nome + Telefone + E-mail</MenuItem>
      </TextField>

      {isActiveHere && activeFields.length > 0 ? (
        <>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Todas as mensagens do bot durante a captação. Pode usar {'{{nome}}'}, {'{{telefone}}'} ou {'{{email}}'} pra referenciar valores já capturados, e {'{{q_algo}}'} para um parâmetro da URL do chat (ex.: ?q_algo=valor). Valor padrão: {'{{q_nome|amigo}}'}.
          </Typography>
          <RichTextField
            label="Mensagem de abertura (antes do 1º campo)"
            placeholder="Antes de continuar, só preciso de algumas informações."
            value={prompts.intro || ''}
            onChange={(html) => onSetLeadCapturePrompt('intro', html)}
            minHeight={56}
          />
          {activeFields.map((field) => (
            <RichTextField
              key={field}
              label={labels[field] || `Mensagem pra ${field}`}
              placeholder={placeholders[field] || ''}
              value={prompts[field] || ''}
              onChange={(html) => onSetLeadCapturePrompt(field, html)}
              minHeight={56}
            />
          ))}
          <RichTextField
            label="Mensagem de fechamento (após captar tudo)"
            placeholder="Obrigado! Vamos continuar… ✨"
            value={prompts.closing || ''}
            onChange={(html) => onSetLeadCapturePrompt('closing', html)}
            minHeight={56}
          />
        </>
      ) : null}
    </Stack>
  );
}

// EndingSection — configuração GLOBAL do encerramento do funil. Aparece
// em qualquer sequência selecionada (não é por-sequência) pra ficar
// fácil de descobrir.
function EndingSection({ funil, onSetEnding }) {
  const ending = funil?.ending || {};
  return (
    <Stack spacing={1.25}>
      <Alert severity="info" sx={{ py: 0.5 }}>
        Configuração GLOBAL do funil. A mensagem final é enviada quando o lead chega ao fim — opção
        de encerramento, sequência sem próxima ou ending=end. Se a IA estiver liberada, o input fica
        habilitado depois e ela continua o atendimento.
      </Alert>
      <RichTextField
        label="Mensagem final (opcional)"
        placeholder="Ex.: Foi um prazer te ajudar! Se quiser continuar, é só me mandar uma mensagem 👋"
        value={ending.message || ''}
        onChange={(html) => onSetEnding({ message: html })}
        minHeight={56}
      />
      <Stack direction="row" spacing={1} alignItems="center">
        <Switch
          checked={Boolean(ending.aiTakeover)}
          onChange={(e) => onSetEnding({ aiTakeover: e.target.checked })}
        />
        <Typography variant="body2">
          Liberar a IA pra continuar o atendimento após a mensagem final
        </Typography>
      </Stack>
    </Stack>
  );
}

// =============================================================================
// MessageEditor — text / image / audio
// =============================================================================

const MESSAGE_TYPE_LABEL = {
  text: 'Texto',
  image: 'Imagem',
  audio: 'Áudio',
  clip: '🎬 Vídeo',
  file: '📎 Arquivo (protegido)',
  video: '🔒 Vídeo (protegido)',
};

function MessageEditor({ message, index, total, onPatch, onRemove, onMove }) {
  return (
    <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 800 }}>
          #{index + 1} • {MESSAGE_TYPE_LABEL[message.type] || 'Texto'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Subir">
          <span>
            <IconButton size="small" disabled={index === 0} onClick={() => onMove(-1)}>
              <ArrowUpwardRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Descer">
          <span>
            <IconButton size="small" disabled={index === total - 1} onClick={() => onMove(1)}>
              <ArrowDownwardRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Excluir">
          <IconButton size="small" color="error" onClick={onRemove}>
            <DeleteRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {message.type === 'text' && (
        <RichTextField
          value={message.html || ''}
          onChange={(html) => onPatch({ html })}
          placeholder="Digite a mensagem… use {{nome}} (capturado) ou {{q_nome}} (da URL: ?q_nome=Ana); padrão: {{q_nome|amigo}}."
        />
      )}

      {message.type === 'image' && (
        <ImageMessageEditor message={message} onPatch={onPatch} />
      )}

      {message.type === 'audio' && (
        <AudioMessageEditor message={message} onPatch={onPatch} />
      )}

      {message.type === 'clip' && (
        <ClipMessageEditor value={message} onPatch={onPatch} />
      )}

      {(message.type === 'file' || message.type === 'video') && (
        <FileMessageEditor message={message} onPatch={onPatch} />
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
        <TextField
          type="number"
          size="small"
          label="Delay (ms)"
          value={message.typingDurationMs ?? 800}
          onChange={(e) => onPatch({ typingDurationMs: Number(e.target.value) || 0 })}
          inputProps={{ min: 0, max: 5000, step: 100 }}
          helperText="Tempo de 'digitando…' antes desta mensagem"
          sx={{ maxWidth: 200 }}
        />
      </Stack>
    </Box>
  );
}

function ImageMessageEditor({ message, onPatch }) {
  const fileInputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      // eslint-disable-next-line no-alert
      window.alert('Selecione um arquivo de imagem.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      // eslint-disable-next-line no-alert
      window.alert('Imagem muito grande (máx 4MB no original). Use uma menor.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      onPatch({ dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <Stack spacing={1}>
      {message.dataUrl ? (
        <Box>
          <img
            src={message.dataUrl}
            alt=""
            style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, display: 'block' }}
          />
          <Typography variant="caption" color="text.secondary">
            {formatBytes(dataUrlBytes(message.dataUrl))}
          </Typography>
        </Box>
      ) : null}
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="outlined" onClick={() => fileInputRef.current?.click()}>
          {message.dataUrl ? 'Trocar imagem' : 'Selecionar imagem'}
        </Button>
        {message.dataUrl ? (
          <Button size="small" color="error" onClick={() => onPatch({ dataUrl: '' })}>
            Remover
          </Button>
        ) : null}
      </Stack>
      <RichTextField
        label="Legenda (opcional)"
        value={message.caption || ''}
        onChange={(html) => onPatch({ caption: html })}
        minHeight={48}
        placeholder="Texto que aparece abaixo da imagem (opcional)"
      />
      <TextField
        size="small"
        label="Link ao clicar na imagem (opcional)"
        placeholder="https://..."
        value={message.linkUrl || ''}
        onChange={(e) => onPatch({ linkUrl: e.target.value })}
        fullWidth
        helperText="Quando preenchido, a imagem vira um link clicável que abre em nova aba."
      />
    </Stack>
  );
}

function AudioMessageEditor({ message, onPatch }) {
  return (
    <AudioRecorder
      initialDataUrl={message.dataUrl}
      initialDuration={message.durationSec || 0}
      onSave={({ dataUrl, durationSec }) => onPatch({ dataUrl, durationSec })}
    />
  );
}

// =============================================================================
// OptionsEditor + WaitInputEditor
// =============================================================================

function OptionsEditor({ sequence, otherSequences, onPatchOption, onPatchOptionAction, onAddOption, onRemoveOption }) {
  return (
    <Stack spacing={1.25}>
      {(sequence.ending.options || []).map((opt) => (
        <Box key={opt.id} sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, flex: 1 }}>
              Botão
            </Typography>
            <IconButton size="small" color="error" onClick={() => onRemoveOption(opt.id)}>
              <DeleteRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Box sx={{ mb: 1 }}>
            <RichTextField
              label="Texto do botão"
              value={opt.label || ''}
              onChange={(html) => onPatchOption(opt.id, { label: html })}
              minHeight={36}
              placeholder="Ex.: Quero saber mais 🚀 — aceita {{nome}}, {{q_nome}} e {{q_nome|amigo}}"
            />
          </Box>
          <TextField
            size="small"
            fullWidth
            label="Classes CSS (opcional)"
            value={opt.cssClass || ''}
            onChange={(e) => onPatchOption(opt.id, { cssClass: e.target.value })}
            placeholder="ex.: meu-botao destaque"
            helperText="Classes extras aplicadas ao botão no chat."
            sx={{ mb: 1 }}
          />
          <TextField
            select
            size="small"
            fullWidth
            label="Ação ao clicar"
            value={opt.action?.type || 'goto'}
            onChange={(e) => onPatchOptionAction(opt.id, { type: e.target.value })}
            sx={{ mb: 1 }}
          >
            <MenuItem value="goto">Ir para outra sequência</MenuItem>
            <MenuItem value="redirect">Abrir URL externa</MenuItem>
            <MenuItem value="send_to_ai">🤖 Assistente de IA</MenuItem>
            <MenuItem value="end">Encerrar funil</MenuItem>
          </TextField>
          {opt.action?.type === 'goto' && (
            <TextField
              select
              size="small"
              fullWidth
              label="Sequência de destino"
              value={opt.action?.sequenceId || ''}
              onChange={(e) => onPatchOptionAction(opt.id, { sequenceId: e.target.value })}
              helperText="Será criada uma seta no fluxograma."
            >
              <MenuItem value="">— selecione —</MenuItem>
              {otherSequences.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          {opt.action?.type === 'redirect' && (
            <TextField
              size="small"
              fullWidth
              label="URL"
              placeholder="https://..."
              value={opt.action?.url || ''}
              onChange={(e) => onPatchOptionAction(opt.id, { url: e.target.value })}
              onBlur={(e) => {
                // https:// automático / esquema perigoso → '' (A-74)
                const fixed = normalizeRedirectUrl(e.target.value);
                if (fixed !== e.target.value) onPatchOptionAction(opt.id, { url: fixed });
              }}
            />
          )}
          {opt.action?.type === 'send_to_ai' && (
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              label="Mensagem que será enviada para a IA"
              placeholder="Ex.: Quero falar com um especialista agora."
              value={opt.action?.triggerMessage || ''}
              onChange={(e) => onPatchOptionAction(opt.id, { triggerMessage: e.target.value })}
              helperText="O texto aparece no chat como se o lead tivesse digitado, e a IA assume daqui em diante (encerra o funil)."
            />
          )}
        </Box>
      ))}
      <Button size="small" startIcon={<AddRoundedIcon />} onClick={onAddOption}>
        Adicionar botão
      </Button>
    </Stack>
  );
}

function WaitInputEditor({ sequence, otherSequences, onPatch }) {
  return (
    <Stack spacing={1.25}>
      <Alert severity="info" sx={{ py: 0.5 }}>
        Quando o lead chegar nesta sequência, o input de texto será habilitado e a resposta digitada será capturada.
      </Alert>

      <TextField
        select
        size="small"
        fullWidth
        label="Capturar resposta na variável"
        value={sequence.ending?.captureVariable || ''}
        onChange={(e) => onPatch({ captureVariable: e.target.value })}
        helperText="Variáveis 'nome', 'email' e 'telefone' alimentam o cadastro de leads automaticamente."
      >
        <MenuItem value="">— não capturar —</MenuItem>
        {VARIAVEIS_LEAD.map((v) => (
          <MenuItem key={v} value={v}>
            {v} (lead)
          </MenuItem>
        ))}
        <MenuItem value="resposta">resposta (genérica)</MenuItem>
      </TextField>

      <TextField
        select
        size="small"
        fullWidth
        label="Ir para depois da resposta"
        value={sequence.ending?.nextSequenceId || ''}
        onChange={(e) => onPatch({ nextSequenceId: e.target.value })}
      >
        <MenuItem value="">— encerrar funil —</MenuItem>
        {otherSequences.map((s) => (
          <MenuItem key={s.id} value={s.id}>
            {s.name}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}


// =============================================================================
// FileMessageEditor — arquivo/PDF ou vídeo hospedado no SERVIDOR (protegido).
// O upload vai pra /webchat-assets (não pro JSON do funil); o lead só recebe
// a URL assinada depois do pagamento.
// =============================================================================

function FileMessageEditor({ message, onPatch }) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const isVideo = message.type === 'video';
  const accept = isVideo ? 'video/*' : '.pdf,.zip,.rar,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.epub,image/*,audio/*';
  const maxBytes = isVideo ? 500 * 1024 * 1024 : 100 * 1024 * 1024;

  async function handleFile(e) {
    const file = e.target?.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (isVideo && !file.type.startsWith('video/')) {
      setError('Selecione um arquivo de vídeo (mp4, webm…).');
      return;
    }
    if (file.size > maxBytes) {
      setError(isVideo ? 'Vídeo acima de 500 MB — hospede fora (YouTube não listado, Vimeo…) e envie o link numa mensagem de texto.' : 'Arquivo acima de 100 MB.');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    setProgress(0);
    try {
      const res = await post('/webchat-assets', fd, {
        headers: { 'Content-Type': undefined },
        timeout: 0,
        onUploadProgress: (ev) => {
          if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100));
        },
      });
      onPatch({ assetId: res.id, name: res.name, size: res.size_bytes, mime: res.mime });
    } catch (err) {
      const m = err?.response?.data?.message ?? err?.message;
      setError(Array.isArray(m) ? m.join(' | ') : String(m || 'Falha no upload.'));
    } finally {
      setProgress(null);
    }
  }

  return (
    <Stack spacing={1}>
      <Alert severity="success" icon={<IconLock size={18} />} sx={{ py: 0.25 }}>
        Conteúdo protegido: fica no servidor e só é liberado ao lead após o pagamento.
      </Alert>
      {message.assetId ? (
        <Box sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'success.main', bgcolor: 'action.hover' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            {isVideo ? <IconVideo size={22} /> : <IconFileTypePdf size={22} />}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                {message.name || 'arquivo'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatBytes(Number(message.size) || 0)}
                {message.mime ? ` · ${message.mime}` : ''}
              </Typography>
            </Box>
            <Chip size="small" color="success" label="Enviado" />
          </Stack>
        </Box>
      ) : null}
      {progress !== null ? (
        <Box>
          <LinearProgress variant="determinate" value={progress} sx={{ borderRadius: 1, height: 8 }} />
          <Typography variant="caption" color="text.secondary">
            Enviando… {progress}%
          </Typography>
        </Box>
      ) : null}
      {error ? (
        <Alert severity="error" sx={{ py: 0.25 }}>
          {error}
        </Alert>
      ) : null}
      <input ref={inputRef} type="file" accept={accept} hidden onChange={handleFile} />
      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<IconUpload size={16} />}
          disabled={progress !== null}
          onClick={() => inputRef.current?.click()}
        >
          {message.assetId ? (isVideo ? 'Trocar vídeo' : 'Trocar arquivo') : isVideo ? 'Selecionar vídeo' : 'Selecionar arquivo'}
        </Button>
        {message.assetId ? (
          <Button size="small" color="error" onClick={() => onPatch({ assetId: '', name: '', size: 0, mime: '' })}>
            Remover
          </Button>
        ) : null}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {isVideo ? 'Até 500 MB (mp4 recomendado). O lead assiste dentro do chat.' : 'Até 100 MB (PDF, zip, doc…). O lead recebe um botão de download.'}
      </Typography>
      <TextField
        size="small"
        fullWidth
        label="Nome exibido no chat"
        value={message.label || ''}
        onChange={(e) => onPatch({ label: e.target.value.slice(0, 150) })}
        placeholder={message.name || (isVideo ? 'Ex.: Aula 1 — Bolo de cenoura' : 'Ex.: Apostila completa')}
        helperText="É o nome que o lead vê no chat e ao salvar o arquivo. Vazio = nome do arquivo enviado."
      />
      <RichTextField
        label="Legenda (opcional)"
        value={message.caption || ''}
        onChange={(html) => onPatch({ caption: html })}
        minHeight={48}
        placeholder="Texto que aparece junto do arquivo (opcional)"
      />
    </Stack>
  );
}

// =============================================================================
// ChargeEditor — Cobrança PIX (fim de sequência type='charge')
// =============================================================================

// Campo de dinheiro "estilo caixa eletrônico": o usuário digita só números e
// o valor vai se formando da direita pra esquerda (1 → 0,01; 1990 → 19,90).
function MoneyField({ valueCents, onChange, label = 'Valor do produto' }) {
  const display = (Number(valueCents) || 0) === 0 ? '' : formatBRL(valueCents).replace(/^R\$\s?/, '');
  return (
    <TextField
      size="small"
      fullWidth
      label={label}
      value={display}
      placeholder="0,00"
      onChange={(e) => {
        const digits = String(e.target.value || '').replace(/\D+/g, '').slice(0, 9);
        onChange(digits ? parseInt(digits, 10) : 0);
      }}
      InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
      inputProps={{ inputMode: 'numeric' }}
      helperText="Digite só os números: 1990 vira R$ 19,90"
    />
  );
}

function ChargeEditor({ sequence, otherSequences, gateway, onPatchCharge, onCreateDeliverySequence }) {
  const charge = { ...createDefaultCharge(), ...(sequence.ending?.charge || {}) };
  const gatewayReady = gateway?.ready === true;
  const deliveryMissing = !charge.onPaidSequenceId;

  return (
    <Stack spacing={1.5}>
      <Alert severity="info" sx={{ py: 0.5 }}>
        Ao chegar aqui, depois das mensagens acima, o chat <strong>gera um PIX</strong> com o valor abaixo e mostra o código
        copia-e-cola (e o QR), o botão de copiar e o botão de validar. Quando o pagamento for confirmado, o chat envia a{' '}
        <strong>sequência de entrega</strong> — é nela que você coloca o produto (PDF, vídeo, fotos…).
      </Alert>

      {gateway && !gatewayReady ? (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          <strong>Gateway PIX não configurado.</strong> Cadastre o token do Mercado Pago ou PushinPay em{' '}
          <a href="/settings/payments" target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
            Configurações → Pagamentos
          </a>{' '}
          — sem isso a cobrança não funciona no chat.
        </Alert>
      ) : gatewayReady ? (
        <Alert severity="success" sx={{ py: 0.25 }} icon={<IconCreditCard size={18} />}>
          Gateway pronto ({gateway.provider === 'pushinpay' ? 'PushinPay' : 'Mercado Pago'}).
        </Alert>
      ) : null}

      <MoneyField valueCents={charge.amountCents} onChange={(cents) => onPatchCharge({ amountCents: cents })} />
      {(Number(charge.amountCents) || 0) <= 0 ? (
        <Alert severity="warning" sx={{ py: 0.25 }}>
          Informe o valor do produto.
        </Alert>
      ) : null}

      <TextField
        size="small"
        fullWidth
        label="Nome do produto (aparece no extrato e em Vendas)"
        value={charge.description || ''}
        onChange={(e) => onPatchCharge({ description: e.target.value.slice(0, 120) })}
        placeholder="Ex.: Curso completo de bolos"
      />

      <TextField
        select
        size="small"
        fullWidth
        label="Após o pagamento, enviar a sequência"
        value={charge.onPaidSequenceId || ''}
        onChange={(e) => onPatchCharge({ onPaidSequenceId: e.target.value })}
        helperText="Essa sequência é a ENTREGA: fica protegida e só chega a quem pagou. Uma seta verde aparece no fluxograma."
        error={deliveryMissing}
      >
        <MenuItem value="">— selecione —</MenuItem>
        {otherSequences.map((s) => (
          <MenuItem key={s.id} value={s.id}>
            {s.name}
          </MenuItem>
        ))}
      </TextField>
      {deliveryMissing ? (
        <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={onCreateDeliverySequence} sx={{ alignSelf: 'flex-start' }}>
          Criar sequência de entrega
        </Button>
      ) : null}

      <FormControlLabel
        control={<Switch checked={charge.showQr !== false} onChange={(e) => onPatchCharge({ showQr: e.target.checked })} />}
        label="Mostrar QR code além do código copia-e-cola"
      />

      <Accordion disableGutters sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<IconChevronDown size={18} />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Textos e botões (personalizar)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            <RichTextField
              label="Mensagem junto do PIX"
              value={charge.pixMessage}
              onChange={(html) => onPatchCharge({ pixMessage: html })}
              minHeight={48}
            />
            <TextField
              size="small"
              fullWidth
              label="Texto do botão de copiar"
              value={charge.copyButtonLabel}
              onChange={(e) => onPatchCharge({ copyButtonLabel: e.target.value.slice(0, 80) })}
            />
            <RichTextField
              label="Mensagem após copiar"
              value={charge.copiedMessage}
              onChange={(html) => onPatchCharge({ copiedMessage: html })}
              minHeight={48}
            />
            <TextField
              size="small"
              fullWidth
              label="Texto do botão de validar pagamento"
              value={charge.validateButtonLabel}
              onChange={(e) => onPatchCharge({ validateButtonLabel: e.target.value.slice(0, 80) })}
            />
            <RichTextField
              label="Mensagem quando ainda não pagou"
              value={charge.notPaidMessage}
              onChange={(html) => onPatchCharge({ notPaidMessage: html })}
              minHeight={48}
            />
            <RichTextField
              label="Mensagem quando o PIX expira (30 min)"
              value={charge.expiredMessage}
              onChange={(html) => onPatchCharge({ expiredMessage: html })}
              minHeight={48}
            />
            <TextField
              size="small"
              fullWidth
              label="Texto do botão de gerar novo PIX"
              value={charge.newPixButtonLabel}
              onChange={(e) => onPatchCharge({ newPixButtonLabel: e.target.value.slice(0, 80) })}
            />
            <RichTextField
              label="Mensagem de pagamento confirmado"
              value={charge.paidMessage}
              onChange={(html) => onPatchCharge({ paidMessage: html })}
              minHeight={48}
            />
            <RichTextField
              label="Mensagem 'estou te enviando o conteúdo' (antes da entrega)"
              value={charge.sendingMessage}
              onChange={(html) => onPatchCharge({ sendingMessage: html })}
              minHeight={48}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
