#!/usr/bin/env bash
# Gera o .zip e instala no WordPress de teste (sites.reveleonline.com).
set -euo pipefail
cd "$(dirname "$0")"
npm run -s zip | tail -1
scp -q ../../tradutor-invisivel.zip pubmail-hostinger:/root/x.zip
ssh pubmail-hostinger 'F=$(mktemp /var/tmp/ti-XXXXXX.zip); install -o www-data -m 644 /root/x.zip $F && cd /var/www/sites.reveleonline.com && sudo -u www-data wp plugin install $F --force --activate 2>&1 | tail -1; rm -f $F /root/x.zip'
