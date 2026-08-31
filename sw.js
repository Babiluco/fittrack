/* ==========================================================================
   FitTrack — Service Worker
   ==========================================================================
   Mantem o app shell disponivel e faz cache sob demanda de assets estaticos.
   Chamadas ao Supabase e outras APIs seguem pela rede para evitar dados antigos.
   ========================================================================== */

const CACHE_VERSION = 'fittrack-v1.0.1';
const APP_SHELL_CACHE = `${CACHE_VERSION}:shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}:runtime`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './css/style.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './js/config.js',
  './js/utils.js',
  './js/storage.js',
  './js/database.js',
  './js/api.js',
  './js/supabase.js',
  './js/auth.js',
  './js/profile.js',
  './js/sync.js',
  './js/data.js',
  './js/icons.js',
  './js/analytics.js',
  './js/progression.js',
  './js/calendar.js',
  './js/photos.js',
  './js/timer.js',
  './js/charts.js',
  './js/app.js',
];

const CDN_HOSTS = new Set([
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
]);

function isSupabaseRequest(url){
  return url.hostname.endsWith('.supabase.co');
}

function isStaticRequest(request){
  if(request.method !== 'GET') return false;
  const url = new URL(request.url);
  if(isSupabaseRequest(url)) return false;
  if(url.origin === self.location.origin) return true;
  return CDN_HOSTS.has(url.hostname);
}

async function cacheFirst(request){
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if(cached) return cached;

  const response = await fetch(request);
  if(response && response.ok){
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request){
  try{
    const response = await fetch(request);
    if(response && response.ok){
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put('./index.html', response.clone());
    }
    return response;
  }catch(error){
    const cache = await caches.open(APP_SHELL_CACHE);
    return (await cache.match('./index.html')) || Response.error();
  }
}

self.addEventListener('install', event=>{
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(cache=>cache.addAll(APP_SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys
          .filter(key=>key.startsWith('fittrack-') && !key.startsWith(CACHE_VERSION))
          .map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', event=>{
  const {request} = event;
  const url = new URL(request.url);

  if(isSupabaseRequest(url)) return;

  if(request.mode === 'navigate'){
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if(isStaticRequest(request)){
    event.respondWith(cacheFirst(request));
  }
});
