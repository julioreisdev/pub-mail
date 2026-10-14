// Quadro de tarefas (estilo Trello) — constantes e funções puras compartilhadas.

// paleta de etiquetas/capa (as mesmas cores do Trello: legíveis com texto escuro)
export const LABEL_COLORS = ['#4bce97', '#f5cd47', '#fea362', '#f87168', '#9f8fef', '#579dff', '#6cc3e0', '#94c748', '#e774bb', '#8590a2'];

// cor da bolinha da coluna
export const LIST_COLORS = ['#64748b', '#377ef0', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899'];

const BRT = 'America/Sao_Paulo';
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: BRT }).format(d);

/** Situação do prazo do cartão: done | overdue | today | soon (≤ 2 dias) | normal | null (sem prazo). */
export function dueState(task, now = Date.now()) {
  if (!task?.due_at) return null;
  if (task.done) return 'done';
  const due = new Date(task.due_at).getTime();
  if (due < now) return 'overdue';
  if (dayKey(new Date(due)) === dayKey(new Date(now))) return 'today';
  if (due - now <= 2 * 86400000) return 'soon';
  return 'normal';
}

/** "14 out" ou "14 out 18:30" (hora só quando não é meia-noite) — no fuso de Brasília. */
export function dueLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('pt-BR', { timeZone: BRT, day: '2-digit', month: 'short' })
    .format(d)
    .replace('.', '')
    .replace(' de ', ' ');
  const hm = new Intl.DateTimeFormat('pt-BR', { timeZone: BRT, hour: '2-digit', minute: '2-digit' }).format(d);
  return hm === '00:00' ? day : `${day} ${hm}`;
}

export function checklistStats(task) {
  const items = Array.isArray(task?.checklist) ? task.checklist : [];
  const done = items.filter((i) => i.done).length;
  return { total: items.length, done, complete: items.length > 0 && done === items.length };
}

/** Texto escuro ou branco sobre uma cor de fundo #RRGGBB. */
export function inkOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#172b4d';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#172b4d' : '#fff';
}

export const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?';

/** Cor estável por pessoa (avatar de iniciais). */
export function personColor(id) {
  const s = String(id || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return LIST_COLORS[h % LIST_COLORS.length];
}

export const newId = () => Math.random().toString(36).slice(2, 10);
