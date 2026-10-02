#!/usr/bin/env bash
# Instala no site de teste a edição do Pub Mail (pacote da org SuperAdmin), gerado NO SERVIDOR sem senha:
# token de 5 min assinado com o JWT_ACCESS_SECRET do back (nunca impresso) → download pela API local.
# Uso: ./license/install-pubmail.sh            instala a versão que o Pub Mail serve
#      ./license/install-pubmail.sh 1.4.0      e marca o plugin como 1.4.0 com o cache de versões vencido
#                                              (preparo do cenário UPD: node e2e.mjs UPD)
set -euo pipefail
FAKE="${1:-}"
[[ -z "$FAKE" || "$FAKE" =~ ^[0-9.]+$ ]] || { echo "versão inválida"; exit 1; }
ssh pubmail-hostinger "FAKE='$FAKE' bash -s" <<'EOS'
set -eo pipefail
cd /opt/pub-mail/back
DBP=$(grep ^DB_PASS= /root/pubmail.secrets | cut -d= -f2)
read UID_ ORG_ <<<"$(mysql -N -upubmail -p"$DBP" -h127.0.0.1 pubmail -e "SELECT id, organization_id FROM users WHERE email='superadmin@pubmail.com' LIMIT 1" 2>/dev/null)"
T=$(UID_="$UID_" ORG_="$ORG_" node -e '
require("dotenv").config({ path: ".env", quiet: true });
const jwt = require("jsonwebtoken");
const n = (v) => (isNaN(+v) ? v : +v);
process.stdout.write(jwt.sign({ sub: n(process.env.UID_), org: n(process.env.ORG_), role: "SUPER_ADMIN" }, process.env.JWT_ACCESS_SECRET, { expiresIn: "5m" }));')
Z=$(mktemp /var/tmp/ti-pm-XXXXXX.zip)
curl -s -o "$Z" -w "pacote do Pub Mail: HTTP %{http_code}\n" -H "Authorization: Bearer $T" http://127.0.0.1:8000/wordpress/translator/download
unset T
chown www-data "$Z" && chmod 644 "$Z"
cd /var/www/sites.reveleonline.com
sudo -u www-data wp plugin install "$Z" --force --activate 2>&1 | tail -1
rm -f "$Z"
if [ -n "$FAKE" ]; then
  P=wp-content/plugins/tradutor-invisivel/tradutor-invisivel.php
  sed -i -E "s/^( \* Version: +)[0-9.]+/\1$FAKE/; s/define\( 'TRINV_VERSION', '[0-9.]+' \);/define( 'TRINV_VERSION', '$FAKE' );/" "$P"
  sudo -u www-data wp eval 'set_site_transient("trinv_update_info", array("ok" => false), HOUR_IN_SECONDS); delete_site_transient("update_plugins");' 2>/dev/null
fi
sudo -u www-data wp eval 'TRINV_License::check(); echo "instalado: versão ", TRINV_VERSION, " | edição ", TRINV_EDITION, " | licença ativa: ", TRINV_License::active() ? "sim" : "NÃO", PHP_EOL;' 2>&1 | grep -v cache
EOS
