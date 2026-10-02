#!/usr/bin/env bash
# Firefox, Safari (WebKit), iPhone e Android com Playwright, rodando no servidor.
# 1ª vez no servidor: mkdir -p /opt/trinv-browsers && cd /opt/trinv-browsers && npm init -y && npm i playwright
#                     PLAYWRIGHT_BROWSERS_PATH=/opt/trinv-browsers/ms npx playwright install --with-deps firefox webkit chromium
# Uso: ./run-browsers.sh [filtro]   (filtro = parte do nome: Firefox, Safari, iPhone, Android)
set -euo pipefail
cd "$(dirname "$0")"
scp -q browsers.mjs pubmail-hostinger:/opt/trinv-browsers/browsers.mjs
ssh pubmail-hostinger "cd /opt/trinv-browsers && rm -rf shots && PLAYWRIGHT_BROWSERS_PATH=/opt/trinv-browsers/ms node browsers.mjs ${1:-}" || status=$?
mkdir -p shots && scp -q 'pubmail-hostinger:/opt/trinv-browsers/shots/*.png' shots/ 2>/dev/null || true
exit ${status:-0}
