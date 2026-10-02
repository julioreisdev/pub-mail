#!/usr/bin/env bash
# Remove o conteúdo de teste do WordPress de teste.
set -euo pipefail
ssh pubmail-hostinger 'bash -s' <<'REMOTE'
cd /var/www/sites.reveleonline.com
W="sudo -u www-data wp"
for s in grow-tomatoes recetas-cena cafe-parfait tokyo-guide economizar-energia; do id=$($W post list --name=$s --post_type=post --field=ID); [ -n "$id" ] && $W post delete $id --force >/dev/null; done
id=$($W post list --name=about-us --post_type=page --field=ID); [ -n "$id" ] && $W post delete $id --force >/dev/null
rm -f wp-content/mu-plugins/trinv-test-*.php; rmdir wp-content/mu-plugins 2>/dev/null
$W eval 'if (class_exists("TRINV_Store")) { TRINV_Store::clear(); }' >/dev/null
rm -rf /var/tmp/trinv-content /var/tmp/trinv_test_php.php
echo "conteúdo de teste removido"
REMOTE
