interface Env {
  ASSETS: Fetcher;
}

const API_ORIGIN = "https://api.store254.co.ke";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const apiUrl = new URL(`${url.pathname}${url.search}`, API_ORIGIN);
      return fetch(new Request(apiUrl, request));
    }

    return env.ASSETS.fetch(request);
  },
};
