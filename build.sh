#!/bin/sh
# Kurulum: npm install   |   Derleme: ./build.sh   → dist/index.html (tek dosya, tarayıcıda açılır)
set -e
cd "$(dirname "$0")"
mkdir -p dist
npx esbuild src/main.js --bundle --minify --format=iife --target=es2020 --outfile=dist/bundle.js --log-level=warning
python3 - <<'PY'
b=open('dist/bundle.js').read().replace('</script','<\\/script')
t=open('template.html').read(); open('dist/index.html','w').write(t.replace('/*BUNDLE*/',b))
PY
cp dist/index.html index.html   # GitHub Pages kökten bu dosyayı sunar
echo "Hazır: dist/index.html (kök index.html de güncellendi)"
