import { memo } from 'react';
import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconAlignLeft,
  IconBrandWhatsapp,
  IconCircle,
  IconCircleCheckFilled,
  IconClock,
  IconPencil,
  IconSquareCheck,
  IconTrash
} from '@tabler/icons-react';

import { WaNumberDot } from '../waKit';
import { checklistStats, dueLabel, dueState, initials, inkOn, personColor } from './taskKit';

// Cartão do quadro (estilo Trello): capa, etiquetas, título com o círculo de concluir, selos
// (prazo, descrição, checklist, conversa) e o avatar do responsável. Lixeira e lápis aparecem no hover
// (no celular ficam sempre visíveis). Arrastável (HTML5) — quem controla o arrasto é a coluna.

const DUE_STYLE = {
  done: { bg: '#1f845a', fg: '#fff' },
  overdue: { bg: '#c9372c', fg: '#fff' },
  today: { bg: '#f5cd47', fg: '#533f04' },
  soon: { bg: 'transparent', fg: '#a54800' },
  normal: { bg: 'transparent', fg: null }
};

function TaskCard({ task, labelsById, myId, multi, now, dragging, onOpen, onToggleDone, onDelete, dragProps }) {
  const labels = (task.label_ids || []).map((id) => labelsById.get(id)).filter(Boolean);
  const ds = dueState(task, now);
  const cl = checklistStats(task);
  const assignee = task.assigned_user;
  const chat = task.chat;

  return (
    <Box
      {...dragProps}
      onClick={() => onOpen(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(task);
      }}
      sx={(t) => ({
        position: 'relative',
        borderRadius: '10px',
        bgcolor: '#fff',
        boxShadow: '0 1px 1px rgba(9,30,66,.25), 0 0 1px rgba(9,30,66,.31)',
        cursor: 'pointer',
        overflow: 'hidden',
        outline: '2px solid transparent',
        transition: 'outline-color .12s, box-shadow .12s, opacity .12s',
        opacity: dragging ? 0.35 : 1,
        '&:hover, &:focus-visible': { outlineColor: t.vars.palette.primary.main },
        '&:hover .tc-actions, &:focus-within .tc-actions': { opacity: 1 },
        '&:hover .tc-check': { width: 18, opacity: 1, mr: 0.75 },
        ...t.applyStyles('dark', { bgcolor: '#22272b', boxShadow: '0 1px 1px rgba(0,0,0,.5), 0 0 1px rgba(255,255,255,.08)' })
      })}
    >
      {task.cover ? <Box sx={{ height: 34, bgcolor: task.cover }} /> : null}

      <Box sx={{ px: 1.25, pt: 1, pb: 1 }}>
        {labels.length ? (
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mb: 0.75, pr: 3 }}>
            {labels.map((l) => (
              <Box
                key={l.id}
                title={l.name || undefined}
                sx={{
                  minWidth: 40,
                  maxWidth: '100%',
                  height: 16,
                  px: l.name ? 0.75 : 0,
                  borderRadius: '4px',
                  bgcolor: l.color,
                  color: inkOn(l.color),
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: '16px',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis'
                }}
              >
                {l.name}
              </Box>
            ))}
          </Stack>
        ) : null}

        <Stack direction="row" alignItems="flex-start" sx={{ pr: 3.5 }}>
          <Box
            className="tc-check"
            onClick={(e) => {
              e.stopPropagation();
              onToggleDone(task);
            }}
            sx={{
              display: 'flex',
              flexShrink: 0,
              mt: '1px',
              overflow: 'hidden',
              transition: 'width .15s, opacity .15s, margin .15s',
              color: task.done ? '#22a06b' : 'text.secondary',
              width: task.done ? 18 : { xs: 18, md: 0 },
              mr: task.done ? 0.75 : { xs: 0.75, md: 0 },
              opacity: task.done ? 1 : { xs: 1, md: 0 },
              '&:hover': { color: '#22a06b' }
            }}
          >
            <Tooltip title={task.done ? 'Reabrir' : 'Marcar como concluída'}>
              {task.done ? <IconCircleCheckFilled size={18} /> : <IconCircle size={18} stroke={1.8} />}
            </Tooltip>
          </Box>
          <Typography
            sx={{
              fontSize: 14,
              lineHeight: 1.35,
              fontWeight: 500,
              color: 'text.primary',
              wordBreak: 'break-word',
              minWidth: 0
            }}
          >
            {task.title}
          </Typography>
        </Stack>

        {ds || task.description || cl.total || chat || assignee ? (
          <Stack direction="row" alignItems="center" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
            {ds ? (
              <Tooltip title={ds === 'overdue' ? 'Atrasada' : ds === 'done' ? 'Concluída' : ds === 'today' ? 'Vence hoje' : 'Prazo'}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.4,
                    px: DUE_STYLE[ds].bg === 'transparent' ? 0 : 0.6,
                    height: 20,
                    borderRadius: '4px',
                    bgcolor: DUE_STYLE[ds].bg,
                    color: DUE_STYLE[ds].fg || 'text.secondary',
                    fontSize: 12,
                    fontWeight: ds === 'normal' ? 500 : 600
                  }}
                >
                  {ds === 'done' ? <IconSquareCheck size={14} /> : <IconClock size={14} />}
                  {dueLabel(task.due_at)}
                </Box>
              </Tooltip>
            ) : null}
            {task.description ? (
              <Tooltip title="Tem descrição">
                <Box sx={{ display: 'inline-flex', color: 'text.secondary' }}>
                  <IconAlignLeft size={15} />
                </Box>
              </Tooltip>
            ) : null}
            {cl.total ? (
              <Tooltip title="Checklist">
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.4,
                    px: cl.complete ? 0.6 : 0,
                    height: 20,
                    borderRadius: '4px',
                    fontSize: 12,
                    fontWeight: 600,
                    bgcolor: cl.complete ? '#1f845a' : 'transparent',
                    color: cl.complete ? '#fff' : 'text.secondary'
                  }}
                >
                  <IconSquareCheck size={14} />
                  {cl.done}/{cl.total}
                </Box>
              </Tooltip>
            ) : null}
            {chat ? (
              <Tooltip title={chat.chat_id ? `Conversa: ${chat.name || chat.phone || ''}` : 'A conversa não existe mais'}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.4,
                    maxWidth: 150,
                    color: chat.chat_id ? '#1f9c56' : 'text.disabled',
                    fontSize: 12,
                    fontWeight: 600,
                    minWidth: 0
                  }}
                >
                  {multi && chat.session ? (
                    <WaNumberDot session={chat.session} size={8} />
                  ) : (
                    <IconBrandWhatsapp size={14} style={{ flexShrink: 0 }} />
                  )}
                  <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {chat.name || chat.phone || 'Conversa'}
                  </Box>
                </Box>
              </Tooltip>
            ) : null}
            <Box sx={{ flex: 1 }} />
            {assignee ? (
              <Tooltip title={`Responsável: ${assignee.id === myId ? 'você' : assignee.name || ''}`}>
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#fff',
                    bgcolor: personColor(assignee.id),
                    flexShrink: 0
                  }}
                >
                  {initials(assignee.name)}
                </Box>
              </Tooltip>
            ) : null}
          </Stack>
        ) : null}
      </Box>

      {/* ações no hover */}
      <Stack
        className="tc-actions"
        direction="row"
        spacing={0.25}
        sx={(t) => ({
          position: 'absolute',
          top: task.cover ? 38 : 4,
          right: 4,
          opacity: { xs: 1, md: 0 },
          transition: 'opacity .12s',
          borderRadius: '8px',
          bgcolor: 'rgba(255,255,255,.92)',
          boxShadow: '0 1px 3px rgba(9,30,66,.2)',
          ...t.applyStyles('dark', { bgcolor: 'rgba(34,39,43,.95)' })
        })}
      >
        <Tooltip title="Abrir">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(task);
            }}
            sx={{ p: 0.5 }}
          >
            <IconPencil size={15} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Apagar">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task);
            }}
            sx={{ p: 0.5, '&:hover': { color: 'error.main' } }}
          >
            <IconTrash size={15} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}

TaskCard.propTypes = {
  task: PropTypes.object.isRequired,
  labelsById: PropTypes.instanceOf(Map).isRequired,
  myId: PropTypes.string,
  multi: PropTypes.bool,
  now: PropTypes.number,
  dragging: PropTypes.bool,
  onOpen: PropTypes.func.isRequired,
  onToggleDone: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  dragProps: PropTypes.object
};

export default memo(TaskCard);
