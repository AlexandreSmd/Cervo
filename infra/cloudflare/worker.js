// Worker Cloudflare (mise en ligne) : proxifie /api/* vers l'API Modal, le reste vers Cloudflare Pages.
// Variables : API_ORIGIN (ex. https://<compte>--cervo-daily-api-api.modal.run).
// La limitation de débit sur /api/answer se configure dans Cloudflare (règle « Rate limiting »).
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const target = new URL(url.pathname + url.search, env.API_ORIGIN);
      return fetch(new Request(target, request));
    }
    return env.ASSETS ? env.ASSETS.fetch(request) : fetch(request);
  },
};
