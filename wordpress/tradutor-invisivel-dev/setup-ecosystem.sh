#!/usr/bin/env bash
# Cenário de ecossistema no site de teste: página do Elementor + loja WooCommerce (precisa dos dois plugins ativos).
set -euo pipefail
cd "$(dirname "$0")"
ssh pubmail-hostinger 'F=$(mktemp /var/tmp/trinv-eco-XXXXXX.php) && cat > "$F" && chown www-data "$F" && cd /var/www/sites.reveleonline.com && sudo -u www-data wp eval-file "$F" 2>&1 | grep -v "wp-cli/cache"; sudo -u www-data wp elementor flush-css >/dev/null 2>&1; rm -f "$F"' < ecosystem.php
