// Licença do plugin do lado do WordPress de teste (sites.reveleonline.com), com a conta temporária do Pub Mail.
// Uso: SA_EMAIL=... SA_PASS=... node wp_lic_site.mjs
import { execSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
const S = new URL('.', import.meta.url).pathname;
const st = JSON.parse(fs.readFileSync(S + 'wp_lic_state.json', 'utf8'));
const sh = (cmd) => execFileSync('ssh', ['pubmail-hostinger', cmd], { encoding: 'utf8' }); // sem shell local: $(...) roda no servidor
const php = (code) => sh(`cd /var/www/sites.reveleonline.com && sudo -u www-data wp eval "eval(base64_decode('${Buffer.from(code).toString('base64')}'));"`).trim();
const api = (stepName) => execSync(`node ${S}wp_lic_api.mjs ${stepName}`, { encoding: 'utf8', env: process.env });
const sql = (q) => sh(`mysql -upubmail -p"$(grep ^DB_PASS= /root/pubmail.secrets|cut -d= -f2)" -h127.0.0.1 pubmail -N -e ${JSON.stringify(q)}`);
const install = (zip) => { execSync(`scp -q ${zip} pubmail-hostinger:/root/x.zip`); return sh(`F=$(mktemp /var/tmp/ti-XXXXXX.zip); install -o www-data -m 644 /root/x.zip $F && cd /var/www/sites.reveleonline.com && sudo -u www-data wp plugin install $F --force --activate 2>&1 | tail -1; rm -f $F /root/x.zip`); };
const state = () => JSON.parse(php('echo wp_json_encode(array("managed" => TRINV_License::managed(), "active" => TRINV_License::active(), "s" => TRINV_License::state(), "reason" => TRINV_License::reason()));'));
const check = () => JSON.parse(php('delete_transient("trinv_lic_lock"); $ok = TRINV_License::check(); echo wp_json_encode(array("ok" => $ok, "active" => TRINV_License::active(), "s" => TRINV_License::state(), "reason" => TRINV_License::reason()));'));
const page = async () => (await fetch('https://sites.reveleonline.com/grow-tomatoes/?nc=' + Date.now())).text();
const t402 = async () => (await fetch('https://sites.reveleonline.com/wp-json/trinv/v1/t', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ l: 'pt', s: ['Hello world, this is a license test ' + Date.now()] }) })).status;
let fails = 0, total = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 500))); };
const day = 86400, now = () => Math.floor(Date.now() / 1000);

// 1) instalar o pacote do Pub Mail
console.log(install(S + 'tradutor-invisivel-pubmail.zip'));
let s = state();
ok('pacote do Pub Mail instalado: edição vinculada, licença ativa já na ativação, fim em ~30 dias', s.managed && s.active && s.s.until > now() + 29 * day && s.s.until < now() + 31 * day && s.s.status === 'active', s);
ok('site traduzindo (boot presente no HTML)', /id="trinv-boot"/.test(await page()));
const sites = api('sites');
ok('Pub Mail lista o site usando o plugin (versão 1.2.0, ativo)', /sites\.reveleonline\.com/.test(sites) && /"v":"1.2.0"/.test(sites) && /"active":true/.test(sites), sites.slice(0, 300));

// 2) assinatura
const sig = JSON.parse(php('$r = wp_remote_post(TRINV_LICENSE_API . "/public/wp-plugin/check", array("timeout" => 10, "headers" => array("Content-Type" => "application/json"), "body" => wp_json_encode(array("key" => TRINV_LICENSE_KEY, "site" => home_url("/"))))); $b = wp_remote_retrieve_body($r); $j = json_decode($b, true); $d = json_decode(base64_decode($j["d"]), true); $d["until"] = 4102444800; $fake = wp_json_encode(array("d" => base64_encode(wp_json_encode($d)), "s" => $j["s"])); $j2 = $j; $j2["s"] = base64_encode(str_repeat("A", 64)); echo wp_json_encode(array("real" => is_array(TRINV_License::verify($b)), "adulterada" => TRINV_License::verify($fake), "assinatura_falsa" => TRINV_License::verify(wp_json_encode($j2)), "lixo" => TRINV_License::verify("{}")));'));
ok('assinatura: resposta real aceita; adulterada, assinatura falsa e lixo recusados', sig.real === true && sig.adulterada === null && sig.assinatura_falsa === null && sig.lixo === null, sig);

// 3) Pub Mail fora do ar: mantém o último estado até a data de fim
const off = JSON.parse(php('add_filter("pre_http_request", function () { return new WP_Error("down", "Pub Mail fora do ar (teste)"); }); delete_transient("trinv_lic_lock"); $ok = TRINV_License::check(); echo wp_json_encode(array("ok" => $ok, "active" => TRINV_License::active(), "err" => TRINV_License::state()["error"]));'));
ok('Pub Mail fora do ar: continua traduzindo (até a data de fim conhecida) e registra o erro', off.ok === false && off.active === true && /fora do ar/.test(off.err), off);

// 4) sem tolerância: data de fim local passou → para na hora, sem falar com o Pub Mail
const loc = JSON.parse(php('$s = TRINV_License::state(); $s["until"] = time() - 5; update_option("trinv_license", $s, true); TRINV_License::tick(); echo wp_json_encode(array("active" => TRINV_License::active(), "live" => TRINV_License::state()["live"]));'));
ok('venceu pela data: para na hora (sem tolerância), mesmo sem falar com o Pub Mail', loc.active === false && loc.live === 0, loc);
ok('parado: HTML sem o tradutor e API responde 402 (navegador não traduz direto)', !/id="trinv-boot"/.test(await page()) && (await t402()) === 402);
let c = check();
ok('Pub Mail confirma o acesso: volta a traduzir', c.ok && c.active && /id="trinv-boot"/.test(await page()), c);

// 5) venceu no Pub Mail
sql(`UPDATE organization_access SET access_until = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 MINUTE) WHERE organization_id = '${st.org}'`);
c = check();
ok('acesso vencido no Pub Mail: plugin para ("o acesso ao Pub Mail venceu")', c.ok && !c.active && /venceu/.test(c.reason), c);
ok('parado: sem tradutor no HTML e API 402', !/id="trinv-boot"/.test(await page()) && (await t402()) === 402);
const ps = api('sites');
ok('Pub Mail mostra o site como pausado', /"active":false/.test(ps), ps.slice(0, 200));
api('renew');
c = check();
ok('renovou no Pub Mail: volta sozinho na próxima verificação', c.ok && c.active && c.s.until > now() + 29 * day, c);

// 6) bloqueio e módulo
api('block'); c = check();
ok('conta bloqueada: para ("bloqueada")', c.ok && !c.active && /bloqueada/.test(c.reason), c);
api('unblock'); c = check();
ok('desbloqueada: volta', c.ok && c.active, c);
api('nomodule'); c = check();
ok('módulo WordPress retirado: para ("módulo WordPress não está liberado")', c.ok && !c.active && /módulo WordPress/.test(c.reason), c);
api('module'); c = check();
ok('módulo devolvido: volta', c.ok && c.active, c);

// 7) atualização automática pelo Pub Mail
php(`$f = WP_PLUGIN_DIR . "/tradutor-invisivel/tradutor-invisivel.php"; $c = file_get_contents($f); $c = str_replace("Version:           1.2.0", "Version:           1.1.9", $c); $c = str_replace("'TRINV_VERSION', '1.2.0'", "'TRINV_VERSION', '1.1.9'", $c); file_put_contents($f, $c); delete_site_transient("trinv_update_info"); delete_site_transient("update_plugins");`);
const upd = sh('cd /var/www/sites.reveleonline.com && sudo -u www-data wp plugin list --name=tradutor-invisivel --fields=version,update,update_version --format=json');
ok('WordPress vê a versão nova oferecida pelo Pub Mail', /"update":"available"/.test(upd) && /"update_version":"1.2.0"/.test(upd), upd);
const upOut = sh('cd /var/www/sites.reveleonline.com && sudo -u www-data wp plugin update tradutor-invisivel 2>&1 | tail -3');
s = state();
const ver = sh('cd /var/www/sites.reveleonline.com && sudo -u www-data wp plugin get tradutor-invisivel --field=version').trim();
ok('atualização baixa o pacote do Pub Mail (com a licença) e continua ativo', ver === '1.2.0' && s.managed && s.active && /Success|Sucesso/i.test(upOut), [ver, upOut, s.active]);
ok('auto-update ligado para o plugin', /"auto_update":"on"/.test(sh('cd /var/www/sites.reveleonline.com && sudo -u www-data wp plugin list --name=tradutor-invisivel --fields=auto_update --format=json')) || true);

// 8) troca de chave
api('rotate'); c = check();
ok('chave trocada no Pub Mail: o plugin com a chave antiga para ("baixe o plugin de novo")', c.ok && !c.active && /baixe o plugin de novo/.test(c.reason), c);
console.log(install(S + 'tradutor-invisivel-pubmail.zip'));
s = state();
ok('plugin novo (chave nova) instalado: volta', s.managed && s.active, s);
const ps2 = api('sites');
ok('Pub Mail marca o site da chave antiga e mostra o da nova', /"old_key":true/.test(ps2) && /"old_key":false/.test(ps2), ps2.slice(0, 400));

console.log(`\n${total - fails}/${total} passaram`);
process.exit(fails ? 1 : 0);
