const CACHE_NAME = 'ecofogo-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  // Adicione ícones se tiver as imagens na pasta: './icons/icon-192x192.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna o cache se encontrar, senão tenta a rede.
        return response || fetch(event.request);
      })
  );
});