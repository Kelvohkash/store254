interface Env {
  ASSETS: Fetcher;
  API: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const apiUrl = new URL(`${url.pathname}${url.search}`, "https://api.internal");
      return env.API.fetch(new Request(apiUrl, request));
    }

    return env.ASSETS.fetch(request);
  },
};
