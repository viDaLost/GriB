// Доводит веб-сборку (npx expo export -p web) до офлайн-PWA:
// модель и рантайм LiteRT.js рядом с сайтом, мета-теги для iPhone, service worker.
// Запуск: node scripts/build-web.mjs  (после expo export, из папки app/)
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const APP = join(import.meta.dirname, '..');
const DIST = join(APP, 'dist');
const BASE = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')).expo.experiments?.baseUrl ?? '';
const LITERT_FILES = [
  'litert_wasm_internal.js',
  'litert_wasm_internal.wasm',
  'litert_wasm_compat_internal.js',
  'litert_wasm_compat_internal.wasm',
];

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('Нет dist/index.html — сначала выполните: npx expo export -p web');
  process.exit(1);
}

// 1. Рантайм LiteRT.js (обычный — для Chrome, compat — для Safari без relaxed SIMD).
mkdirSync(join(DIST, 'litert'), { recursive: true });
for (const f of LITERT_FILES) {
  copyFileSync(join(APP, 'node_modules', '@litertjs', 'core', 'wasm', f), join(DIST, 'litert', f));
}

// 2. Модель — если она уже обучена. Копия, которую Metro кладёт в assets/ из-за require()
//    в общем коде, в браузере не используется — удаляем, чтобы не скачивать 7 МБ дважды.
const model = join(APP, 'assets', 'model', 'gribnik.tflite');
if (existsSync(model)) {
  mkdirSync(join(DIST, 'model'), { recursive: true });
  copyFileSync(model, join(DIST, 'model', 'gribnik.tflite'));
}
const bundledModelDir = join(DIST, 'assets', 'assets', 'model');
if (existsSync(bundledModelDir)) rmSync(bundledModelDir, { recursive: true, force: true });

// 3. Мета-теги: установка на экран «Домой», цвет, иконки, регистрация service worker.
const head = `
<link rel="manifest" href="${BASE}/manifest.webmanifest">
<link rel="apple-touch-icon" href="${BASE}/icons/apple-touch-icon.png">
<meta name="theme-color" content="#023B19">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Грибник">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('${BASE}/sw.js', { scope: '${BASE}/' });
  });
}
</script>
`;
let html = readFileSync(join(DIST, 'index.html'), 'utf8');
html = html.replace('<html lang="en">', '<html lang="ru">');
if (!html.includes('rel="manifest"')) html = html.replace('</head>', `${head}</head>`);
writeFileSync(join(DIST, 'index.html'), html);
// GitHub Pages: прямые ссылки на экраны (…/species/…) отдают 404.html — пусть это будет приложение.
writeFileSync(join(DIST, '404.html'), html);
writeFileSync(join(DIST, '.nojekyll'), '');

// 4. Service worker: всё приложение кешируется при первом открытии и дальше работает без сети.
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(DIST)
  .map((p) => relative(DIST, p).split('\\').join('/'))
  .filter((p) => !['sw.js', '404.html', '.nojekyll'].includes(p) && !p.endsWith('.map'))
  .sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(DIST, f)));
const version = hash.digest('hex').slice(0, 12);
const urls = files.map((f) => `${BASE}/${f}`);

const sw = `// Сгенерировано scripts/build-web.mjs
const CACHE = 'gribnik-${version}';
const BASE = '${BASE}';
const PRECACHE = ${JSON.stringify([`${BASE}/`, ...urls], null, 0)};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // По одному: если какой-то файл не скачался, остальные всё равно сохранятся.
    await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('gribnik-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      // Без сети любая страница приложения открывается из кеша.
      if (req.mode === 'navigate') return (await cache.match(BASE + '/')) || Response.error();
      throw e;
    }
  })());
});
`;
writeFileSync(join(DIST, 'sw.js'), sw);

const size = files.reduce((s, f) => s + statSync(join(DIST, f)).size, 0);
console.log(`PWA готова: ${files.length} файлов, ${(size / 1e6).toFixed(1)} МБ в офлайн-кеше, версия ${version}`);
