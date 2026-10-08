#!/usr/bin/env python3
"""
Limpeza noturna do gateway OpenWA (motor Baileys).

O gateway guarda uma cópia EM CLARO das mensagens (tabela `messages`, com a mídia em base64
dentro de `metadata`) e dos webhooks já entregues (`webhook_outbox_events`). O Pub Mail já tem
tudo isso — cifrado — então aqui só fica o que é recente (padrão: 7 dias).

O que NÃO é tocado:
  - `baileys_stored_messages`: é dela que saem responder/reagir/editar/apagar; o próprio gateway
    já limita às últimas 5.000 mensagens.
  - `status_updates`: o gateway apaga sozinho os status vencidos.
  - sessões, mapeamentos @lid, webhooks configurados.

Como roda (como root, pelo systemd):
  1. pausa o container (ninguém escreve no SQLite durante a limpeza);
  2. faz o trabalho no banco como o DONO do arquivo (o mesmo usuário do container), pra nunca
     deixar journal/arquivo de root que o gateway não consiga abrir;
  3. despausa SEMPRE (finally).
`secure_delete` zera as páginas apagadas; o índice de busca (FTS5) é reescrito sem o que saiu;
VACUUM só quando sobra muito espaço livre no arquivo (devolve o espaço ao disco).

Uso:
  openwa_cleanup.py                       # produção: /opt/openwa-baileys/data/openwa.sqlite, 7 dias
  openwa_cleanup.py --db <cópia> --no-pause --days 7   # teste numa cópia
"""
import argparse
import os
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone

DEFAULT_DB = '/opt/openwa-baileys/data/openwa.sqlite'
LOG = '/var/log/openwa-cleanup.log'
BATCH = 1000
VACUUM_RATIO = 0.20  # VACUUM quando >= 20% do arquivo está livre


def log(msg, to_file=True):
    line = f"{datetime.now(timezone.utc).isoformat(timespec='seconds')} {msg}"
    print(line, flush=True)
    if to_file:
        try:
            with open(LOG, 'a') as f:
                f.write(line + '\n')
        except OSError:
            pass


def table_exists(c, name):
    return c.execute("select 1 from sqlite_master where name = ?", (name,)).fetchone() is not None


def delete_batches(c, table, where, params):
    total = 0
    while True:
        # autocommit: cada lote é uma transação curta
        cur = c.execute(f'delete from "{table}" where rowid in (select rowid from "{table}" where {where} limit {BATCH})', params)
        if cur.rowcount <= 0:
            return total
        total += cur.rowcount


def worker(db, days):
    t0 = time.time()
    size0 = os.path.getsize(db)
    c = sqlite3.connect(db, timeout=60, isolation_level=None)
    c.execute('pragma busy_timeout = 60000')
    c.execute('pragma secure_delete = on')
    cutoff = f'-{int(days)} days'
    stats = {}

    stats['messages'] = delete_batches(c, 'messages', "createdAt < datetime('now', ?)", (cutoff,))
    if table_exists(c, 'webhook_outbox_events'):
        stats['outbox'] = delete_batches(c, 'webhook_outbox_events', "state = 'dispatched' and createdAt < datetime('now', ?)", (cutoff,))
    if table_exists(c, 'webhook_delivery_failures'):
        stats['failures'] = delete_batches(c, 'webhook_delivery_failures', "createdAt < datetime('now', ?)", (cutoff,))

    # O índice de busca guarda o texto em segmentos e o 'delete' só marca a remoção (o termo
    # continua no arquivo). 'rebuild' refaz o índice a partir do que ficou; com secure_delete as
    # páginas antigas são zeradas.
    if stats['messages'] and table_exists(c, 'messages_fts'):
        c.execute("insert into messages_fts(messages_fts) values ('rebuild')")

    pages = c.execute('pragma page_count').fetchone()[0]
    free = c.execute('pragma freelist_count').fetchone()[0]
    vacuumed = False
    if pages and free / pages >= VACUUM_RATIO:
        c.execute('vacuum')
        vacuumed = True
    ok = c.execute('pragma quick_check').fetchone()[0]
    c.close()
    size1 = os.path.getsize(db)
    mb = lambda b: f'{b / 1048576:.0f} MB'
    print(f"limpeza ok: {stats.get('messages', 0)} mensagens, {stats.get('outbox', 0)} webhooks entregues, "
        f"{stats.get('failures', 0)} falhas antigas apagadas (> {days} dias); "
        f"arquivo {mb(size0)} -> {mb(size1)}{' (vacuum)' if vacuumed else f', livre {free * 100 // max(pages, 1)}%'}; "
        f"check={ok}; {time.time() - t0:.1f} s", flush=True)
    return 0 if ok == 'ok' else 2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--db', default=DEFAULT_DB)
    ap.add_argument('--days', type=int, default=7)
    ap.add_argument('--container', default='openwa-baileys')
    ap.add_argument('--no-pause', action='store_true', help='não pausa o container (teste numa cópia)')
    ap.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    a = ap.parse_args()
    if a.days < 1:
        sys.exit('--days precisa ser >= 1')
    if not os.path.exists(a.db):
        sys.exit(f'banco não encontrado: {a.db}')

    if a.worker:
        sys.exit(worker(a.db, a.days))

    st = os.stat(a.db)
    cmd = [sys.executable, os.path.abspath(__file__), '--worker', '--db', a.db, '--days', str(a.days)]
    if os.geteuid() == 0 and st.st_uid != 0:
        cmd = ['setpriv', f'--reuid={st.st_uid}', f'--regid={st.st_gid}', '--clear-groups'] + cmd
    env = dict(os.environ, SQLITE_TMPDIR=os.path.dirname(os.path.abspath(a.db)))

    paused = False
    try:
        if not a.no_pause:
            r = subprocess.run(['docker', 'pause', a.container], capture_output=True, text=True)
            if r.returncode != 0:
                log(f'limpeza FALHOU: não pausou o container ({r.stderr.strip()})')
                return 1
            paused = True
        # o trabalho roda como o dono do banco (sem acesso ao log de root): o resultado volta pelo stdout
        r = subprocess.run(cmd, env=env, capture_output=True, text=True)
        for line in (r.stdout or '').splitlines():
            log(line)
        if r.returncode != 0:
            log(f"limpeza FALHOU (código {r.returncode}): {(r.stderr or '').strip()[-500:]}")
        return r.returncode
    finally:
        if paused:
            subprocess.run(['docker', 'unpause', a.container], capture_output=True)


if __name__ == '__main__':
    sys.exit(main())
