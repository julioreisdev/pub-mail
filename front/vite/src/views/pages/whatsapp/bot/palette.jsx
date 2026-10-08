// =============================================================================
// WhatsApp — Fluxo do Bot: paleta de blocos (arrastar para o canvas ou clicar).
//   • BotPalette  — coluna lateral do canvas (desktop; `compact` = só ícones)
//   • PaletteList — a lista em si; `grid` = grade de 2 colunas com alvo de toque
//                   grande, usada no Drawer inferior do celular (só clique)
// =============================================================================
import { Box, Stack, Tooltip, Typography } from '@mui/material';

import { NODE_META, PALETTE_GROUPS, hexA } from './botUi';

export const DND_TYPE = 'application/wa-bot-block';

function PaletteItem({ type, compact, grid, onAdd, onDragBlock }) {
  const meta = NODE_META[type];
  const Icon = meta.icon;
  const item = (
    <Box
      draggable={!grid}
      role="button"
      tabIndex={0}
      onDragStart={(e) => {
        if (grid) return;
        e.dataTransfer.setData(DND_TYPE, type);
        e.dataTransfer.effectAllowed = 'copy';
        onDragBlock?.(type);
      }}
      onDragEnd={() => onDragBlock?.(null)}
      onClick={() => onAdd?.(type)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAdd?.(type);
        }
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: compact ? 'center' : 'flex-start',
        gap: 1,
        px: compact ? 0.5 : grid ? 1 : 0.9,
        py: compact ? 0.6 : grid ? 1 : 0.7,
        minHeight: grid ? 56 : undefined,
        minWidth: 0,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        cursor: grid ? 'pointer' : 'grab',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        transition: 'border-color .14s, box-shadow .14s, transform .14s',
        '&:hover, &:focus-visible': {
          borderColor: hexA(meta.color, 0.55),
          boxShadow: `0 3px 12px ${hexA(meta.color, 0.2)}`,
          transform: 'translateY(-1px)'
        },
        '&:active': grid ? { bgcolor: hexA(meta.color, 0.08), transform: 'scale(0.985)' } : { cursor: 'grabbing' }
      }}
    >
      <Box
        sx={{
          width: grid ? 34 : 30,
          height: grid ? 34 : 30,
          flexShrink: 0,
          borderRadius: 1.75,
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          bgcolor: meta.color,
          backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(0,0,0,0.08))'
        }}
      >
        <Icon size={grid ? 18 : 16} stroke={2} />
      </Box>
      {!compact ? (
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: grid ? 13 : 12.5, lineHeight: 1.2 }}>{meta.label}</Typography>
          <Typography
            sx={{
              fontSize: 10.5,
              color: 'text.secondary',
              lineHeight: 1.25,
              mt: 0.2,
              ...(grid
                ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
                : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })
            }}
          >
            {meta.hint}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
  if (!compact) return item;
  return (
    <Tooltip
      placement="right"
      title={
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 12.5 }}>{meta.label}</Typography>
          <Typography sx={{ fontSize: 11.5, opacity: 0.85 }}>{meta.hint}</Typography>
        </Box>
      }
    >
      {item}
    </Tooltip>
  );
}

/** Grupos de blocos. `grid` = grade de 2 colunas (celular), senão lista vertical. */
export function PaletteList({ compact, grid, onAdd, onDragBlock }) {
  return (
    <>
      {PALETTE_GROUPS.map((g, gi) => (
        <Box key={g.group} sx={{ mt: compact ? (gi ? 1.5 : 0.25) : gi || !grid ? 1.75 : 0.5 }}>
          {!compact ? (
            <Typography
              variant="overline"
              sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.6, color: 'text.secondary', lineHeight: 1, mb: 0.75, pl: 0.25 }}
            >
              {g.group}
            </Typography>
          ) : (
            <Box sx={{ height: '1px', bgcolor: 'divider', mb: 1, display: gi ? 'block' : 'none' }} />
          )}
          {grid ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
              {g.items.map((t) => (
                <PaletteItem key={t} type={t} grid onAdd={onAdd} />
              ))}
            </Box>
          ) : (
            <Stack spacing={0.75}>
              {g.items.map((t) => (
                <PaletteItem key={t} type={t} compact={compact} onAdd={onAdd} onDragBlock={onDragBlock} />
              ))}
            </Stack>
          )}
        </Box>
      ))}
    </>
  );
}

export default function BotPalette({ compact, onAdd, onDragBlock }) {
  return (
    <Box
      sx={{
        width: compact ? 62 : 222,
        flexShrink: 0,
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.default',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        p: compact ? 0.9 : 1.25,
        transition: 'width .18s ease'
      }}
    >
      {!compact ? (
        <>
          <Typography sx={{ fontWeight: 800, fontSize: 13 }}>Blocos</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.35 }}>
            Arraste para o canvas ou clique para adicionar
          </Typography>
        </>
      ) : null}
      <PaletteList compact={compact} onAdd={onAdd} onDragBlock={onDragBlock} />
    </Box>
  );
}
