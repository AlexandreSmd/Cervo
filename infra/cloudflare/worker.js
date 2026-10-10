// Worker Cloudflare (production) : sert le site (fichiers de web/dist) et transmet /api/* à l'API Modal.
// Même domaine pour le site et l'API : pas de CORS, cookies et jetons simples.
// Variable : API_ORIGIN (URL de l'API Modal), fixée par `npm run prod:deploy`.

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // www.domaine → domaine
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname.startsWith("/api/")) {
      const target = new URL(url.pathname + url.search, env.API_ORIGIN);
      const response = await fetch(new Request(target, request));
      return withHeaders(response, { "Cache-Control": response.headers.get("Cache-Control") ?? "no-store" });
    }

    return withHeaders(await env.ASSETS.fetch(request));
  },
};

function withHeaders(response, extra = {}) {
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) out.headers.set(k, v);
  return out;
}
