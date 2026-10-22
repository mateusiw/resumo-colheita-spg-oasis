// Cache local para o site abrir sem internet.
// - Página (index.html): tenta a rede primeiro (pega atualizações) e usa o cache se estiver offline.
// - Bibliotecas e imagens (Tailwind, Lucide, html-to-image, logos): usa o cache e atualiza em segundo plano.
// - Planilha (Apps Script): nunca vai para o cache; o próprio app guarda os dados no aparelho.
const CACHE_NAME = 'spg-cache-v1';
const PRECACHE = [
    './',
    './index.html',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://unpkg.com/html-to-image@1.11.11/dist/html-to-image.js',
    'https://i.imgur.com/wEozr34.png',
    'https://i.imgur.com/f7UnnL0.png'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.all(PRECACHE.map(url =>
        // no-cors para os arquivos de outros sites; se algum falhar, os outros continuam
        cache.add(new Request(url, url.startsWith('http') ? { mode: 'no-cors' } : {})).catch(() => {})
    ))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) return;

    // Página: rede primeiro, cache se offline
    if (req.mode === 'navigate') {
        event.respondWith(fetch(req).then(res => {
            const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put('./index.html', copy));
            return res;
        }).catch(() => caches.match('./index.html', { ignoreSearch: true }).then(r => r || caches.match('./'))));
        return;
    }

    // Demais arquivos: cache primeiro, atualiza em segundo plano
    event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match(req, { ignoreVary: true }).then(cached => {
        const network = fetch(req).then(res => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
        }).catch(() => cached);
        return cached || network;
    })));
});
