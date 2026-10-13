// Worker Cloudflare (production) : sert le site (fichiers de web/dist) et transmet /api/* à l'API Modal.
// Même domaine pour le site et l'API : pas de CORS, cookies et jetons simples.
// Variable : API_ORIGIN (URL de l'API Modal), fixée par `npm run prod:deploy`.

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // www.domaine → domaine
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }

    // Photos des questions : jamais modifiées (nouvelle photo = nouvelle adresse). Gardées en cache
    // chez Cloudflare : elles s'affichent sans réveiller l'API ni relire la base (rapide et gratuit).
    if (request.method === "GET" && url.pathname.startsWith("/api/media/")) {
      const cache = caches.default;
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = withHeaders(await fetch(new URL(url.pathname, env.API_ORIGIN)));
      if (response.ok) ctx.waitUntil(cache.put(request, response.clone()));
      return response;
    }

    if (url.pathname.startsWith("/api/")) {
      const target = new URL(url.pathname + url.search, env.API_ORIGIN);
      const response = await fetch(new Request(target, request));
      return withHeaders(response, { "Cache-Control": response.headers.get("Cache-Control") ?? "no-store" });
    }

    return withHeaders(await env.ASSETS.fetch(request), { "Cache-Control": cacheFor(url.pathname) });
  },
};

// Fichiers du site : ceux de /assets/ ont un nom qui change à chaque version (empreinte du contenu),
// le téléphone peut donc les garder un an sans jamais redemander. La page elle-même est toujours
// revalidée : une mise à jour du site est visible immédiatement.
function cacheFor(pathname) {
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (pathname.startsWith("/questions/")) return "public, max-age=86400";
  return "no-cache";
}

function withHeaders(response, extra = {}) {
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) out.headers.set(k, v);
  return out;
}
