#!/usr/bin/env bash
# Roda test_php.php dentro do WordPress de teste (precisa do setup-site.sh antes).
set -euo pipefail
cd "$(dirname "$0")"
ssh pubmail-hostinger 'F=$(mktemp /var/tmp/trinv-php-XXXXXX.php) && cat > "$F" && chown www-data "$F" && cd /var/www/sites.reveleonline.com && sudo -u www-data wp eval-file "$F"; rm -f "$F"' < test_php.php
