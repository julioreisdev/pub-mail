import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MarkerType,
    MiniMap,
    ReactFlowProvider,
    addEdge,
    useEdgesState,
    useNodesState,
    useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { IconCheck, IconCopy, IconDeviceFloppy, IconLink, IconPlus } from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, put } from '../../../api/api';
import TelegramLogo from './TelegramLogo';
import TelegramAutomations from './TelegramAutomations';
import TelegramLinkPicker from './TelegramLinkPicker';
import SearchSelect from './SearchSelect';
import {
    BlockPalette,
    FlowActionsProvider,
    FlowGlobalStyles,
    InspectorPanel,
    appendBlockToData,
    cloneNodeData,
    edgeTypes,
    nodeMessages,
    nodeTypes,
    seedNodeData
} from './ui/flow';

const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const errMsg = (e, fb) => {
    const m = e?.response?.data?.message ?? e?.message;
    return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};

const EDGE_MARKER = { type: MarkerType.ArrowClosed, color: '#229ED9', width: 18, height: 18 };
const withBrand = (e) => ({ ...e, type: 'brand', markerEnd: EDGE_MARKER });
const selectOnly = (nds, id) => nds.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id }));

// assinatura estável do fluxo (ignora seleção/drag/tamanho) p/ detectar "não salvo".
const flowSig = (nds, eds, act) => {
    try {
        return JSON.stringify({
            a: !!act,
            n: (nds || []).map((n) => ({ i: n.id, t: n.type, x: Math.round(n.position?.x || 0), y: Math.round(n.position?.y || 0), d: n.data })),
            e: (eds || []).map((e) => ({ i: e.id, s: e.source, sh: e.sourceHandle || null, tg: e.target, th: e.targetHandle || null }))
        });
    } catch {
        return Math.random().toString();
    }
};

// =============== PÁGINA (inner) ===============
function FlowCanvas() {
    const [bots, setBots] = useState([]);
    const [botId, setBotId] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [active, setActive] = useState(false);

    const [tab, setTab] = useState(0);
    const [dlOpen, setDlOpen] = useState(false);
    const [dlParam, setDlParam] = useState('');
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [focus, setFocus] = useState(null); // {type, ts} p/ rolar o inspetor até o bloco solto
    const frameRef = useRef(null);
    const [frameH, setFrameH] = useState(0); // altura exata do canvas (mede topo, desconta rodapé)
    const [savedSig, setSavedSig] = useState(null);
    const [draggingBlock, setDraggingBlock] = useState(null);

    const rf = useReactFlow();
    const { mode, systemMode } = useColorScheme();
    const isDark = (mode === 'system' ? systemMode : mode) === 'dark';

    const wrapperRef = useRef(null);
    const dragHoverRef = useRef(null);
    const baselineRef = useRef(false);
    const nodesRef = useRef(nodes);
    nodesRef.current = nodes;

    useEffect(() => {
        get('/telegram/bots')
            .then((rows) => {
                setBots(rows);
                if (rows.length) setBotId((p) => p || rows[0].id);
            })
            .catch((e) => toast.error(errMsg(e, 'Falha ao carregar bots.')));
    }, []);

    useEffect(() => {
        const calc = () => {
            const el = frameRef.current;
            if (!el) return;
            const top = el.getBoundingClientRect().top;
            setFrameH(Math.max(360, Math.round(window.innerHeight - top - 96)));
        };
        calc();
        const t1 = setTimeout(calc, 120);
        const t2 = setTimeout(calc, 400);
        window.addEventListener('resize', calc);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            window.removeEventListener('resize', calc);
        };
    }, [botId]);

    // Alinha os balões no canto SUPERIOR ESQUERDO da área usável (melhor aproveitamento).
    const fit = useCallback(() => {
        setTimeout(() => {
            const ns = nodesRef.current || [];
            if (!ns.length) {
                rf.fitView({ padding: 0.3, duration: 300, maxZoom: 1 });
                return;
            }
            const zoom = 0.85;
            const xs = ns.map((n) => Number(n.position?.x)).filter(Number.isFinite);
            const ys = ns.map((n) => Number(n.position?.y)).filter(Number.isFinite);
            if (!xs.length || !ys.length) {
                rf.fitView({ padding: 0.3, duration: 300, maxZoom: 1 });
                return;
            }
            rf.setViewport({ x: 36 - Math.min(...xs) * zoom, y: 36 - Math.min(...ys) * zoom, zoom }, { duration: 300 });
        }, 80);
    }, [rf]);

    const buildDefault = useCallback(() => {
        const msgId = uid('msg');
        const nn = [
            { id: 'start', type: 'start', position: { x: 60, y: 80 }, data: {}, deletable: false },
            {
                id: msgId,
                type: 'message',
                position: { x: 320, y: 40 },
                data: { title: 'Boas-vindas', messages: [{ id: uid('m'), text: 'Olá! 👋 Seja bem-vindo.', media: null, delay_seconds: 0 }], buttons: [], answers: [], apply_tags: [] }
            }
        ];
        setNodes(nn);
        setEdges([withBrand({ id: uid('e'), source: 'start', sourceHandle: 'out', target: msgId, targetHandle: 'in' })]);
        setSelectedId(msgId);
        fit();
    }, [setNodes, setEdges, fit]);

    const loadFlow = useCallback(
        async (id) => {
            if (!id) return;
            setLoading(true);
            setSelectedId(null);
            setSavedSig(null);
            baselineRef.current = true;
            try {
                const f = await get(`/telegram/bots/${id}/flow`);
                setActive(!!f.active);
                const def = f.definition;
                if (def && Array.isArray(def.nodes) && def.nodes.length) {
                    const nn = def.nodes.map((n) => (n.id === 'start' ? { ...n, deletable: false } : n));
                    setNodes(nn);
                    setEdges((Array.isArray(def.edges) ? def.edges : []).map(withBrand));
                    fit();
                } else {
                    buildDefault();
                }
            } catch (e) {
                toast.error(errMsg(e, 'Falha ao carregar o fluxo.'));
            } finally {
                setLoading(false);
            }
        },
        [setNodes, setEdges, buildDefault, fit]
    );

    useEffect(() => {
        if (botId) loadFlow(botId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [botId]);

    // captura a baseline "salva" logo após um load/build (p/ o indicador de não-salvo)
    useEffect(() => {
        if (baselineRef.current) {
            baselineRef.current = false;
            setSavedSig(flowSig(nodes, edges, active));
        }
    }, [nodes, edges, active]);

    const currentSig = useMemo(() => flowSig(nodes, edges, active), [nodes, edges, active]);
    const dirty = savedSig != null && currentSig !== savedSig;

    // uma aresta por handle de origem (substitui)
    const onConnect = useCallback(
        (params) => {
            setEdges((eds) => addEdge(withBrand(params), eds.filter((e) => !(e.source === params.source && e.sourceHandle === params.sourceHandle))));
        },
        [setEdges]
    );

    const updateNodeData = useCallback(
        (id, patch) => {
            setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
        },
        [setNodes]
    );

    const setMessageDelay = useCallback(
        (id, messageId, seconds) => {
            setNodes((nds) =>
                nds.map((n) =>
                    n.id !== id ? n : { ...n, data: { ...n.data, messages: nodeMessages(n.data).map((m) => (m.id === messageId ? { ...m, delay_seconds: seconds } : m)) } }
                )
            );
        },
        [setNodes]
    );

    const addMessage = useCallback(() => {
        const msgId = uid('msg');
        setNodes((nds) => [
            ...selectOnly(nds, msgId),
            {
                id: msgId,
                type: 'message',
                position: { x: 340, y: 60 + nds.length * 40 },
                data: { title: 'Mensagem', messages: [{ id: uid('m'), text: '', media: null, delay_seconds: 0 }], buttons: [], answers: [], apply_tags: [] },
                selected: true
            }
        ]);
        setSelectedId(msgId);
    }, [setNodes]);

    const duplicateNode = useCallback(
        (id) => {
            const src = nodesRef.current.find((n) => n.id === id);
            if (!src || src.type === 'start') return;
            const newId = uid('msg');
            const newNode = {
                ...src,
                id: newId,
                position: { x: (src.position?.x || 0) + 48, y: (src.position?.y || 0) + 48 },
                data: cloneNodeData(src.data),
                selected: true
            };
            setNodes((nds) => [...selectOnly(nds, newId), newNode]);
            setSelectedId(newId);
        },
        [setNodes]
    );

    const deleteNode = useCallback(
        (id) => {
            if (id === 'start') return;
            setNodes((nds) => nds.filter((n) => n.id !== id));
            setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
            setSelectedId(null);
        },
        [setNodes, setEdges]
    );

    const clearSelection = useCallback(() => {
        setSelectedId(null);
        setNodes((nds) => (nds.some((n) => n.selected) ? nds.map((n) => (n.selected ? { ...n, selected: false } : n)) : nds));
    }, [setNodes]);

    const actions = useMemo(
        () => ({
            onTitleChange: (id, title) => updateNodeData(id, { title }),
            onSetDelay: setMessageDelay,
            onDuplicate: duplicateNode,
            onDelete: deleteNode,
            onDeleteEdge: (eid) => setEdges((eds) => eds.filter((e) => e.id !== eid))
        }),
        [updateNodeData, setMessageDelay, duplicateNode, deleteNode, setEdges]
    );

    // ---------- Drag & drop de blocos ----------
    const clearHover = useCallback(() => {
        if (dragHoverRef.current) {
            dragHoverRef.current.classList.remove('tg-drop-target');
            dragHoverRef.current = null;
        }
    }, []);

    // Detecção GEOMÉTRICA do nó sob o cursor (elementFromPoint falha durante o drag nativo).
    const nodeHitAt = (x, y) => {
        try {
            const pos = rf.screenToFlowPosition({ x, y });
            const hit = rf
                .getNodes()
                .find((n) => n.type !== 'start' && n.width && n.height && pos.x >= n.position.x && pos.x <= n.position.x + n.width && pos.y >= n.position.y && pos.y <= n.position.y + n.height);
            return hit?.id || null;
        } catch {
            return null;
        }
    };
    const nodeElById = (id) => (id ? document.querySelector(`.react-flow__node[data-id="${id}"]`) : null);

    const onDragOver = useCallback(
        (e) => {
            if (!e.dataTransfer.types.includes('application/tg-block')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            const target = nodeElById(nodeHitAt(e.clientX, e.clientY));
            if (dragHoverRef.current && dragHoverRef.current !== target) dragHoverRef.current.classList.remove('tg-drop-target');
            if (target && target !== dragHoverRef.current) target.classList.add('tg-drop-target');
            dragHoverRef.current = target;
        },
        [] // eslint-disable-line react-hooks/exhaustive-deps
    );

    const onDragLeave = useCallback(
        (e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) clearHover();
        },
        [clearHover]
    );

    const onDrop = useCallback(
        (e) => {
            const type = e.dataTransfer.getData('application/tg-block');
            e.preventDefault();
            clearHover();
            setDraggingBlock(null);
            if (!type) return;
            const targetId = nodeHitAt(e.clientX, e.clientY);
            if (targetId) {
                setNodes((nds) => selectOnly(nds, targetId).map((n) => (n.id === targetId ? { ...n, data: appendBlockToData(n.data, type) } : n)));
                setSelectedId(targetId);
            } else {
                const position = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
                const id = uid('msg');
                setNodes((nds) => [...selectOnly(nds, id), { id, type: 'message', position, data: seedNodeData(type), selected: true }]);
                setSelectedId(id);
            }
            setFocus({ type, ts: Date.now() });
        },
        [clearHover, rf, setNodes]
    );

    const save = async () => {
        setSaving(true);
        try {
            const startEdge = edges.find((e) => e.source === 'start');
            const definition = { nodes, edges };
            await put(`/telegram/bots/${botId}/flow`, {
                active,
                definition,
                start_node_id: startEdge?.target || null,
                name: 'Fluxo inicial'
            });
            setSavedSig(flowSig(nodes, edges, active));
            toast.success('Fluxo salvo.');
        } catch (e) {
            toast.error(errMsg(e, 'Falha ao salvar.'));
        } finally {
            setSaving(false);
        }
    };

    const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedId) || null, [nodes, selectedId]);
    const selectedBot = bots.find((b) => b.id === botId);

    return (
        <Box sx={{ p: { xs: 1, md: 2 } }}>
            <FlowGlobalStyles />

            {/* header */}
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                <TelegramLogo size={30} />
                <Box sx={{ mr: 1 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                        Fluxo Inicial
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Fluxo de /start + automações do bot.
                    </Typography>
                </Box>
                <SearchSelect
                    sx={{ minWidth: 240 }}
                    label="Bot"
                    value={botId}
                    onChange={setBotId}
                    options={bots.map((b) => ({ value: b.id, label: `${b.name}${b.username ? ` · @${b.username}` : ''}` }))}
                />
                <Box sx={{ flex: 1 }} />
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<IconLink size={16} />}
                    onClick={() => setDlOpen(true)}
                    sx={{ borderRadius: 2, borderColor: 'divider', color: 'text.primary' }}
                >
                    Link de captação
                </Button>
            </Stack>

            <Dialog open={dlOpen} onClose={() => setDlOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 700 }}>
                    Link de captação
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 400 }}>
                        Divulgue este link. Quem abrir e tocar em <b>Iniciar</b> entra no fluxo do bot.
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    {(() => {
                        const uname = selectedBot?.username;
                        const link = uname ? `https://t.me/${uname}${dlParam.trim() ? `?start=${encodeURIComponent(dlParam.trim())}` : ''}` : '';
                        return (
                            <Stack spacing={2} sx={{ mt: 0.5 }}>
                                {!uname ? (
                                    <Alert severity="warning" sx={{ borderRadius: 2 }}>
                                        Este bot ainda não tem @username. Configure no @BotFather para gerar o link.
                                    </Alert>
                                ) : (
                                    <>
                                        <TextField
                                            size="small"
                                            fullWidth
                                            label="Parâmetro de origem (opcional)"
                                            placeholder="ex.: instagram"
                                            value={dlParam}
                                            onChange={(e) => setDlParam(e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))}
                                            helperText={'Chega no fluxo como {{origem}}. Só letras/números/_/-.'}
                                        />
                                        <TextField
                                            size="small"
                                            fullWidth
                                            value={link}
                                            InputProps={{
                                                readOnly: true,
                                                sx: { fontFamily: 'monospace', fontSize: 13 },
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <Tooltip title="Copiar">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() =>
                                                                    navigator.clipboard
                                                                        .writeText(link)
                                                                        .then(() => toast.success('Link copiado!'))
                                                                        .catch(() => toast.error('Não foi possível copiar.'))
                                                                }
                                                            >
                                                                <IconCopy size={16} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </InputAdornment>
                                                )
                                            }}
                                            onFocus={(e) => e.target.select()}
                                        />
                                    </>
                                )}
                            </Stack>
                        );
                    })()}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button color="inherit" onClick={() => setDlOpen(false)} sx={{ textTransform: 'none' }}>
                        Fechar
                    </Button>
                </DialogActions>
            </Dialog>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1.5 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                    <Tab label="Fluxo Inicial" sx={{ textTransform: 'none', fontWeight: 600 }} />
                    <Tab label="Automações" sx={{ textTransform: 'none', fontWeight: 600 }} />
                </Tabs>
            </Box>

            {tab === 1 ? (
                <TelegramAutomations botId={botId} bots={bots} />
            ) : (
                <>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mr: 'auto' }}>
                            <Switch checked={active} onChange={(e) => setActive(e.target.checked)} />
                            <Typography variant="body2" sx={{ fontWeight: 600, color: active ? 'success.main' : 'text.secondary' }}>
                                {active ? 'Ativo' : 'Inativo'}
                            </Typography>
                        </Stack>

                        {/* indicador salvo / não salvo */}
                        {saving ? (
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
                                <CircularProgress size={13} color="inherit" />
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    Salvando…
                                </Typography>
                            </Stack>
                        ) : dirty ? (
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'warning.main' }}>
                                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'warning.main' }} />
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    Alterações não salvas
                                </Typography>
                            </Stack>
                        ) : savedSig != null ? (
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'success.main' }}>
                                <IconCheck size={14} />
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    Salvo
                                </Typography>
                            </Stack>
                        ) : null}

                        <Button startIcon={<IconPlus size={18} />} variant="outlined" onClick={addMessage} sx={{ borderRadius: 2, borderColor: 'divider', color: 'text.primary' }}>
                            Mensagem
                        </Button>
                        <Button
                            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <IconDeviceFloppy size={18} />}
                            variant="contained"
                            onClick={save}
                            disabled={saving || !botId}
                            sx={{ borderRadius: 2, fontWeight: 700 }}
                        >
                            Salvar
                        </Button>
                    </Stack>

                    {selectedBot && selectedBot.status === 'BANNED' ? (
                        <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }}>
                            Este bot está banido — o fluxo não será executado até você revalidar ou trocar o token.
                        </Alert>
                    ) : null}

                    {/* paleta + canvas + inspetor(overlay) */}
                    <Box
                        ref={frameRef}
                        sx={(theme) => ({
                            height: frameH ? `${frameH}px` : 'calc(100dvh - 322px)',
                            minHeight: 360,
                            display: 'flex',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 3,
                            overflow: 'hidden',
                            bgcolor: 'background.paper',
                            '--tg-ctrl-bg': theme.vars.palette.background.paper,
                            '--tg-ctrl-fg': theme.vars.palette.text.secondary,
                            '--tg-ctrl-border': theme.vars.palette.divider,
                            '--tg-ctrl-hover': theme.vars.palette.action.hover
                        })}
                    >
                        <BlockPalette onDragBlock={setDraggingBlock} />

                        <Box
                            ref={wrapperRef}
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                            sx={{ position: 'relative', flex: 1, minWidth: 0 }}
                        >
                            {loading ? (
                                <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                                    <CircularProgress />
                                </Box>
                            ) : (
                                <FlowActionsProvider value={actions}>
                                    <ReactFlow
                                        nodes={nodes}
                                        edges={edges}
                                        onNodesChange={onNodesChange}
                                        onEdgesChange={onEdgesChange}
                                        onConnect={onConnect}
                                        onNodeClick={(_, n) => setSelectedId(n.type === 'start' ? null : n.id)}
                                        onPaneClick={clearSelection}
                                        nodeTypes={nodeTypes}
                                        edgeTypes={edgeTypes}
                                        defaultEdgeOptions={{ type: 'brand', markerEnd: EDGE_MARKER }}
                                        snapToGrid
                                        snapGrid={[16, 16]}
                                        minZoom={0.2}
                                        maxZoom={1.75}
                                        proOptions={{ hideAttribution: true }}
                                    >
                                        <Background gap={18} size={1} color={isDark ? '#233047' : '#dbe2ec'} />
                                        <Controls showInteractive={false} />
                                        <MiniMap
                                            pannable
                                            zoomable
                                            nodeStrokeWidth={2}
                                            nodeBorderRadius={6}
                                            nodeColor={(n) => (n.type === 'start' ? '#229ED9' : isDark ? '#33507a' : '#b9c7dd')}
                                            nodeStrokeColor={isDark ? '#0f1626' : '#f1f4f9'}
                                            maskColor={isDark ? 'rgba(8,12,22,0.66)' : 'rgba(226,232,240,0.55)'}
                                            style={{
                                                width: 150,
                                                height: 110,
                                                borderRadius: 10,
                                                border: `1px solid ${isDark ? '#26344a' : '#e2e8f0'}`,
                                                background: isDark ? '#0f1626' : '#f1f4f9'
                                            }}
                                        />
                                    </ReactFlow>
                                </FlowActionsProvider>
                            )}

                            {/* dica de drop no canvas vazio */}
                            {draggingBlock ? (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        inset: 8,
                                        pointerEvents: 'none',
                                        borderRadius: 3,
                                        border: '2px dashed',
                                        borderColor: 'primary.main',
                                        display: 'grid',
                                        placeItems: 'end center',
                                        zIndex: 4
                                    }}
                                >
                                    <Box
                                        sx={{
                                            mb: 2,
                                            px: 1.5,
                                            py: 0.75,
                                            borderRadius: 5,
                                            bgcolor: 'primary.main',
                                            color: 'primary.contrastText',
                                            fontSize: 12,
                                            fontWeight: 700,
                                            boxShadow: 3
                                        }}
                                    >
                                        Solte para criar um passo — ou sobre um passo p/ adicionar
                                    </Box>
                                </Box>
                            ) : null}

                            {/* dica sutil quando nada selecionado */}
                            {!loading && !selectedNode && nodes.length ? (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: 10,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        pointerEvents: 'none',
                                        px: 1.5,
                                        py: 0.5,
                                        borderRadius: 5,
                                        whiteSpace: 'nowrap',
                                        bgcolor: 'background.paper',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        boxShadow: 1,
                                        color: 'text.secondary',
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        zIndex: 6
                                    }}
                                >
                                    Arraste um bloco ou clique num passo para editar
                                </Box>
                            ) : null}

                            {/* inspetor: overlay que desliza da direita */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    bottom: 0,
                                    width: { xs: '100%', sm: 380 },
                                    maxWidth: '100%',
                                    bgcolor: 'background.default',
                                    borderLeft: '1px solid',
                                    borderColor: 'divider',
                                    boxShadow: selectedNode ? '-8px 0 24px rgba(0,0,0,0.14)' : 'none',
                                    transform: selectedNode ? 'translateX(0)' : 'translateX(105%)',
                                    transition: 'transform .22s ease',
                                    zIndex: 5,
                                    pointerEvents: selectedNode ? 'auto' : 'none'
                                }}
                            >
                                {selectedNode ? (
                                    <InspectorPanel
                                        node={selectedNode}
                                        botId={botId}
                                        bots={bots}
                                        focus={focus}
                                        onChange={updateNodeData}
                                        onDelete={deleteNode}
                                        onDuplicate={duplicateNode}
                                        onClose={clearSelection}
                                    />
                                ) : null}
                            </Box>
                        </Box>
                    </Box>
                </>
            )}
        </Box>
    );
}

export default function TelegramFlows() {
    return (
        <ReactFlowProvider>
            <FlowCanvas />
        </ReactFlowProvider>
    );
}
