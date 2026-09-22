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
} from './funnel-utils';
import RichTextField from './RichTextField';
import AudioRecorder from './AudioRecorder';

// Nó customizado do ReactFlow: card representando uma sequência. Mostra
// nome, número de mensagens e tipo de fim (opções X / esperar input).
function SequenceNode({ data, selected }) {
  const seq = data?.sequence;
  const isStart = data?.isStart;
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

  // Modelo -> nodes do ReactFlow. Fonte da verdade ESTRUTURAL (qtd de
  // sequências, conteúdo, seleção, posição salva).
  const derivedNodes = useMemo(() => {
    return sequenceList.map((seq) => ({
      id: seq.id,
      type: 'sequence',
      position: seq.position || { x: 0, y: 0 },
      data: { sequence: seq, isStart: seq.id === funil.startSequenceId },
      selected: seq.id === selectedSequenceId,
    }));
  }, [sequenceList, funil.startSequenceId, selectedSequenceId]);

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
    const nextSequences = { ...funil.sequences };
    delete nextSequences[seqId];
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
    });
    let nextStart = funil.startSequenceId;
    if (nextStart === seqId) {
      nextStart = Object.keys(nextSequences)[0] || '';
    }
    emit({ ...funil, sequences: nextSequences, startSequenceId: nextStart });
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
    };
    patchSequence(seqId, { ending });
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

      <Stack direction="row" spacing={1}>
        <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => onAddMessage('text')}>
          Texto
        </Button>
        <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => onAddMessage('image')}>
          Imagem
        </Button>
        <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => onAddMessage('audio')}>
          Áudio
        </Button>
      </Stack>

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
        <MenuItem value="end">Encerrar funil</MenuItem>
      </TextField>

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
            Todas as mensagens do bot durante a captação. Pode usar {'{{nome}}'}, {'{{telefone}}'} ou {'{{email}}'} pra referenciar valores já capturados.
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

function MessageEditor({ message, index, total, onPatch, onRemove, onMove }) {
  return (
    <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 800 }}>
          #{index + 1} • {message.type === 'text' ? 'Texto' : message.type === 'image' ? 'Imagem' : 'Áudio'}
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
          placeholder="Digite a mensagem… use {{nome}} para inserir variáveis capturadas."
        />
      )}

      {message.type === 'image' && (
        <ImageMessageEditor message={message} onPatch={onPatch} />
      )}

      {message.type === 'audio' && (
        <AudioMessageEditor message={message} onPatch={onPatch} />
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
              placeholder="Ex.: Quero saber mais 🚀"
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
