/*
  Service worker do Mockup 3D (Almatiê).

  • Páginas (HTML): tenta a rede primeiro; sem internet, usa a última cópia.
  • Arquivos com hash em /assets/: cache primeiro (nunca mudam).
  • Modelos 3D, miniaturas e ícones: mostra o que está no cache na hora
    e atualiza em segundo plano.
  Assim o app abre mesmo offline depois da primeira visita.
  Para forçar a atualização de tudo, aumente VERSION.
*/
const VERSION = 'v1'
const CACHE = `mockup-3d-${VERSION}`

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()

      await Promise.all(
        keys
          .filter((key) => key.startsWith('mockup-3d-') && key !== CACHE)
          .map((key) => caches.delete(key))
      )

      await self.clients.claim()
    })()
  )
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE)

  try {
    const response = await fetch(request)

    if (response && response.ok) cache.put(request, response.clone())

    return response
  } catch (error) {
    const cached = await cache.match(request)

    if (cached) return cached

    throw error
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)

  if (cached) return cached

  const response = await fetch(request)

  if (response && response.ok) cache.put(request, response.clone())

  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)

  const refresh = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone())

      return response
    })
    .catch(() => null)

  return cached || (await refresh) || Response.error()
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (/\.(obj|png|svg|jpg|jpeg|webp|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request))
  }
})
