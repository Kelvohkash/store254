interface Env {
  ASSETS: Fetcher;
  API: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const apiUrl = new URL(`${url.pathname}${url.search}`, "https://api.internal");
      const headers = new Headers(request.headers);
      headers.set("X-Forwarded-Host", url.host);

      return env.API.fetch(
        new Request(apiUrl, {
          method: request.method,
          headers,
          body: request.body,
          redirect: "manual",
        })
      );
    }

    return env.ASSETS.fetch(request);
  },
};
