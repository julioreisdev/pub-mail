#!/usr/bin/env bash
# Monta o conteúdo de teste no WordPress de teste (sites.reveleonline.com). Rodar antes do PHP/e2e.
set -euo pipefail
cd "$(dirname "$0")"
tar -czf - content | ssh pubmail-hostinger 'rm -rf /var/tmp/trinv-content && mkdir -p /var/tmp/trinv-content && tar -xzf - -C /var/tmp/trinv-content --strip-components=1 && chown -R www-data /var/tmp/trinv-content'
ssh pubmail-hostinger 'bash -s' <<'REMOTE'
set -e
cd /var/www/sites.reveleonline.com
W="sudo -u www-data wp --user=1"
mk(){ id=$($W post list --name="$2" --post_type="$3" --field=ID); if [ -n "$id" ]; then $W post update "$id" "/var/tmp/trinv-content/$1" --post_title="$4" >/dev/null; else $W post create "/var/tmp/trinv-content/$1" --post_type="$3" --post_title="$4" --post_name="$2" --post_status=publish --porcelain; fi; }
mk en.html grow-tomatoes post "Growing Tomatoes at Home: A Complete Guide"
mk es.html recetas-cena post "Recetas fáciles para la cena"
mk fr.html cafe-parfait post "Le secret du café parfait"
mk ja.html tokyo-guide post "東京旅行ガイド"
mk pt.html economizar-energia post "Como economizar energia em casa"
mk about.html about-us page "About us"
# comentários em outras línguas no post em português (e um em português no post em inglês)
cm(){ pid=$($W post list --name="$1" --post_type=post --field=ID); $W comment list --post_id="$pid" --search="$3" --field=ID | grep -q . || $W comment create --comment_post_ID="$pid" --comment_author="$2" --comment_author_email=teste@example.com --comment_content="$3" --comment_approved=1 --porcelain >/dev/null; }
cm economizar-energia "Lucía" "Me encantó este artículo, voy a cambiar todas las bombillas de mi casa esta semana."
cm economizar-energia "Mark" "Great tips, I switched to LED bulbs last month and my electricity bill went down a lot."
cm grow-tomatoes "Joana" "Adorei o guia, vou plantar tomates na varanda do meu apartamento neste fim de semana."
mkdir -p wp-content/mu-plugins
cat > wp-content/mu-plugins/trinv-test-dynamic.php <<'PHP'
<?php
// SÓ PARA TESTE do Tradutor Invisível: insere um parágrafo 1,5 s depois de carregar.
add_action( 'wp_footer', function () {
	echo '<script>setTimeout(function(){var d=document.getElementById("later");if(d){d.innerHTML="<p><strong>Tip:</strong> water early in the morning, so the leaves dry before night.</p>";}},1500);</script>';
} );
PHP
chown -R www-data wp-content/mu-plugins
echo "conteúdo de teste pronto"
REMOTE
