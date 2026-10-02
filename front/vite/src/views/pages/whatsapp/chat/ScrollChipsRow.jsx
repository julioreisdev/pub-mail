import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

import { HIDE_SCROLL } from './chatKit';

// ============================================================================
// Linha horizontal de chips sem scrollbar: bordas esmaecidas (mask) + setinhas
// redondas que só aparecem quando há conteúdo escondido daquele lado + roda do
// mouse (vertical → horizontal). `trailing` fica fixo à direita, fora da rolagem.
// ============================================================================
const FADE = 28;

function EdgeArrow({ side, show, onClick }) {
  const Icon = side === 'left' ? IconChevronLeft : IconChevronRight;
  return (
    <Box
      component="button"
      type="button"
      tabIndex={-1}
      aria-label={side === 'left' ? 'Rolar filtros para a esquerda' : 'Rolar filtros para a direita'}
      onClick={onClick}
      sx={{
        position: 'absolute',
        top: '50%',
        [side]: 0,
        transform: `translateY(-50%) scale(${show ? 1 : 0.85})`,
        zIndex: 2,
        width: 22,
        height: 22,
        p: 0,
        display: 'grid',
        placeItems: 'center',
        borderRadius: '50%',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.secondary',
        cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,.14)',
        opacity: show ? 1 : 0,
        pointerEvents: show ? 'auto' : 'none',
        transition: 'opacity .15s ease, transform .15s ease, color .12s ease',
        '&:hover': { color: 'text.primary', bgcolor: 'background.paper' }
      }}
    >
      <Icon size={14} stroke={2.4} />
    </Box>
  );
}

export default function ScrollChipsRow({ children, trailing, sx }) {
  const scRef = useRef(null);
  const innerRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = scRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((p) => (p.left === left && p.right === right ? p : { left, right }));
  }, []);

  useEffect(() => {
    const el = scRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth + 1) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // já é horizontal (trackpad)
      const max = el.scrollWidth - el.clientWidth;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return; // na ponta: deixa rolar a página
      e.preventDefault();
      el.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
      if (innerRef.current) ro.observe(innerRef.current);
    }
    update();
    return () => {
      el.removeEventListener('wheel', onWheel);
      ro?.disconnect();
    };
  }, [update]);

  const nudge = (dir) => {
    const el = scRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  const mask = `linear-gradient(to right, ${edges.left ? `transparent 0, #000 ${FADE}px` : '#000 0'}, ${
    edges.right ? `#000 calc(100% - ${FADE}px), transparent 100%` : '#000 100%'
  })`;

  return (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={sx}>
      <Box sx={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <Box
          ref={scRef}
          onScroll={update}
          sx={{
            ...HIDE_SCROLL,
            overflowX: 'auto',
            overflowY: 'hidden',
            overscrollBehaviorX: 'contain',
            scrollPaddingInline: '30px',
            maskImage: mask,
            WebkitMaskImage: mask,
            py: 0.25
          }}
        >
          <Box ref={innerRef} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: 'max-content' }}>
            {children}
          </Box>
        </Box>
        <EdgeArrow side="left" show={edges.left} onClick={() => nudge(-1)} />
        <EdgeArrow side="right" show={edges.right} onClick={() => nudge(1)} />
      </Box>
      {trailing}
    </Stack>
  );
}
